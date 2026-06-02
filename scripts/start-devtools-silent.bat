@echo off
chcp 65001 >nul
title WeChat DevTools - E2E Automation
cd /d "E:\ProgramData\Tencent\微信web开发者工具"
:loop
call cli.bat auto --port 9421 --auto-port 9420 --project "D:\code\yuanBabyGrowthDiary\miniprogram"
timeout /t 2 /nobreak >nul
goto loop
