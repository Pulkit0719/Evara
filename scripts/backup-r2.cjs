/**
 * Evara Secure Encrypted Offsite Database Backup Tool
 * 
 * Extracts production database schema & records via TLS,
 * compresses using gzip, encrypts client-side using AES-256-GCM,
 * computes SHA-256 integrity checksums, and uploads to private Cloudflare R2 storage.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const mysql = require(path.join(projectRoot, 'node_modules/mysql2/promise'));
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require(path.join(projectRoot, 'node_modules/@aws-sdk/client-s3'));

// Load environment variables from process.env or .env
function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || process.env.SESSION_SECRET;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'evara-backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);
const SAVE_LOCAL = process.env.SAVE_LOCAL_COPY === 'true' || !process.env.GITHUB_ACTIONS;

if (!DATABASE_URL) {
  console.error('[Backup R2] ERROR: DATABASE_URL not set.');
  process.exit(1);
}

// Derive a 32-byte AES key using SHA-256
function getEncryptionKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

async function runBackup() {
  console.log('[Backup R2] Starting production database backup workflow...');

  // 1. Database connection & extraction
  let parsed;
  try {
    parsed = new URL(DATABASE_URL.replace(/^mysql:\/\//, 'http://'));
  } catch (e) {
    console.error('[Backup R2] ERROR: Invalid DATABASE_URL format.');
    process.exit(1);
  }

  const database = parsed.pathname.replace(/^\//, '') || 'evara';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `evara-prod-${timestamp}`;

  const conn = await mysql.createConnection(DATABASE_URL);
  let sqlText = '';

  try {
    const lines = [];
    lines.push(`-- ==============================================================`);
    lines.push(`-- Evara Production Encrypted Database Backup`);
    lines.push(`-- Timestamp: ${new Date().toISOString()}`);
    lines.push(`-- Database: ${database}`);
    lines.push(`-- ==============================================================\n`);
    lines.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

    const [tableRows] = await conn.execute('SHOW TABLES');
    const tableKey = Object.keys(tableRows[0] || {})[0];
    const tables = tableRows.map(r => r[tableKey]);

    // Sort tables so parent tables (users) are created before child tables
    tables.sort((a, b) => {
      if (a === 'users') return -1;
      if (b === 'users') return 1;
      if (a === '__drizzle_migrations') return -1;
      if (b === '__drizzle_migrations') return 1;
      return a.localeCompare(b);
    });

    console.log(`[Backup R2] Found ${tables.length} tables to dump (ordered: ${tables.join(', ')}).`);

    for (const table of tables) {
      const [createRows] = await conn.execute(`SHOW CREATE TABLE \`${table}\``);
      const createSql = createRows[0]['Create Table'];
      lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
      lines.push(`${createSql};\n`);

      const [dataRows] = await conn.execute(`SELECT * FROM \`${table}\``);
      if (dataRows.length > 0) {
        const columns = Object.keys(dataRows[0]);
        const colList = columns.map(c => `\`${c}\``).join(', ');

        for (const row of dataRows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof val === 'boolean') return val ? 1 : 0;
            return conn.escape(String(val));
          });
          lines.push(`INSERT INTO \`${table}\` (${colList}) VALUES (${values.join(', ')});`);
        }
        lines.push('');
      }
    }

    lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    lines.push(`-- Dump complete.`);
    sqlText = lines.join('\n');
  } finally {
    await conn.end();
  }

  const rawSize = Buffer.byteLength(sqlText, 'utf8');
  console.log(`[Backup R2] SQL generated: ${(rawSize / 1024).toFixed(2)} KB.`);

  // 2. Gzip compression
  const compressedBuffer = zlib.gzipSync(Buffer.from(sqlText, 'utf8'), { level: 9 });
  console.log(`[Backup R2] Gzip compressed: ${(compressedBuffer.length / 1024).toFixed(2)} KB (Ratio: ${(compressedBuffer.length / rawSize * 100).toFixed(1)}%).`);

  // 3. Client-Side AES-256-GCM Encryption
  let finalPayload;
  let finalFilename;
  let isEncrypted = false;

  if (ENCRYPTION_KEY) {
    const key = getEncryptionKey(ENCRYPTION_KEY);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(compressedBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Envelope format: [12 bytes IV][16 bytes AuthTag][Encrypted ciphertext]
    finalPayload = Buffer.concat([iv, authTag, encrypted]);
    finalFilename = `${baseName}.sql.gz.enc`;
    isEncrypted = true;
    console.log(`[Backup R2] Encrypted with AES-256-GCM: ${(finalPayload.length / 1024).toFixed(2)} KB.`);
  } else {
    finalPayload = compressedBuffer;
    finalFilename = `${baseName}.sql.gz`;
    console.warn(`[Backup R2] WARNING: BACKUP_ENCRYPTION_KEY not set. Storing as compressed gzip only.`);
  }

  // 4. Integrity Checksum (SHA-256)
  const checksum = crypto.createHash('sha256').update(finalPayload).digest('hex');
  console.log(`[Backup R2] SHA-256 Checksum: ${checksum}`);

  // 5. Save local copy if enabled
  if (SAVE_LOCAL) {
    const localDir = path.join(projectRoot, 'backups');
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(path.join(localDir, finalFilename), finalPayload);
    fs.writeFileSync(path.join(localDir, `${finalFilename}.sha256`), `${checksum}  ${finalFilename}\n`);
    console.log(`[Backup R2] Local copy saved to backups/${finalFilename}`);
  }

  // 6. Upload to Cloudflare R2 (if configured)
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    console.log(`[Backup R2] Connecting to Cloudflare R2 bucket: ${R2_BUCKET}...`);
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const objectKey = `database/daily/${finalFilename}`;
    const checksumKey = `database/daily/${finalFilename}.sha256`;

    // Upload backup file
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: objectKey,
      Body: finalPayload,
      ContentType: isEncrypted ? 'application/octet-stream' : 'application/gzip',
      Metadata: {
        'sha256': checksum,
        'timestamp': new Date().toISOString(),
        'encrypted': isEncrypted ? 'aes-256-gcm' : 'none',
      },
    }));
    console.log(`[Backup R2] Uploaded backup object: s3://${R2_BUCKET}/${objectKey}`);

    // Upload checksum file
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: checksumKey,
      Body: Buffer.from(`${checksum}  ${finalFilename}\n`, 'utf8'),
      ContentType: 'text/plain',
    }));
    console.log(`[Backup R2] Uploaded checksum object: s3://${R2_BUCKET}/${checksumKey}`);

    // Enforce retention policy on R2
    console.log(`[Backup R2] Checking R2 retention (retaining last ${RETENTION_DAYS} days)...`);
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: 'database/daily/evara-prod-',
    }));

    if (listRes.Contents && listRes.Contents.length > 0) {
      const now = Date.now();
      const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

      for (const obj of listRes.Contents) {
        if (!obj.LastModified) continue;
        const ageMs = now - new Date(obj.LastModified).getTime();
        if (ageMs > maxAgeMs) {
          console.log(`[Backup R2 Retention] Deleting expired object: ${obj.Key} (Age: ${(ageMs / 86400000).toFixed(1)} days)`);
          await s3.send(new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: obj.Key,
          }));
        }
      }
    }

    console.log('[Backup R2] R2 offsite backup and retention completed successfully.');
  } else {
    console.log('[Backup R2] NOTICE: R2 credentials not configured. Backup stored locally only.');
  }

  return {
    filename: finalFilename,
    sizeBytes: finalPayload.length,
    checksum,
    isEncrypted,
  };
}

runBackup()
  .then(res => {
    console.log(JSON.stringify({ status: 'SUCCESS', ...res }));
  })
  .catch(err => {
    console.error('[Backup R2] FATAL ERROR:', err.message);
    process.exit(1);
  });
