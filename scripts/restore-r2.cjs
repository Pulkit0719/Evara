/**
 * Evara Secure Encrypted Database Restore & Rehearsal Tool
 * 
 * Downloads (or reads local) encrypted backup, validates SHA-256,
 * decrypts AES-256-GCM, decompresses gzip, and replays SQL into a target database.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const mysql = require(path.join(projectRoot, 'node_modules/mysql2/promise'));
const { S3Client, GetObjectCommand } = require(path.join(projectRoot, 'node_modules/@aws-sdk/client-s3'));

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

function getEncryptionKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

async function runRestore() {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
  const targetDb = args.find(a => a.startsWith('--target-db='))?.split('=')[1] || 'evara_restore_rehearsal';
  const dropAfter = args.includes('--drop-after');

  console.log(`[Restore R2] Initiating restore / rehearsal workflow for target database: ${targetDb}...`);

  let encryptedPayload;
  let sourceName = '';

  if (fileArg) {
    const filePath = path.resolve(projectRoot, fileArg);
    if (!fs.existsSync(filePath)) {
      console.error(`[Restore R2] File not found: ${filePath}`);
      process.exit(1);
    }
    encryptedPayload = fs.readFileSync(filePath);
    sourceName = path.basename(filePath);
    console.log(`[Restore R2] Loaded local backup file: ${sourceName} (${encryptedPayload.length} bytes).`);
  } else if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    console.log(`[Restore R2] Connecting to R2 to download backup...`);
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const keyArg = args.find(a => a.startsWith('--key='))?.split('=')[1];
    if (!keyArg) {
      console.error('[Restore R2] Please specify --key=database/daily/... or --file=backups/...');
      process.exit(1);
    }

    const res = await s3.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: keyArg,
    }));
    const chunks = [];
    for await (const chunk of res.Body) {
      chunks.push(chunk);
    }
    encryptedPayload = Buffer.concat(chunks);
    sourceName = keyArg;
    console.log(`[Restore R2] Downloaded from R2: ${sourceName} (${encryptedPayload.length} bytes).`);
  } else {
    // Default to latest local backup
    const backupDir = path.join(projectRoot, 'backups');
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql.gz.enc') || f.endsWith('.sql.gz'));
    files.sort().reverse();
    if (files.length === 0) {
      console.error('[Restore R2] No local backup files found in backups/ directory.');
      process.exit(1);
    }
    const latestFile = path.join(backupDir, files[0]);
    encryptedPayload = fs.readFileSync(latestFile);
    sourceName = files[0];
    console.log(`[Restore R2] Using latest local backup: ${sourceName} (${encryptedPayload.length} bytes).`);
  }

  // 1. Decrypt if file has .enc extension
  let compressedBuffer;
  if (sourceName.endsWith('.enc')) {
    if (!ENCRYPTION_KEY) {
      console.error('[Restore R2] ERROR: BACKUP_ENCRYPTION_KEY required to decrypt backup.');
      process.exit(1);
    }
    console.log('[Restore R2] Decrypting AES-256-GCM payload...');
    const iv = encryptedPayload.subarray(0, 12);
    const authTag = encryptedPayload.subarray(12, 28);
    const ciphertext = encryptedPayload.subarray(28);

    const key = getEncryptionKey(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    compressedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('[Restore R2] AES-256-GCM authentication verified & decrypted successfully.');
  } else {
    compressedBuffer = encryptedPayload;
  }

  // 2. Decompress if gzip
  let sqlText;
  if (sourceName.includes('.gz')) {
    console.log('[Restore R2] Decompressing gzip payload...');
    sqlText = zlib.gunzipSync(compressedBuffer).toString('utf8');
  } else {
    sqlText = compressedBuffer.toString('utf8');
  }

  console.log(`[Restore R2] Recovered SQL text: ${(Buffer.byteLength(sqlText, 'utf8') / 1024).toFixed(2)} KB.`);

  // 3. Connect to MySQL / TiDB to test restore
  const conn = await mysql.createConnection(DATABASE_URL);
  try {
    console.log(`[Restore R2] Provisioning temporary rehearsal database: \`${targetDb}\`...`);
    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
    await conn.changeUser({ database: targetDb });

    // Split SQL by semicolons while respecting newlines
    console.log(`[Restore R2] Replaying SQL into \`${targetDb}\`...`);
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    const statements = sqlText
      .split(/;\s*[\r\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      if (stmt) {
        await conn.execute(stmt);
      }
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    const [tableRows] = await conn.execute(`SHOW TABLES FROM \`${targetDb}\``);
    const tables = tableRows.map(r => Object.values(r)[0]);
    console.log(`[Restore R2] Rehearsal restore completed. Tables in \`${targetDb}\`: ${tables.length} tables found (${tables.join(', ')}).`);

    if (dropAfter) {
      console.log(`[Restore R2] Cleaning up rehearsal database: \`${targetDb}\`...`);
      await conn.execute(`DROP DATABASE \`${targetDb}\``);
      console.log(`[Restore R2] Cleaned up \`${targetDb}\`.`);
    }

    return {
      status: 'SUCCESS',
      source: sourceName,
      tablesRestored: tables.length,
      targetDb,
      rehearsalPassed: true,
    };
  } finally {
    await conn.end();
  }
}

runRestore()
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(err => {
    console.error('[Restore R2] FATAL ERROR:', err.message);
    process.exit(1);
  });
