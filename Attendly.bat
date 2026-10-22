@echo off
setlocal
cd /d "%~dp0"
title Attendly Desktop

REM Ensure build exists for production performance
if not exist ".next\BUILD_ID" (
    echo [Attendly] Compiling production build...
    call npm run build
)

REM Launch the Electron Desktop application
if exist "node_modules\.bin\electron.cmd" (
    call node_modules\.bin\electron.cmd .
) else (
    call npx electron .
)
