/**
 * Evara Zero-Cost Encrypted Database Restore & Rehearsal Tool
 * 
 * Reads encrypted backup from C:\Users\pulki\Evara-Backups (or local mirror),
 * validates SHA-256 integrity checksum, decrypts AES-256-GCM,
 * decompresses gzip (Level 9), and replays SQL into a target database
 * to verify end-to-end recovery readiness.
 * 
 * NO credit cards, NO cloud billing, and NO public artifacts required.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const mysql = require(path.join(projectRoot, 'node_modules/mysql2/promise'));

const PRIMARY_BACKUP_DIR = process.env.EVARA_BACKUP_DIR || 'C:\\Users\\pulki\\Evara-Backups';
const LOCAL_MIRROR_DIR = path.join(projectRoot, 'backups');

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
  console.error('[Restore] ERROR: DATABASE_URL not found in environment or .env');
  process.exit(1);
}

function getEncryptionKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

async function runRestore() {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
  const targetDb = args.find(a => a.startsWith('--target-db='))?.split('=')[1] || 'evara_restore_rehearsal';
  const dropAfter = args.includes('--drop-after');

  console.log(`[Restore] Initiating restore / rehearsal workflow for target database: ${targetDb}...`);

  let backupFilePath = '';
  if (fileArg) {
    backupFilePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(projectRoot, fileArg);
  } else {
    // Check primary dedicated backup directory first
    let files = [];
    if (fs.existsSync(PRIMARY_BACKUP_DIR)) {
      files = fs.readdirSync(PRIMARY_BACKUP_DIR).filter(f => f.endsWith('.sql.gz.enc') || f.endsWith('.sql.gz') || f.endsWith('.sql'));
      if (files.length > 0) {
        files.sort().reverse();
        backupFilePath = path.join(PRIMARY_BACKUP_DIR, files[0]);
      }
    }
    // Fallback to local mirror if needed
    if (!backupFilePath && fs.existsSync(LOCAL_MIRROR_DIR)) {
      files = fs.readdirSync(LOCAL_MIRROR_DIR).filter(f => f.endsWith('.sql.gz.enc') || f.endsWith('.sql.gz') || f.endsWith('.sql'));
      if (files.length > 0) {
        files.sort().reverse();
        backupFilePath = path.join(LOCAL_MIRROR_DIR, files[0]);
      }
    }
  }

  if (!backupFilePath || !fs.existsSync(backupFilePath)) {
    console.error(`[Restore] ERROR: No valid backup file found in ${PRIMARY_BACKUP_DIR} or ${LOCAL_MIRROR_DIR}`);
    process.exit(1);
  }

  const filename = path.basename(backupFilePath);
  console.log(`[Restore] Using backup source: ${backupFilePath}`);
  const payload = fs.readFileSync(backupFilePath);
  console.log(`[Restore] Loaded backup file (${(payload.length / 1024).toFixed(2)} KB).`);

  // 1. Check SHA-256 checksum if .sha256 file exists
  const checksumFile = `${backupFilePath}.sha256`;
  if (fs.existsSync(checksumFile)) {
    const expectedChecksum = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
    const actualChecksum = crypto.createHash('sha256').update(payload).digest('hex');
    if (expectedChecksum.toLowerCase() === actualChecksum.toLowerCase()) {
      console.log(`[Restore] Checksum verification PASSED: ${actualChecksum}`);
    } else {
      console.error(`[Restore] ERROR: Checksum mismatch! Expected ${expectedChecksum}, got ${actualChecksum}`);
      process.exit(1);
    }
  } else {
    console.log(`[Restore] Note: No companion .sha256 file found for checksum verification.`);
  }

  // 2. Decrypt AES-256-GCM if .enc extension
  let compressedBuffer;
  if (filename.endsWith('.enc')) {
    if (!ENCRYPTION_KEY) {
      console.error('[Restore] ERROR: BACKUP_ENCRYPTION_KEY or SESSION_SECRET required to decrypt.');
      process.exit(1);
    }
    console.log('[Restore] Decrypting AES-256-GCM payload...');
    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);

    const key = getEncryptionKey(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    compressedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('[Restore] AES-256-GCM payload decrypted & authentication tag verified.');
  } else {
    compressedBuffer = payload;
  }

  // 3. Decompress gzip if .gz extension
  let sqlText;
  if (filename.includes('.gz')) {
    console.log('[Restore] Decompressing gzip payload...');
    sqlText = zlib.gunzipSync(compressedBuffer).toString('utf8');
  } else {
    sqlText = compressedBuffer.toString('utf8');
  }

  const rawKb = (Buffer.byteLength(sqlText, 'utf8') / 1024).toFixed(2);
  console.log(`[Restore] Reconstructed SQL dump: ${rawKb} KB.`);

  // 4. Replay into target database
  const conn = await mysql.createConnection(DATABASE_URL);
  try {
    console.log(`[Restore] Provisioning temporary rehearsal database: \`${targetDb}\`...`);
    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
    await conn.changeUser({ database: targetDb });

    console.log(`[Restore] Replaying SQL dump into \`${targetDb}\`...`);
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
    console.log(`[Restore] Replay complete. Tables found in \`${targetDb}\`: ${tables.length} (${tables.join(', ')})`);

    // Verify row counts across key tables
    const tableCounts = {};
    for (const tbl of tables) {
      const [countRows] = await conn.execute(`SELECT COUNT(*) as count FROM \`${tbl}\``);
      tableCounts[tbl] = countRows[0].count;
    }
    console.log('[Restore] Table record counts:', JSON.stringify(tableCounts));

    if (dropAfter) {
      console.log(`[Restore] Cleaning up rehearsal database: \`${targetDb}\`...`);
      await conn.execute(`DROP DATABASE \`${targetDb}\``);
      console.log(`[Restore] Cleaned up \`${targetDb}\`.`);
    }

    return {
      status: 'SUCCESS',
      sourceFile: filename,
      tablesRestored: tables.length,
      targetDb,
      rehearsalPassed: true,
      cleanedUp: dropAfter,
      tableCounts
    };
  } finally {
    await conn.end();
  }
}

runRestore()
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(err => {
    console.error('[Restore] FATAL ERROR:', err.message);
    process.exit(1);
  });
