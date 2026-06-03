/**
 * 全自动截屏 - 单进程模式
 *
 * 在同一 Node.js 进程中完成：
 *   launch DevTools → wait port → connect → navigate → mp.screenshot()
 *
 * 关键：cli.bat 子进程保持存活，mp.screenshot() 才能成功返回模拟器内容。
 * 截取的是小程序模拟器画面（390x844），而非整个 DevTools 窗口。
 *
 * 运行: npm run capture:auto
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
    process.stdout.write('  waiting ' + (i * intervalMs / 1000) + 's...\n');
    await sleep(intervalMs);
  }
  return false;
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function log(msg) {
  console.log('  ' + msg);
}

// ======================== 激活 DevTools 窗口 ========================

function activateWindow() {
  log('Bringing DevTools window to foreground...');
  try {
    // Write a simple PS script to activate the window
    const psContent = [
      '$p = Get-Process wechatdevtools -ErrorAction SilentlyContinue',
      'if ($p) {',
      '  $h = $p[0].MainWindowHandle',
      '  $sig = \'[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);\'',
      '  $t = Add-Type -MemberDefinition $sig -Name \'W32\' -Namespace Win32 -PassThru',
      '  [Win32.W32]::ShowWindowAsync($h, 9) | Out-Null',
      '  Start-Sleep -Milliseconds 500',
      '  [Win32.W32]::SetForegroundWindow($h) | Out-Null',
      '  Start-Sleep -Milliseconds 1000',
      '  Write-Host "activated"',
      '}'
    ].join('\r\n');

    const psFile = join(__dirname, '_activate.ps1');
    writeFileSync(psFile, psContent, 'utf-8');
    const result = execSync(
      'powershell -ExecutionPolicy Bypass -File "' + psFile + '"',
      { timeout: 10000, encoding: 'utf-8' }
    ).trim();
    try { require('fs').rmSync(psFile); } catch (e) { /* ignore */ }
    if (result) log('Window ' + result);
  } catch (err) {
    log('Window activation: ' + err.message.slice(0, 50));
  }
}

