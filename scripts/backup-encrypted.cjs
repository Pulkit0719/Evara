/**
 * Evara Zero-Cost Encrypted Database Backup & Offsite Sync Tool
 * 
 * 1. Connects to TiDB Cloud production over TLS 1.3
 * 2. Dumps database schema & records (parent-first order)
 * 3. Compresses using gzip (Level 9)
 * 4. Encrypts client-side using AES-256-GCM envelope [IV][AuthTag][Ciphertext]
 * 5. Generates SHA-256 integrity checksum (.sha256 companion file)
 * 6. Stores primary copy in dedicated local storage: C:\Users\pulki\Evara-Backups
 * 7. Automatically copies .enc and .sha256 to OneDrive: C:\Users\pulki\OneDrive\Evara-Backups
 *    (NEVER copies unencrypted .sql or .sql.gz files)
 * 8. Verifies destination existence, exact size match, and SHA-256 integrity match
 * 9. Enforces 7-day retention while guaranteeing the latest backup is NEVER deleted
 * 
 * NO credit cards, NO cloud billing, and NO public artifacts required.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const mysql = require(path.join(projectRoot, 'node_modules/mysql2/promise'));

// Dedicated backup storage directories (outside git repository)
const PRIMARY_BACKUP_DIR = process.env.EVARA_BACKUP_DIR || 'C:\\Users\\pulki\\Evara-Backups';
const ONEDRIVE_BACKUP_DIR = process.env.ONEDRIVE_BACKUP_DIR || 'C:\\Users\\pulki\\OneDrive\\Evara-Backups';
const LOCAL_MIRROR_DIR = path.join(projectRoot, 'backups');

const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);

// Load environment variables safely
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

if (!DATABASE_URL) {
  console.error('[Backup] ERROR: DATABASE_URL not found in environment or .env');
  process.exit(1);
}

function getEncryptionKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

async function runBackup() {
  console.log('[Backup] Initiating secure encrypted database backup...');
  console.log(`[Backup] Primary destination: ${PRIMARY_BACKUP_DIR}`);
  console.log(`[Backup] Offsite OneDrive destination: ${ONEDRIVE_BACKUP_DIR}`);

  // Ensure directories exist
  if (!fs.existsSync(PRIMARY_BACKUP_DIR)) {
    fs.mkdirSync(PRIMARY_BACKUP_DIR, { recursive: true });
  }
  if (!fs.existsSync(ONEDRIVE_BACKUP_DIR)) {
    fs.mkdirSync(ONEDRIVE_BACKUP_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_MIRROR_DIR)) {
    fs.mkdirSync(LOCAL_MIRROR_DIR, { recursive: true });
  }

  // 1. Parse DB and connect
  let parsed;
  try {
    parsed = new URL(DATABASE_URL.replace(/^mysql:\/\//, 'http://'));
  } catch (e) {
    console.error('[Backup] ERROR: Invalid DATABASE_URL format.');
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

    // Parent-first order: users and migrations before child foreign key tables
    tables.sort((a, b) => {
      if (a === 'users') return -1;
      if (b === 'users') return 1;
      if (a === '__drizzle_migrations') return -1;
      if (b === '__drizzle_migrations') return 1;
      return a.localeCompare(b);
    });

    console.log(`[Backup] Dumping ${tables.length} tables: ${tables.join(', ')}`);

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
    lines.push(`-- Backup dump completed successfully.`);
    sqlText = lines.join('\n');
  } finally {
    await conn.end();
  }

  const rawSize = Buffer.byteLength(sqlText, 'utf8');
  console.log(`[Backup] Raw SQL size: ${(rawSize / 1024).toFixed(2)} KB.`);

  // 2. Gzip compression (Level 9)
  const compressedBuffer = zlib.gzipSync(Buffer.from(sqlText, 'utf8'), { level: 9 });
  console.log(`[Backup] Gzip compressed: ${(compressedBuffer.length / 1024).toFixed(2)} KB (Ratio: ${(compressedBuffer.length / rawSize * 100).toFixed(1)}%).`);

  // 3. Client-Side AES-256-GCM Encryption
  const key = getEncryptionKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(compressedBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Envelope format: [12 bytes IV][16 bytes AuthTag][Ciphertext]
  const finalPayload = Buffer.concat([iv, authTag, encrypted]);
  const filename = `${baseName}.sql.gz.enc`;
  console.log(`[Backup] AES-256-GCM encrypted: ${(finalPayload.length / 1024).toFixed(2)} KB.`);

  // 4. SHA-256 Checksum
  const checksum = crypto.createHash('sha256').update(finalPayload).digest('hex');
  const checksumContent = `${checksum}  ${filename}\n`;

  // 5. Write to Primary Dedicated Directory
  const primaryEncPath = path.join(PRIMARY_BACKUP_DIR, filename);
  const primaryShaPath = path.join(PRIMARY_BACKUP_DIR, `${filename}.sha256`);
  fs.writeFileSync(primaryEncPath, finalPayload);
  fs.writeFileSync(primaryShaPath, checksumContent);
  console.log(`[Backup] Saved to primary local storage: ${primaryEncPath}`);

  // 6. Write to Local Mirror Directory (git-ignored)
  const mirrorEncPath = path.join(LOCAL_MIRROR_DIR, filename);
  const mirrorShaPath = path.join(LOCAL_MIRROR_DIR, `${filename}.sha256`);
  fs.writeFileSync(mirrorEncPath, finalPayload);
  fs.writeFileSync(mirrorShaPath, checksumContent);
  console.log(`[Backup] Saved to local mirror: ${mirrorEncPath}`);

  // 7. Copy ONLY encrypted .enc and .sha256 to OneDrive (NEVER plaintext .sql or unencrypted .sql.gz)
  const oneDriveEncPath = path.join(ONEDRIVE_BACKUP_DIR, filename);
  const oneDriveShaPath = path.join(ONEDRIVE_BACKUP_DIR, `${filename}.sha256`);

  console.log(`[Backup] Syncing encrypted backup to OneDrive...`);
  fs.copyFileSync(primaryEncPath, oneDriveEncPath);
  fs.copyFileSync(primaryShaPath, oneDriveShaPath);

  // 8. Verify OneDrive synchronization integrity
  if (!fs.existsSync(oneDriveEncPath) || !fs.existsSync(oneDriveShaPath)) {
    throw new Error('[Backup] OneDrive synchronization failed: Destination files do not exist.');
  }

  const oneDriveSize = fs.statSync(oneDriveEncPath).size;
  if (oneDriveSize !== finalPayload.length) {
    throw new Error(`[Backup] OneDrive synchronization failed: Size mismatch (Expected ${finalPayload.length}, got ${oneDriveSize}).`);
  }

  const oneDriveData = fs.readFileSync(oneDriveEncPath);
  const oneDriveChecksum = crypto.createHash('sha256').update(oneDriveData).digest('hex');
  if (oneDriveChecksum.toLowerCase() !== checksum.toLowerCase()) {
    throw new Error(`[Backup] OneDrive synchronization failed: Checksum mismatch (Expected ${checksum}, got ${oneDriveChecksum}).`);
  }

  console.log(`[Backup] OneDrive verification PASSED: Size (${oneDriveSize} B) and SHA-256 match perfectly.`);

  // 9. Enforce 7-day retention safely (guaranteeing the latest valid backup is NEVER deleted)
  enforceRetention(PRIMARY_BACKUP_DIR);
  enforceRetention(ONEDRIVE_BACKUP_DIR);
  enforceRetention(LOCAL_MIRROR_DIR);

  return {
    status: 'SUCCESS',
    primaryPath: primaryEncPath,
    oneDrivePath: oneDriveEncPath,
    filename,
    sizeBytes: finalPayload.length,
    checksum,
    oneDriveVerified: true,
    encryption: 'AES-256-GCM',
    compression: 'gzip-level-9',
    retentionDays: RETENTION_DAYS
  };
}

/**
 * Enforce retention policy safely.
 * GUARANTEE: Never deletes the newest/latest valid backup, even if expired or on error.
 */
