# Database Backup & Recovery Guide — Evara

This guide provides a free, self-managed backup and disaster recovery strategy for Evara without requiring any paid backup software or SaaS subscription.

---

## 1. Quick Backup (Database Dump)

### Option A: Using `mysqldump` (Local MySQL or Managed TiDB)

#### Windows (PowerShell):
```powershell
# Set variables
$DB_HOST = "localhost"
$DB_PORT = "3306"
$DB_USER = "root"
$DB_NAME = "evara"
$TIMESTAMP = (Get-Date -Format "yyyy-MM-dd_HH-mm-ss")
$BACKUP_FILE = "backup_evara_$TIMESTAMP.sql"

# Execute dump
mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p --single-transaction --quick --routines --triggers $DB_NAME > $BACKUP_FILE

Write-Host "Backup completed: $BACKUP_FILE"
```

#### Linux / macOS (Bash):
```bash
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_NAME="evara"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="backup_evara_${TIMESTAMP}.sql"

mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p \
  --single-transaction --quick --routines --triggers "$DB_NAME" > "$BACKUP_FILE"

echo "Backup completed: $BACKUP_FILE"
```

---

## 2. Docker Container Backup

If running Evara with the local `docker-compose.yml` stack:

#### Backup:
```bash
docker exec -i evara_mysql mysqldump -u root -proot_password --single-transaction evara_db > evara_docker_backup.sql
```

#### Restore:
```bash
docker exec -i evara_mysql mysql -u root -proot_password evara_db < evara_docker_backup.sql
```

---

## 3. Database Restoration

To restore your database from a SQL backup file:

### Windows (PowerShell):
```powershell
Get-Content backup_evara_YYYY-MM-DD_HH-mm-ss.sql | mysql -h localhost -P 3306 -u root -p evara
```

### Linux / macOS (Bash):
```bash
mysql -h localhost -P 3306 -u root -p evara < backup_evara_YYYY-MM-DD_HH-mm-ss.sql
```

---

## 4. Post-Restore Data Integrity Validation

After restoring, verify table existence and row counts:

```sql
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'userProfiles', COUNT(*) FROM userProfiles
UNION ALL
SELECT 'periodLogs', COUNT(*) FROM periodLogs
UNION ALL
SELECT 'symptomLogs', COUNT(*) FROM symptomLogs
UNION ALL
SELECT 'wellnessLogs', COUNT(*) FROM wellnessLogs
UNION ALL
SELECT 'reminders', COUNT(*) FROM reminders
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions;
```

---

## 5. Storage Directory Backup

For local file uploads stored in `.storage/uploads/`:

#### Windows (PowerShell):
```powershell
Compress-Archive -Path .storage\uploads\* -DestinationPath "uploads_backup_$(Get-Date -Format 'yyyy-MM-dd').zip"
```

#### Linux / macOS (Bash):
```bash
tar -czvf "uploads_backup_$(date +'%Y-%m-%d').tar.gz" .storage/uploads/
```
