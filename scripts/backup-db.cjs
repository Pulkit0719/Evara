/**
 * Evara Automated Database Backup & Retention Tool
 * 
 * Safely dumps the production database schema and table data via TLS,
 * computes SHA-256 integrity checksums, and enforces retention policies.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Determine root directory
const projectRoot = path.resolve(__dirname, '..');
const mysql = require(path.join(projectRoot, 'node_modules/mysql2/promise'));

// Read DATABASE_URL from environment or local .env
let rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        rawUrl = line.trim().substring('DATABASE_URL='.length).trim();
        break;
      }
    }
  }
}

if (!rawUrl) {
  console.error('[Backup] ERROR: DATABASE_URL not found in environment or .env');
  process.exit(1);
}

const BACKUP_DIR = path.join(projectRoot, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Retention policy: 7 daily backups
const RETENTION_DAYS = 7;

async function runBackup() {
  console.log('[Backup] Initiating production database backup...');

  let parsed;
  try {
    parsed = new URL(rawUrl.replace(/^mysql:\/\//, 'http://'));
  } catch (e) {
    console.error('[Backup] ERROR: Invalid DATABASE_URL format');
    process.exit(1);
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (database !== 'evara') {
    console.warn(`[Backup] WARNING: Target database is '${database}', expected 'evara'.`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `evara-backup-${timestamp}.sql`;
  const backupFilePath = path.join(BACKUP_DIR, backupFilename);
  const checksumFilePath = path.join(BACKUP_DIR, `${backupFilename}.sha256`);

  const connection = await mysql.createConnection(rawUrl);

  try {
    const lines = [];
    lines.push(`-- ==============================================================`);
    lines.push(`-- Evara Production Database Backup`);
    lines.push(`-- Date: ${new Date().toISOString()}`);
    lines.push(`-- Database: ${database}`);
    lines.push(`-- Engine: TiDB / MySQL 8.0 Compatible`);
    lines.push(`-- ==============================================================\n`);
    lines.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

    // Get list of all tables
    const [tableRows] = await connection.execute('SHOW TABLES');
    const tableKey = Object.keys(tableRows[0] || {})[0];
    const tables = tableRows.map(r => r[tableKey]);

    console.log(`[Backup] Found ${tables.length} tables to backup: ${tables.join(', ')}`);

    for (const table of tables) {
      // Table schema
      const [createRows] = await connection.execute(`SHOW CREATE TABLE \`${table}\``);
      const createSql = createRows[0]['Create Table'];
      lines.push(`-- --------------------------------------------------------------`);
      lines.push(`-- Table: ${table}`);
      lines.push(`-- --------------------------------------------------------------`);
      lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
      lines.push(`${createSql};\n`);

      // Table data
      const [dataRows] = await connection.execute(`SELECT * FROM \`${table}\``);
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
            return connection.escape(String(val));
          });
          lines.push(`INSERT INTO \`${table}\` (${colList}) VALUES (${values.join(', ')});`);
        }
        lines.push('');
      }
    }

    lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    lines.push(`-- Backup completed successfully.`);

    const backupContent = lines.join('\n');
    fs.writeFileSync(backupFilePath, backupContent, 'utf8');

    // Compute SHA-256
    const hash = crypto.createHash('sha256').update(backupContent).digest('hex');
    fs.writeFileSync(checksumFilePath, `${hash}  ${backupFilename}\n`, 'utf8');

    console.log(`[Backup] Backup created successfully: ${backupFilename}`);
    console.log(`[Backup] Size: ${(backupContent.length / 1024).toFixed(2)} KB`);
    console.log(`[Backup] SHA-256: ${hash}`);

    // Enforce retention policy
    enforceRetention();

  } finally {
    await connection.end();
  }
}

function enforceRetention() {
  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (file.startsWith('evara-backup-') && (file.endsWith('.sql') || file.endsWith('.sha256'))) {
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      const ageMs = now - stat.mtimeMs;
      if (ageMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        console.log(`[Backup Retention] Purged backup older than ${RETENTION_DAYS} days: ${file}`);
      }
    }
  }
}

runBackup().catch(err => {
  console.error('[Backup] Unhandled error during backup:', err.message);
  process.exit(1);
});
