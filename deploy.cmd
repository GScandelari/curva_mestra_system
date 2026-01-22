@echo off
REM Script de Deploy para Windows - Curva Mestra
REM Correções de segurança CVE-2025-55182 (React2Shell)

echo === Deploy Curva Mestra - Correções de Segurança ===
echo.

REM 1. Verificar Node.js
echo 1. Verificando Node.js...
node --version
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js não encontrado!
    exit /b 1
)

REM 2. Verificar Next.js
echo.
echo 2. Verificando Next.js...
npx next --version
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Next.js não encontrado!
    exit /b 1
)

REM 3. Verificar Firebase CLI
echo.
echo 3. Verificando Firebase CLI...
firebase --version
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Firebase CLI não encontrado!
    exit /b 1
)

REM 4. Limpar build anterior
echo.
echo 4. Limpando build anterior...
if exist .next (
    rmdir /s /q .next
    echo Build anterior removido
)

REM 5. Build do Next.js
echo.
echo 5. Building Next.js...
set NODE_ENV=production
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Build falhou!
    exit /b 1
)

REM 6. Deploy Firebase
echo.
echo 6. Fazendo deploy no Firebase...
call firebase deploy --only hosting
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Deploy falhou!
    exit /b 1
)

echo.
echo === Deploy concluído com sucesso! ===
echo Versões deployadas:
echo   - React: 19.2.3 (CVE-2025-55182 corrigido)
echo   - Next.js: 15.5.9 (CVE-2025-66478, CVE-2025-55184, CVE-2025-55183, CVE-2025-67779 corrigidos)
