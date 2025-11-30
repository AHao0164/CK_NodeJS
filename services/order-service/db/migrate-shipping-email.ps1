# Migration: Add shipping_email column to orders table
# PowerShell script to run migration

param(
    [string]$MysqlHost = "localhost",
    [int]$MysqlPort = 3306,
    [string]$MysqlUser = "root",
    [string]$MysqlPassword = "rootpw",
    [string]$Database = "order_db"
)

Write-Host "🔧 Running migration: Add shipping_email column..." -ForegroundColor Cyan

$containerName = "ck_nodejs-mysql-1"
$useDocker = docker ps --filter "name=$containerName" --format "{{.Names}}" 2>$null

if ($useDocker -eq $containerName) {
    Write-Host "📦 Using Docker container: $containerName" -ForegroundColor Green
    Get-Content "$PSScriptRoot/migrate-shipping-email.sql" | docker exec -i $containerName mysql -u$MysqlUser -p$MysqlPassword $Database
} else {
    Write-Host "📦 Using local MySQL: $MysqlHost:$MysqlPort" -ForegroundColor Green
    $sqlContent = Get-Content "$PSScriptRoot/migrate-shipping-email.sql" -Raw
    $sqlContent | mysql -h $MysqlHost -P $MysqlPort -u$MysqlUser -p$MysqlPassword $Database
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Migration failed" -ForegroundColor Red
    exit 1
}

