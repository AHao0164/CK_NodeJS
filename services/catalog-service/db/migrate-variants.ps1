# Migration script to add product_variants and variant_inventory tables
# Usage: .\migrate-variants.ps1

param(
    [string]$MysqlHost = "localhost",
    [int]$MysqlPort = 3306,
    [string]$MysqlUser = "root",
    [string]$MysqlPassword = "rootpw"
)

Write-Host "Running migration: product_variants and variant_inventory tables..." -ForegroundColor Cyan
Write-Host "Host: ${MysqlHost}:${MysqlPort}"

$containerName = "laptop-mysql-1"
$useDocker = docker ps --filter "name=$containerName" --format "{{.Names}}" 2>$null

if ($useDocker -eq $containerName) {
    Write-Host "Using Docker container: $containerName" -ForegroundColor Green
    Get-Content migrate-variants.sql | docker exec -i $containerName mysql -u$MysqlUser -p$MysqlPassword --default-character-set=utf8mb4
} else {
    Write-Host "Using local MySQL: ${MysqlHost}:${MysqlPort}" -ForegroundColor Green
    Get-Content migrate-variants.sql | mysql -h $MysqlHost -P $MysqlPort -u$MysqlUser -p$MysqlPassword --default-character-set=utf8mb4
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed to run migration" -ForegroundColor Red
    exit 1
}
