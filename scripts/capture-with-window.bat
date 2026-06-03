@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo  1-Click Screenshot Capture
echo  Single Node.js process:
echo    1. Launch DevTools (visible)
echo    2. Activate window
echo    3. Connect + navigate + mp.screenshot
echo  Output: simulator content (390x844)
echo ==========================================
echo.

node capture-automated.js

echo.
echo Press any key to exit.
pause >nul