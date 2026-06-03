/**
 * 全自动截屏脚本
 *
 * 1. 启动 DevTools（窗口可见）
 * 2. 等待端口就绪
 * 3. 激活 DevTools 窗口到前台（AppActivate）
 * 4. 连接 miniprogram-automator
 * 5. 导航到首屏，等待渲染完成
 * 6. 截图保存
 *
 * 运行: node scripts/capture-automated.js
 * 或:   npm run capture:auto
 */

const { spawn, execSync } = require('child_process');
const { readdirSync, existsSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { createConnection } = require('net');

// ======================== 配置 ========================

const CONFIG = {
  searchDirs: [
    'E:\\ProgramData\\Tencent',
    'C:\\Program Files\\Tencent',
    'C:\\Program Files (x86)\\Tencent',
    'D:\\Program Files\\Tencent',
    'D:\\Program Files (x86)\\Tencent'
  ],
  wsPort: 9420,
  httpPort: 9421,
  targetPage: '/pages/album_home/album_home',
  outputRoot: join(__dirname, '..', 'miniprogram', 'tests', 'reports', 'first-screen')
};

// ======================== 工具函数 ========================

function findFile(rootDir, targetName) {
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        const found = findFile(fullPath, targetName);
        if (found) return found;
      } else if (entry.name === targetName) {
        return fullPath;
      }
    }
  } catch (err) { /* skip */ }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function checkPort(port) {
  return new Promise((resolve) => {
    const sock = createConnection(port, '127.0.0.1', () => { sock.destroy(); resolve(true); });
    sock.setTimeout(1500);
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

async function waitForPort(port, maxAttempts, intervalMs) {
  for (let i = 1; i <= maxAttempts; i++) {
    if (await checkPort(port)) return true;
    if (i === 1 || i % 5 === 0) process.stdout.write('  waiting ' + (i * intervalMs / 1000) + 's...\n');
    await sleep(intervalMs);
  }
  return false;
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

/**
 * 激活 DevTools 窗口到前台
 * 使用 PowerShell 的 AppActivate COM 接口
 */
function activateDevToolsWindow() {
  console.log('  Activating DevTools window...');

  try {
    // Save simplified PowerShell script to a temp file (avoids quoting hell)
    const psContent = `
$procs = Get-Process -Name "wechatdevtools" -ErrorAction SilentlyContinue
if ($procs) {
  $hwnd = $procs[0].MainWindowHandle
  if ($hwnd -ne 0) {
    $sig = @'
[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
'@
    $user32 = Add-Type -MemberDefinition $sig -Name "user32" -Namespace Win32 -PassThru
    [Win32.user32]::ShowWindowAsync($hwnd, 9) | Out-Null
    Start-Sleep -Milliseconds 300
    [Win32.user32]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 300
    Write-Host "Window activated"
  }
}
`;
    const psFile = join(__dirname, '..', 'scripts', 'activate-devtools.ps1');
    writeFileSync(psFile, psContent, 'utf-8');

    const result = execSync('powershell -ExecutionPolicy Bypass -File "' + psFile + '"', {
      timeout: 10000,
      encoding: 'utf-8'
    });
    console.log('  ' + result.trim());
  } catch (err) {
    console.log('  (activation skipped: ' + err.message.slice(0, 50) + ')');
  }
}

// ======================== 主流程 ========================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Automated Screenshot Capture            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // ---- Step 1: Find and launch DevTools ----
  console.log('[1/6] Finding cli.bat...');
  let cliPath = null;
  for (const dir of CONFIG.searchDirs) {
    if (existsSync(dir)) {
      cliPath = findFile(dir, 'cli.bat');
      if (cliPath) break;
    }
  }
  if (!cliPath) {
    console.error('ERROR: cli.bat not found. Please install WeChat DevTools.');
    process.exit(1);
  }
  console.log('  Found: ' + cliPath);

  console.log('[2/6] Launching DevTools...');
  const projectPath = join(__dirname, '..', 'miniprogram');
  const devtoolsChild = spawn(cliPath, [
    'auto', '--port', String(CONFIG.httpPort), '--auto-port', String(CONFIG.wsPort), '--project', projectPath
  ], {
    shell: true, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe']
  });
  devtoolsChild.stderr.on('data', (d) => {
    const t = d.toString().trim();
    if (t && /error|fail|warn/i.test(t)) console.log('  [devtools] ' + t);
  });

  // ---- Step 3: Wait for port ----
  console.log('[3/6] Waiting for automation port ' + CONFIG.wsPort + '...');
  const portReady = await waitForPort(CONFIG.wsPort, 30, 2000);
  if (!portReady) {
    console.error('ERROR: Port ' + CONFIG.wsPort + ' did not open in time.');
    process.exit(1);
  }
  console.log('  Port ' + CONFIG.wsPort + ' ready!');

  // ---- Step 4: Activate DevTools window ----
  // Brief pause to let DevTools finish loading
  console.log('[4/6] Preparing window...');
  await sleep(2000);
  activateDevToolsWindow();
  await sleep(1000);
  activateDevToolsWindow();

  // ---- Step 5: Navigate and wait for page ready ----
  console.log('[5/6] Connecting and navigating...');
  const m = require('miniprogram-automator');
  const mp = await m.connect({ wsEndpoint: 'ws://127.0.0.1:' + CONFIG.wsPort });

  const page = await mp.reLaunch(CONFIG.targetPage);
  const pg = page || await mp.currentPage();
  if (!pg) { console.error('ERROR: Cannot get page object.'); process.exit(1); }
  console.log('  Page: ' + pg.path);

  // waitForPageReady
  const start = Date.now();
  while (Date.now() - start < 20000) {
    const d = await pg.data();
    if (d.isLoading === false) break;
    await sleep(300);
  }
  console.log('  Data loaded, waiting for renderer...');
  await sleep(2500);  // Skyline renderer layout time

  // Verify DOM
  try {
    const emptyEl = await pg.$('.empty-container');
    const uploadEl = await pg.$('.upload-btn');
    console.log('  DOM: empty-container=' + (emptyEl ? '✓' : '✗') + '  upload-btn=' + (uploadEl ? '✓' : '✗'));
  } catch (err) { /* ignore */ }

  // ---- Step 6: Screenshot (fallback: PowerShell full screen capture) ----
  console.log('[6/6] Taking screenshot...');
  const runId = 'capture-auto_' + timestamp();
  const outputDir = join(CONFIG.outputRoot, runId);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  let screenshotSaved = false;

  // Method: PowerShell full screen capture (most reliable)
  try {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bmp = New-Object Drawing.Bitmap ([Windows.Forms.Screen]::PrimaryScreen.Bounds.Width), ([Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
$g = [Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save("ps-screenshot.png", [Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "OK"
`;
    const psFile = join(__dirname, '..', 'scripts', '_capture_screen.ps1');
    writeFileSync(psFile, psScript, 'utf-8');

    const result = execSync('powershell -ExecutionPolicy Bypass -File "' + psFile + '"', {
      timeout: 15000,
      encoding: 'utf-8',
      cwd: outputDir
    }).trim();

    // Clean up temp script
    try { require('fs').rmSync(psFile); } catch (e) { /* ignore */ }

    if (result === 'OK') {
      const savedFile = join(outputDir, 'ps-screenshot.png');
      if (existsSync(savedFile)) {
        const stats = require('fs').statSync(savedFile);
        // Rename to standard name
        require('fs').renameSync(savedFile, join(outputDir, '01-album-home.png'));
        console.log('  Method: PowerShell screen capture ✓ (' + (stats.size / 1024).toFixed(1) + ' KB)');
        screenshotSaved = true;
      }
    } else {
      console.log('  PowerShell result: ' + result);
    }
  } catch (psErr) {
    console.log('  PowerShell error: ' + psErr.message.slice(0, 80));
  }

  await mp.close();

  // Determine the saved file path
  const savedFilePath = join(outputDir, '01-album-home.png');

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ✅  Screenshot capture complete!       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  if (screenshotSaved && existsSync(savedFilePath)) {
    const stats = require('fs').statSync(savedFilePath);
    console.log('  ' + savedFilePath + ' (' + (stats.size / 1024).toFixed(1) + ' KB)');
  } else {
    console.log('  No screenshot was saved.');
  }
  console.log('');

  // Keep alive for a bit so DevTools window doesn't close
  setTimeout(() => process.exit(0), 10000);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});