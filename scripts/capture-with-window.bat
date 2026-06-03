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

REM ===== Step 3: Screenshot via PowerShell (capture DevTools window only) =====
echo [3/3] Capturing screenshot...

set OUT_DIR=%CD%\..\miniprogram\tests\reports\first-screen
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"') do set RUN_ID=capture_3step_%%i

> "%TEMP%\capture_screen.ps1" echo Add-Type -AssemblyName System.Windows.Forms
>>"%TEMP%\capture_screen.ps1" echo Add-Type -AssemblyName System.Drawing
>>"%TEMP%\capture_screen.ps1" echo Add-Type @"
>>"%TEMP%\capture_screen.ps1" echo   using System;
>>"%TEMP%\capture_screen.ps1" echo   using System.Runtime.InteropServices;
>>"%TEMP%\capture_screen.ps1" echo   public class Win32 {
>>"%TEMP%\capture_screen.ps1" echo     [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName^);
>>"%TEMP%\capture_screen.ps1" echo     [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect^);
>>"%TEMP%\capture_screen.ps1" echo     [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd^);
>>"%TEMP%\capture_screen.ps1" echo     public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
>>"%TEMP%\capture_screen.ps1" echo   }
>>"%TEMP%\capture_screen.ps1" echo "@
>>"%TEMP%\capture_screen.ps1" echo $out=[IO.Path]::GetFullPath('%OUT_DIR%\%RUN_ID%')
>>"%TEMP%\capture_screen.ps1" echo [IO.Directory]::CreateDirectory($out^) ^| Out-Null
>>"%TEMP%\capture_screen.ps1" echo $hwnd=[Win32]::FindWindow("","微信web开发者工具")
>>"%TEMP%\capture_screen.ps1" echo if($hwnd -eq 0^){$p=Get-Process wechatdevtools -ErrorAction SilentlyContinue;if($p^){$hwnd=$p[0].MainWindowHandle}}
>>"%TEMP%\capture_screen.ps1" echo if($hwnd -ne 0^){
>>"%TEMP%\capture_screen.ps1" echo   $rect=New-Object Win32+RECT
>>"%TEMP%\capture_screen.ps1" echo   [Win32]::GetWindowRect($hwnd,[ref]$rect^)
>>"%TEMP%\capture_screen.ps1" echo   $cw=$rect.Right-$rect.Left
>>"%TEMP%\capture_screen.ps1" echo   $ch=$rect.Bottom-$rect.Top
>>"%TEMP%\capture_screen.ps1" echo   if($cw -gt 0 -and $ch -gt 0^){
>>"%TEMP%\capture_screen.ps1" echo     $bmp=New-Object Drawing.Bitmap $cw,$ch
>>"%TEMP%\capture_screen.ps1" echo     $g=[Drawing.Graphics]::FromImage($bmp^)
>>"%TEMP%\capture_screen.ps1" echo     $g.CopyFromScreen($rect.Left,$rect.Top,0,0,$bmp.Size^)
>>"%TEMP%\capture_screen.ps1" echo     $path=[IO.Path]::Combine($out,'01-album-home.png')
>>"%TEMP%\capture_screen.ps1" echo     $bmp.Save($path,[Drawing.Imaging.ImageFormat]::Png^)
>>"%TEMP%\capture_screen.ps1" echo     $g.Dispose()
>>"%TEMP%\capture_screen.ps1" echo     $bmp.Dispose()
>>"%TEMP%\capture_screen.ps1" echo     Write-Host ('DevTools window: '+$cw+'x'+$ch+' px - saved')
>>"%TEMP%\capture_screen.ps1" echo   ^}else{Write-Host 'ERROR: invalid window dimensions'}
>>"%TEMP%\capture_screen.ps1" echo ^}else{Write-Host 'ERROR: DevTools window not found'}

for /f "tokens=*" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\capture_screen.ps1"') do set SCREENSHOT_RESULT=%%a
del "%TEMP%\capture_screen.ps1" 2>nul
echo       %SCREENSHOT_RESULT%.

echo.
echo ===== Done =====
echo.
pause