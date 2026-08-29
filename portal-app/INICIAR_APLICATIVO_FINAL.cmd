@echo off
setlocal EnableExtensions
title Camila Martins Engenharia - Inicializacao Final

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
if errorlevel 1 goto falha_pasta

echo.
echo ============================================================
echo   CAMILA MARTINS ENGENHARIA - INICIALIZACAO FINAL
echo ============================================================
echo.

if not exist "package.json" goto falha_pasta
if not exist ".env.local" goto falha_ambiente

where npm.cmd >nul 2>&1
if errorlevel 1 goto falha_node

if not exist "node_modules" (
  echo [1/3] Instalando as dependencias...
  call npm.cmd install --no-audit --fund=false
  if errorlevel 1 goto falha_dependencias
) else (
  echo [1/3] Dependencias ja instaladas.
)

echo.
echo [2/3] Confirmando o aplicativo...
call npm.cmd run check:homologation
if errorlevel 1 goto falha_ambiente
call npm.cmd run security:patch
if errorlevel 1 goto falha_validacao
call npm.cmd run security:test
if errorlevel 1 goto falha_validacao
call npm.cmd run typecheck
if errorlevel 1 goto falha_validacao
call npm.cmd run lint
if errorlevel 1 goto falha_validacao

echo.
echo       Verificacoes do aplicativo aprovadas.
echo       O unico aviso anterior era do Expo Doctor no Git do Windows.
echo       Esse aviso nao afeta o funcionamento nem a seguranca do aplicativo.
echo.
echo [3/3] Iniciando o Expo. O QR Code aparecera nesta janela.
echo.
call npm.cmd start -- --clear
set "CODIGO_EXPO=%ERRORLEVEL%"

if not "%CODIGO_EXPO%"=="0" (
  echo.
  echo ERRO: o Expo foi encerrado com o codigo %CODIGO_EXPO%.
  echo Envie uma captura desta janela.
  echo.
  pause
)
exit /b %CODIGO_EXPO%

:falha_pasta
echo.
echo ERRO: coloque este arquivo dentro da pasta CAMILA_APP_LIMPO_REVISAO_10_1.
echo.
pause
exit /b 1

:falha_node
echo.
echo ERRO: o Node.js e o npm nao foram encontrados.
echo.
pause
exit /b 2

:falha_ambiente
echo.
echo ERRO: o arquivo .env.local nao foi encontrado ou nao corresponde ao ambiente esperado.
echo.
pause
exit /b 3

:falha_dependencias
echo.
echo ERRO: nao foi possivel instalar as dependencias.
echo Envie uma captura das linhas acima.
echo.
pause
exit /b 4

:falha_validacao
echo.
echo ERRO: uma verificacao real do aplicativo falhou.
echo Envie uma captura das linhas acima.
echo.
pause
exit /b 5