// ======================== 主流程 ========================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Automated Screenshot Capture            ║');
  console.log('║  Single-process mode (mp.screenshot)     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // ---- Step 1: Find cli.bat ----
  log('Finding cli.bat...');
  let cliPath = null;
  for (const dir of CONFIG.searchDirs) {
    if (existsSync(dir)) {
      cliPath = findFile(dir, 'cli.bat');
      if (cliPath) break;
    }
  }
  if (!cliPath) { console.error('ERROR: cli.bat not found'); process.exit(1); }
  log('Found: ' + cliPath);

  // ---- Step 2: Launch DevTools (same process) ----
  log('Launching DevTools...');
  const projectPath = join(__dirname, '..', 'miniprogram');
  const child = spawn(cliPath, [
    'auto', '--port', String(CONFIG.httpPort),
    '--auto-port', String(CONFIG.wsPort),
    '--project', projectPath
  ], {
    shell: true,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Log cli.bat output
  child.stdout.on('data', (d) => { const t = d.toString().trim(); if (t) log('[cli] ' + t); });
  child.stderr.on('data', (d) => { const t = d.toString().trim(); if (t) log('[cli] ' + t); });
  child.on('exit', (code) => log('cli.bat exited (' + code + ')'));

  // ---- Step 3: Wait for port ----
  log('Waiting for port ' + CONFIG.wsPort + '...');
  if (!await waitForPort(CONFIG.wsPort, 25, 2000)) {
    console.error('ERROR: Port ' + CONFIG.wsPort + ' not ready');
    process.exit(1);
  }
  log('Port ' + CONFIG.wsPort + ' ready.');

  // ---- Step 4: Activate DevTools window (helps mp.screenshot) ----
  await sleep(2000);
  activateWindow();

  // ---- Step 5: Connect and navigate ----
  log('Connecting miniprogram-automator...');
  let mp, page;
  try {
    const m = require('miniprogram-automator');
    mp = await m.connect({ wsEndpoint: 'ws://127.0.0.1:' + CONFIG.wsPort });
    page = await mp.reLaunch(CONFIG.targetPage);
    const pg = page || await mp.currentPage();
    if (!pg) throw new Error('Cannot get page');
    log('Navigated to: ' + pg.path);
  } catch (err) {
    console.error('ERROR: Connection failed - ' + err.message);
    try { if (mp) await mp.close(); } catch (e) { /* ignore */ }
    process.exit(1);
  }

  // ---- Step 6: Wait for page render ----
  log('Waiting for page render...');
  const pg = page || await mp.currentPage();
  try {
    const start = Date.now();
    while (Date.now() - start < 20000) {
      const d = await pg.data();
      if (d.isLoading === false) break;
      await sleep(300);
    }
    await sleep(2000); // extra wait for Skyline renderer
    log('Page ready.');
  } catch (err) {
    log('Page wait: ' + err.message.slice(0, 50));
    await sleep(5000);
  }

  // ---- Step 7: Screenshot via mp.screenshot() ----
  log('Taking screenshot via mp.screenshot()...');
  const runId = 'capture-auto_' + timestamp();
  const outputDir = join(CONFIG.outputRoot, runId);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  let ss = null;
  try {
    // mp.screenshot() works when DevTools was launched in the same process
    // and the cli.bat child reference is still alive
    ss = await Promise.race([
      mp.screenshot(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 20s')), 20000))
    ]);
  } catch (err) {
    log('mp.screenshot() failed: ' + err.message);
    log('Falling back to PowerShell window capture...');
  }

  if (ss) {
    const buf = Buffer.from(ss, 'base64');
    const filePath = join(outputDir, '01-album-home.png');
    writeFileSync(filePath, buf);
    log('Saved: ' + (buf.length / 1024).toFixed(1) + ' KB (' + buf.length + ' bytes)');

    // Read image dimensions from PNG header
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    log('Dimensions: ' + w + 'x' + h);
  }

  // ---- Fallback: PowerShell window capture ----
  if (!ss) {
    log('PowerShell window capture fallback...');
    try {
      const psContent = [
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        'Add-Type @"',
        '  using System; using System.Runtime.InteropServices;',
        '  public class W32 {',
        '    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string w);',
        '    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);',
        '    public struct RECT { public int L; public int T; public int R; public int B; }',
        '  }',
        '"@',
        '$h = [W32]::FindWindow("", "微信web开发者工具")',
        'if ($h -eq 0) { $p = Get-Process wechatdevtools -ErrorAction SilentlyContinue; if ($p) { $h = $p[0].MainWindowHandle } }',
        'if ($h -ne 0) {',
        '  $r = New-Object W32+RECT; [W32]::GetWindowRect($h, [ref]$r)',
        '  $w = $r.R - $r.L; $h2 = $r.B - $r.T',
        '  $bmp = New-Object Drawing.Bitmap $w, $h2',
        '  $g = [Drawing.Graphics]::FromImage($bmp)',
        '  $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)',
        '  $fp = [IO.Path]::Combine("' + outputDir.replace(/\\/g, '\\\\') + '", "01-album-home.png")',
        '  $bmp.Save($fp, [Drawing.Imaging.ImageFormat]::Png)',
        '  $g.Dispose(); $bmp.Dispose()',
        '  Write-Host ("PS_OK:" + $w + "x" + $h2)',
        '} else { Write-Host "PS_FAIL" }'
      ].join('\r\n');

      const psFile = join(__dirname, '_capture.ps1');
      writeFileSync(psFile, psContent, 'utf-8');
      const result = execSync(
        'powershell -ExecutionPolicy Bypass -File "' + psFile + '"',
        { timeout: 15000, encoding: 'utf-8' }
      ).trim();
      try { require('fs').rmSync(psFile); } catch (e) { /* ignore */ }
      log(result);
    } catch (err) {
      log('PowerShell fallback error: ' + err.message.slice(0, 60));
    }
  }

  // ---- Cleanup ----
  try { if (mp) await mp.close(); } catch (e) { /* ignore */ }

  // Check saved file
  const savedFile = join(outputDir, '01-album-home.png');
  if (existsSync(savedFile)) {
    const stats = require('fs').statSync(savedFile);
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ✅  Screenshot capture complete!       ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('  ' + savedFile + ' (' + (stats.size / 1024).toFixed(1) + ' KB)');
    console.log('');
  } else {
    console.log('');
    console.log('  No screenshot saved');
    console.log('');
  }

  // Keep alive briefly so DevTools doesn't abruptly close
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});