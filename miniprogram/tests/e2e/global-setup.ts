/**
 * Jest globalSetup：建立 miniprogram-automator 共享连接
 *
 * Windows 原生全自动模式：
 *   脚本会检测微信开发者工具是否已在运行，如果未运行则自动启动。
 *   无需手动启动 DevTools，也无需配置密钥。
 *
 * 使用方式：
 *   npm run test:e2e:auto              # 全自动模式（推荐）
 *   set E2E_AUTO_LAUNCH=0 && npm run test:e2e   # 手动模式（DevTools 已运行）
 *
 * ===== Windows 原生环境注意事项 =====
 *
 * cli.bat 调用：
 *   Node.js spawn 调用 .bat 文件必须设置 shell: true，
 *   否则 Windows 会返回 ENOENT。
 *
 * 端口检测：
 *   使用 127.0.0.1 而非 localhost，避免 Windows IPv6 优先解析问题。
 *
 * 路径格式：
 *   cli.bat 接受 Windows 反斜杠路径（如 D:\code\...），
 *   Git Bash 的 /d/code/... 格式需要转换。
 *
 * 进程管理：
 *   启动前会先检查端口 9420 是否已监听，避免重复启动。
 *   DevTools 启动后常驻后台，测试结束后不自动关闭。
 */

import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { spawn, execSync } from 'child_process';
import { createConnection } from 'net';

interface SetupGlobal {
  __AUTOMATOR__?: unknown;
  __AUTOMATOR_ERROR__?: string;
  __AI_VALIDATOR__?: unknown;
  __REPORTER__?: unknown;
}

const globalAny = globalThis as unknown as SetupGlobal;

/* ==================== 开发者工具启动逻辑 ==================== */

/** cli.bat 可能的位置（按优先级排列） */
const DEVTOOLS_PATHS = [
  'E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'D:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
  'D:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
];

