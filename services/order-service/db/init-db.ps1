# Order Service - Standalone Database Setup (PowerShell)
# Usage: .\init-db.ps1

param(
    [string]$MysqlHost = "localhost",
    [int]$MysqlPort = 3306,
    [string]$MysqlUser = "root",
    [string]$MysqlPassword = "rootpw"
)

Write-Host "🔧 Initializing Order Service Database..." -ForegroundColor Cyan

$containerName = "laptop-mysql-1"
$useDocker = docker ps --filter "name=$containerName" --format "{{.Names}}" 2>$null

if ($useDocker -eq $containerName) {
    Get-Content db\schema.sql | docker exec -i $containerName mysql -u$MysqlUser -p$MysqlPassword --default-character-set=utf8mb4
} else {
    Get-Content db\schema.sql | mysql -h $MysqlHost -P $MysqlPort -u$MysqlUser -p$MysqlPassword --default-character-set=utf8mb4
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Order Service database initialized successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to initialize database" -ForegroundColor Red
    exit 1
}
