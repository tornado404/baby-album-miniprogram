@echo off
cd /d "%~dp0"
echo ==========================================
echo  One-Click Screenshot Capture
echo  Launches DevTools, activates window,
echo  navigates to album_home, takes screenshot.
echo ==========================================
echo.
node capture-automated.js
echo.
pause