function findCli(): string | null {
  for (const p of DEVTOOLS_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** 将 Git Bash 路径（/d/code/...）转为 Windows 路径（D:\code\...） */
function toWindowsPath(p: string): string {
  if (/^\/[a-zA-Z]\//.test(p)) {
    // Git Bash 风格: /d/code/... -> D:\code\...
    return p[1].toUpperCase() + ':\\' + p.substring(3).replace(/\//g, '\\');
  }
  return p.replace(/\//g, '\\');
}

/** 检测端口是否已监听 */
function isPortOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise(resolve => {
    const sock = createConnection(port, host, () => {
      sock.destroy();
      resolve(true);
    });
    sock.setTimeout(timeoutMs);
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

/** 等待端口就绪，最多重试 maxAttempts 次 */
async function waitForPort(
  host: string, port: number,
  maxAttempts = 30, intervalMs = 2000
): Promise<boolean> {
  for (let i = 1; i <= maxAttempts; i++) {
    const open = await isPortOpen(host, port, 1500);
    if (open) return true;
    if (i === 1 || i % 5 === 0) {
      console.log(`[global-setup] 等待开发者工具就绪... (${i * intervalMs / 1000}s / ${maxAttempts * intervalMs / 1000}s)`);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/** 检测 DevTools 进程是否存在 */
function isDevToolsRunning(): boolean {
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        'tasklist /FI "IMAGENAME eq wechatdevtools.exe" /NH',
        { encoding: 'utf-8', timeout: 3000 }
      );
      return result.includes('wechatdevtools.exe');
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 启动微信开发者工具（自动化模式）
 *
 * 关键实现细节：
 * - 使用 shell: true 来执行 .bat 文件（Windows 必须）
 * - 启动前先检测端口，已监听则复用
 * - 等待 WS 端口就绪后返回，不等待进程退出
 */
async function launchDevTools(projectPath: string, wsPort: number): Promise<void> {
  const cliPath = findCli();
  if (!cliPath) {
    throw new Error(
      '未找到微信开发者工具 cli.bat。\n' +
      '请手动启动开发者工具，或安装到以下路径之一:\n' +
      DEVTOOLS_PATHS.map(p => '  ' + p).join('\n')
    );
  }

  // 先检查端口是否已被占用（快速检测，100ms 超时）
  const alreadyRunning = await isPortOpen('127.0.0.1', wsPort, 100);
  if (alreadyRunning) {
    console.log('[global-setup] 端口 ' + wsPort + ' 已监听，复用已有实例');
    return;
  }

  const httpPort = wsPort + 1; // 9421 用于 HTTP，9420 用于 WebSocket
  const winProjectPath = toWindowsPath(projectPath);

  console.log('[global-setup] 正在启动微信开发者工具...');
  console.log('[global-setup]   cli:     ' + cliPath);
  console.log('[global-setup]   项目:    ' + winProjectPath);
  console.log('[global-setup]   端口:    HTTP=' + httpPort + '  WS=' + wsPort);

  // 关闭已存在的 DevTools 进程（避免多实例端口冲突）
  if (isDevToolsRunning()) {
    console.log('[global-setup] 关闭已有开发者工具进程...');
    try {
      execSync('taskkill /F /IM wechatdevtools.exe', { stdio: 'ignore', timeout: 5000 });
      await new Promise(r => setTimeout(r, 2000));
    } catch {
      // 可能没有权限，忽略
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(cliPath, [
      'auto',
      '--port', String(httpPort),
      '--auto-port', String(wsPort),
      '--project', winProjectPath
    ], {
      // Windows 必须：.bat 文件需要 shell 来执行
      shell: true,
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 设置控制台编码为 UTF-8
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let settled = false;

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        console.log('[devtools] ' + text);
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text && (text.includes('error') || text.includes('fail') || text.includes('warn'))) {
        console.warn('[devtools] ' + text);
      }
    });

    child.on('error', (err: Error) => {
      if (!settled) {
        settled = true;
        reject(new Error('启动开发者工具失败: ' + err.message));
      }
    });

    child.on('exit', (code) => {
      if (!settled && code !== null && code !== 0) {
        settled = true;
        reject(new Error('开发者工具进程异常退出，code=' + code));
      }
      // code=0 不 resolve —— 需要等端口就绪
    });

    // 等待 WS 端口就绪
    waitForPort('127.0.0.1', wsPort, 30, 2000).then(ok => {
      if (!settled) {
        settled = true;
        if (ok) {
          // 额外等待项目编译完成
          console.log('[global-setup] 开发者工具已启动，等待项目编译...');
          setTimeout(() => {
            console.log('[global-setup] 项目就绪');
            resolve();
          }, 3000);
        } else {
          child.kill();
          reject(new Error(
            '开发者工具启动超时（60s）。\n' +
            '可能原因:\n' +
            '  1. 开发者工具首次启动需要登录\n' +
            '  2. 项目正在编译 npm 依赖\n' +
            '  3. 端口 ' + wsPort + ' 被其他程序占用\n' +
            '请尝试手动启动后重试。'
          ));
        }
      }
    });
  });
}

/* ==================== 主逻辑 ==================== */

export default async function globalSetup(): Promise<void> {
  // 预创建 reports 目录
  const reportsRoot = join(process.cwd(), 'miniprogram', 'tests', 'reports');
  if (!existsSync(reportsRoot)) {
    mkdirSync(reportsRoot, { recursive: true });
  }

  const projectPath = process.env.E2E_PROJECT_PATH || join(process.cwd(), 'miniprogram');
  const wsPort = Number(process.env.WECHAT_AUTOMATOR_WS_PORT || 9420);
  // Windows 用 127.0.0.1 避免 localhost 的 IPv6 解析问题
  const wsEndpoint = process.env.E2E_WS_ENDPOINT || 'ws://127.0.0.1:' + wsPort;

  try {
    // 默认自动启动 DevTools（Windows 原生环境）
    // 设置 E2E_AUTO_LAUNCH=0 或 false 可禁用
    const autoLaunch = process.env.E2E_AUTO_LAUNCH !== '0' && process.env.E2E_AUTO_LAUNCH !== 'false';

    if (autoLaunch) {
      await launchDevTools(projectPath, wsPort);
    } else {
      console.log('[global-setup] 跳过自动启动（E2E_AUTO_LAUNCH=0），等待已有实例...');
    }

    // 连接 miniprogram-automator
    var automator: any = null;
    try {
      const automatorPkg: any = require('miniprogram-automator');
      automator = await automatorPkg.connect({
        wsEndpoint: wsEndpoint
      });
    } catch (err) {
      // macOS DevTools 版本字段差异导致 checkVersion 崩溃, 回退直接连接
      console.warn('[global-setup] 标准 connect 失败: ' + ((err as Error).message || String(err)));
      console.log('[global-setup] 尝试绕过 checkVersion 直接连接...');
      const WS = require('ws');
      const ws = new WS(wsEndpoint);
      const Connection = require('miniprogram-automator/out/Connection').default;
      const MiniProgram = require('miniprogram-automator/out/MiniProgram').default;
      const Transport = require('miniprogram-automator/out/Transport').default;
      const conn = await new Promise(function(rs, rj) {
        ws.addEventListener('open', function() { rs(new Connection(new Transport(ws))); });
        ws.addEventListener('error', rj);
      });
      automator = new MiniProgram(conn);
    }
    globalAny.__AUTOMATOR__ = automator;
    console.log('[global-setup] ✓ 已连接 miniprogram-automator @ ' + wsEndpoint);
  } catch (err) {
    globalAny.__AUTOMATOR_ERROR__ =
      'globalSetup: miniprogram-automator 连接失败（' +
      wsEndpoint +
      '）：' +
      ((err as Error).message || String(err));
    console.warn('[global-setup] ' + globalAny.__AUTOMATOR_ERROR__);
    console.warn(
      '[global-setup] 如果持续失败，请手动启动开发者工具:\n' +
      '  "E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat" auto ' +
      '--port 9421 --auto-port 9420 ' +
      '--project D:\\code\\yuanBabyGrowthDiary\\miniprogram'
    );
  }
}