@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo  1-Click Screenshot Capture
echo ==========================================
echo.

REM ===== Step 1: Launch DevTools =====
echo [1/3] Launching DevTools...
start "DevTools" /MIN cmd /c "node launch-devtools.js"

echo       Waiting for DevTools process...
:wait_devtools
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "exit (Get-Process wechatdevtools -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count)" >nul 2>nul
if %ERRORLEVEL% equ 0 goto wait_devtools
echo       DevTools ready.

echo.

REM ===== Step 2: Activate DevTools window =====
echo [2/3] Activating DevTools window to foreground...

> "%TEMP%\activate_devtools.ps1" echo $p=Get-Process wechatdevtools -ErrorAction SilentlyContinue
>> "%TEMP%\activate_devtools.ps1" echo if($p^){
>> "%TEMP%\activate_devtools.ps1" echo   $h=$p[0].MainWindowHandle
>> "%TEMP%\activate_devtools.ps1" echo   $sig='[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);'
>> "%TEMP%\activate_devtools.ps1" echo   $t=Add-Type -MemberDefinition $sig -Name 'W32' -Namespace Win32 -PassThru
>> "%TEMP%\activate_devtools.ps1" echo   [Win32.W32]::ShowWindowAsync($h,9^) ^| Out-Null
>> "%TEMP%\activate_devtools.ps1" echo   Start-Sleep -Milliseconds 500
>> "%TEMP%\activate_devtools.ps1" echo   [Win32.W32]::SetForegroundWindow($h^) ^| Out-Null
>> "%TEMP%\activate_devtools.ps1" echo   Start-Sleep -Milliseconds 1000
>> "%TEMP%\activate_devtools.ps1" echo   Write-Host 'Window activated'
>> "%TEMP%\activate_devtools.ps1" echo }

powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\activate_devtools.ps1"
del "%TEMP%\activate_devtools.ps1" 2>nul
echo       DevTools window activated.

echo.

REM ===== Step 3: Screenshot via PowerShell =====
echo [3/3] Capturing screenshot...

set OUT_DIR=%CD%\..\miniprogram\tests\reports\first-screen
set RUN_ID=capture_3step_%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set RUN_ID=%RUN_ID: =0%
mkdir "%OUT_DIR%\%RUN_ID%" 2>nul

> "%TEMP%\capture_screen.ps1" echo Add-Type -AssemblyName System.Windows.Forms
>> "%TEMP%\capture_screen.ps1" echo Add-Type -AssemblyName System.Drawing
>> "%TEMP%\capture_screen.ps1" echo $w=[Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
>> "%TEMP%\capture_screen.ps1" echo $h=[Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
>> "%TEMP%\capture_screen.ps1" echo $bmp=New-Object Drawing.Bitmap $w,$h
>> "%TEMP%\capture_screen.ps1" echo $g=[Drawing.Graphics]::FromImage($bmp^)
>> "%TEMP%\capture_screen.ps1" echo $g.CopyFromScreen(0,0,0,0,$bmp.Size^)
>> "%TEMP%\capture_screen.ps1" echo $bmp.Save('%OUT_DIR%\%RUN_ID%\01-album-home.png',[Drawing.Imaging.ImageFormat]::Png^)
>> "%TEMP%\capture_screen.ps1" echo $g.Dispose()
>> "%TEMP%\capture_screen.ps1" echo $bmp.Dispose()
>> "%TEMP%\capture_screen.ps1" echo Write-Host 'Screenshot saved'

powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\capture_screen.ps1"
del "%TEMP%\capture_screen.ps1" 2>nul

echo.
echo ===== Done =====
echo.
pause