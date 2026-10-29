@echo off
setlocal
cd /d "%~dp0"
title Attendly — One-Command Docker Installer

call "%~dp0install.bat"
exit /b %errorlevel%
