@echo off
REM ============================================
REM Auth Service - Standalone Database Setup (Windows)
REM ============================================

SET MYSQL_HOST=localhost
SET MYSQL_PORT=3306
SET MYSQL_USER=root
SET MYSQL_PASSWORD=rootpw

echo Initializing Auth Service Database...
echo Host: %MYSQL_HOST%:%MYSQL_PORT%

REM Run schema
echo Creating auth_db schema...
docker exec -i laptop-mysql-1 mysql -u%MYSQL_USER% -p%MYSQL_PASSWORD% --default-character-set=utf8mb4 < db\schema.sql

if %errorlevel% equ 0 (
  echo Auth Service database initialized successfully!
) else (
  echo Failed to initialize database
  exit /b 1
)
