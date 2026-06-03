@echo off
chcp 65001 >nul
REM ==========================================
REM WeChat DevTools Launcher - Automation Mode
REM Double-click to open DevTools with:
REM   HTTP port: 9421
REM   WS automation port: 9420
REM   Window visible (screenshot ready)
REM ==========================================

set CLI_PATH=E:\ProgramData\Tencent\微信web开发者工具\cli.bat
set PROJECT_PATH=D:\code\yuanBabyGrowthDiary\miniprogram

echo Starting WeChat DevTools (automation mode)...
echo Project: %PROJECT_PATH%
echo HTTP port: 9421  WS port: 9420
echo.

"%CLI_PATH%" auto --port 9421 --auto-port 9420 --project "%PROJECT_PATH%"

echo.
echo DevTools started. Wait for project compilation to complete...
echo Port 9420 is ready for automation connection.
pause