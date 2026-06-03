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

echo       Waiting for automation port 9420...

:wait_port
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try{$s=New-Object Net.Sockets.TcpClient;$s.ConnectAsync('127.0.0.1',9420).Wait(2000);if($s.Connected){$s.Close();exit 0}else{$s.Close();exit 1}}catch{exit 1}" >nul 2>nul
if %ERRORLEVEL% neq 0 goto wait_port
echo       Port 9420 ready.

echo.

REM ===== Step 2: Activate DevTools window =====
echo [2/3] Activating DevTools window...

> "%TEMP%\activate_devtools.ps1" echo $p=Get-Process wechatdevtools -ErrorAction SilentlyContinue
>>"%TEMP%\activate_devtools.ps1" echo if($p^){
>>"%TEMP%\activate_devtools.ps1" echo   $h=$p[0].MainWindowHandle
>>"%TEMP%\activate_devtools.ps1" echo   $sig='[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);'
>>"%TEMP%\activate_devtools.ps1" echo   $t=Add-Type -MemberDefinition $sig -Name 'W32' -Namespace Win32 -PassThru
>>"%TEMP%\activate_devtools.ps1" echo   [Win32.W32]::ShowWindowAsync($h,9^) ^| Out-Null
>>"%TEMP%\activate_devtools.ps1" echo   Start-Sleep -Milliseconds 500
>>"%TEMP%\activate_devtools.ps1" echo   [Win32.W32]::SetForegroundWindow($h^) ^| Out-Null
>>"%TEMP%\activate_devtools.ps1" echo   Start-Sleep -Milliseconds 1500
>>"%TEMP%\activate_devtools.ps1" echo   if($h -ne 0^){Write-Host 'Window activated'}else{Write-Host 'Window NOT found'}

for /f "tokens=*" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\activate_devtools.ps1"') do set ACTIVATE_RESULT=%%a
del "%TEMP%\activate_devtools.ps1" 2>nul
echo       %ACTIVATE_RESULT%.

echo.

REM ===== Step 3: Screenshot via PowerShell =====
echo [3/3] Capturing screenshot...

set OUT_DIR=%CD%\..\miniprogram\tests\reports\first-screen
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"') do set RUN_ID=capture_3step_%%i

> "%TEMP%\capture_screen.ps1" echo Add-Type -AssemblyName System.Windows.Forms
>>"%TEMP%\capture_screen.ps1" echo Add-Type -AssemblyName System.Drawing
>>"%TEMP%\capture_screen.ps1" echo $out=[IO.Path]::GetFullPath('%OUT_DIR%\%RUN_ID%')
>>"%TEMP%\capture_screen.ps1" echo [IO.Directory]::CreateDirectory($out^) ^| Out-Null
>>"%TEMP%\capture_screen.ps1" echo $w=[Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
>>"%TEMP%\capture_screen.ps1" echo $h=[Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
>>"%TEMP%\capture_screen.ps1" echo $bmp=New-Object Drawing.Bitmap $w,$h
>>"%TEMP%\capture_screen.ps1" echo $g=[Drawing.Graphics]::FromImage($bmp^)
>>"%TEMP%\capture_screen.ps1" echo $g.CopyFromScreen(0,0,0,0,$bmp.Size^)
>>"%TEMP%\capture_screen.ps1" echo $path=[IO.Path]::Combine($out,'01-album-home.png')
>>"%TEMP%\capture_screen.ps1" echo try{$bmp.Save($path,[Drawing.Imaging.ImageFormat]::Png^);Write-Host ('Saved: '+$path)}catch{Write-Host ('ERROR: '+$_.Exception.Message^)}
>>"%TEMP%\capture_screen.ps1" echo $g.Dispose()
>>"%TEMP%\capture_screen.ps1" echo $bmp.Dispose()

for /f "tokens=*" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\capture_screen.ps1"') do set SCREENSHOT_RESULT=%%a
del "%TEMP%\capture_screen.ps1" 2>nul
echo       %SCREENSHOT_RESULT%.

echo.
echo ===== Done =====
echo.
pause