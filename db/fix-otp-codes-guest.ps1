# Migration script to fix otp_codes table for guest users (Docker support)
# Usage: .\fix-otp-codes-guest.ps1

param(
    [string]$MysqlHost = "localhost",
    [int]$MysqlPort = 3306,
    [string]$MysqlUser = "root",
    [string]$MysqlPassword = "rootpw",
    [string]$Database = "auth_db"
)

Write-Host "Running migration: Fix otp_codes table for guest users..." -ForegroundColor Cyan
Write-Host "Database: $Database" -ForegroundColor Cyan
Write-Host "Host: ${MysqlHost}:${MysqlPort}" -ForegroundColor Cyan

# Try to find MySQL container
$containerName = $null
$possibleNames = @("laptop-mysql-1", "mysql", "mysql-1", "mysql_db")
foreach ($name in $possibleNames) {
    $found = docker ps --filter "name=$name" --format "{{.Names}}" 2>$null
    if ($found -eq $name) {
        $containerName = $name
        break
    }
}

if ($containerName) {
    Write-Host "Using Docker container: $containerName" -ForegroundColor Green
    Get-Content fix-otp-codes-guest.sql | docker exec -i $containerName mysql -u$MysqlUser -p$MysqlPassword $Database --default-character-set=utf8mb4
} else {
    Write-Host "Using local MySQL: ${MysqlHost}:${MysqlPort}" -ForegroundColor Green
    Write-Host "   (No Docker MySQL container found, using local connection)" -ForegroundColor Yellow
    Get-Content fix-otp-codes-guest.sql | mysql -h $MysqlHost -P $MysqlPort -u$MysqlUser -p$MysqlPassword $Database --default-character-set=utf8mb4
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host "Guest users can now use COD OTP without errors" -ForegroundColor Green
} else {
    Write-Host "Failed to run migration" -ForegroundColor Red
    exit 1
}