function enforceRetention(dir) {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);

    const backupFiles = files
      .filter(f => f.startsWith('evara-') && f.endsWith('.sql.gz.enc'))
      .map(f => {
        const fullPath = path.join(dir, f);
        return { name: f, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs); // Newest first

    // Always protect at least the latest backup from deletion
    if (backupFiles.length <= 1) {
      return;
    }

    const now = Date.now();
    const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // Evaluate older backups (index 1 and above)
    for (let i = 1; i < backupFiles.length; i++) {
      const backup = backupFiles[i];
      const ageMs = now - backup.mtimeMs;
      if (ageMs > maxAgeMs) {
        try {
          fs.unlinkSync(backup.fullPath);
          const shaPath = `${backup.fullPath}.sha256`;
          if (fs.existsSync(shaPath)) {
            fs.unlinkSync(shaPath);
          }
          console.log(`[Retention] Purged expired backup (${(ageMs / 86400000).toFixed(1)} days old) from ${dir}: ${backup.name}`);
        } catch (err) {
          console.warn(`[Retention] Warning: Could not purge ${backup.name}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.warn(`[Retention] Retention check encountered an issue in ${dir}, safely preserving backups:`, error.message);
  }
}

runBackup()
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(err => {
    console.error('[Backup] FATAL ERROR:', err.message);
    process.exit(1);
  });
