@echo off
title Aki Coach
cd /d "%~dp0"

echo.
echo   AKI COACH
echo   =========
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js nao encontrado. Instale em https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo   Instalando dependencias...
  call npm install
  echo.
)

if not exist .env (
  echo   Arquivo .env nao encontrado.
  echo   Copie .env.example para .env e cole sua RIOT_KEY.
  pause
  exit /b 1
)

echo   Iniciando servidor...
echo.
node server.js
pause