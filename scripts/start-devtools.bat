@echo off
chcp 65001 >nul
title WeChat DevTools - E2E Automation

cd /d "E:\ProgramData\Tencent\微信web开发者工具"

echo ========================================
echo  WeChat DevTools - E2E Automation
echo  HTTP Port:     9421
echo  WebSocket Port: 9420
echo  Project:       D:\code\yuanBabyGrowthDiary\miniprogram
echo ========================================
echo.
echo Press Ctrl+C to stop this script.
echo.

:loop
call cli.bat auto --port 9421 --auto-port 9420 --project "D:\code\yuanBabyGrowthDiary\miniprogram"
echo.
echo [$(date +%%T)] DevTools exited, restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
