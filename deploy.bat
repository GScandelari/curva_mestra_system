@echo off
echo 🚀 Deploy Rápido - Curva Mestra System
echo.

REM Verificar se há mensagem de commit
if "%~1"=="" (
    set "commit_msg=chore: Deploy automático - %date% %time%"
) else (
    set "commit_msg=%~1"
)

echo 📋 Mensagem do commit: %commit_msg%
echo.

REM Git operations
echo 1️⃣ Adicionando alterações...
git add .

echo 2️⃣ Fazendo commit...
git commit -m "%commit_msg%"

echo 3️⃣ Enviando para repositório...
git push origin main

REM Build frontend
echo 4️⃣ Fazendo build do frontend...
cd frontend
npm run build
cd ..

REM Deploy to Firebase
echo 5️⃣ Fazendo deploy no Firebase...
firebase deploy --only "functions,hosting" --project curva-mestra

echo.
echo ✅ Deploy completo!
echo 🌐 URL: https://curva-mestra.web.app
echo.
pause