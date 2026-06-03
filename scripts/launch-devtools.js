/**
 * Launch WeChat DevTools in automation mode with visible window.
 *
 * Searches for cli.bat using Node.js fs (handles Unicode paths correctly),
 * spawns it with --auto-port 9420 for miniprogram-automator connections.
 *
 * IMPORTANT: This script stays alive after launching DevTools to keep
 * the automation port (9420) usable for mp.screenshot().
 * Close the console window when done with testing.
 *
 * Used by: start-devtools-visible.bat (double-click to run)
 * Also: node scripts/launch-devtools.js
 */

const { spawn } = require('child_process');
const { readdirSync, existsSync } = require('fs');
const { join } = require('path');
const { createConnection } = require('net');

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
  } catch (err) {
    // Permission denied or path not found - skip silently
  }
  return null;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const sock = createConnection(port, '127.0.0.1', () => {
      sock.destroy();
      resolve(true);
    });
    sock.setTimeout(1000);
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

async function waitForPort(port, maxAttempts, intervalMs) {
  for (let i = 1; i <= maxAttempts; i++) {
    const open = await checkPort(port);
    if (open) return true;
    if (i === 1 || i % 5 === 0) {
      console.log('  Waiting for port ' + port + '... (' + (i * intervalMs / 1000) + 's)');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function main() {
  const searchDirs = [
    'E:\\ProgramData\\Tencent',
    'C:\\Program Files\\Tencent',
    'C:\\Program Files (x86)\\Tencent',
    'D:\\Program Files\\Tencent',
    'D:\\Program Files (x86)\\Tencent'
  ];

  let cliPath = null;
  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      cliPath = findFile(dir, 'cli.bat');
      if (cliPath) break;
    }
  }

  if (!cliPath) {
    console.error('ERROR: Could not find WeChat DevTools cli.bat');
    console.error('Searched in: ' + searchDirs.join(', '));
    process.exit(1);
  }

  const projectPath = join(__dirname, '..', 'miniprogram');
  console.log('Found: ' + cliPath);
  console.log('Project: ' + projectPath);
  console.log('Ports: HTTP=9421  WS=9420');
  console.log('');

  const child = spawn(cliPath, [
    'auto',
    '--port', '9421',
    '--auto-port', '9420',
    '--project', projectPath
  ], {
    shell: true,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (d) => {
    const text = d.toString().trim();
    if (text) console.log('  ' + text);
  });
  child.stderr.on('data', (d) => {
    const text = d.toString().trim();
    if (text) console.log('  ' + text);
  });

  child.on('error', (err) => {
    console.error('Launch error:', err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    console.log('cli.bat exited (code: ' + code + ')');
    console.log('DevTools should still be running.');
  });

  // Wait for automation port, then keep alive
  (async () => {
    const ready = await waitForPort(9420, 30, 2000);
    if (ready) {
      console.log('');
      console.log('=== DevTools ready for automation ===');
      console.log('Port 9420 is open. You can now run:');
      console.log('  npm run capture:first-screen');
      console.log('  npm run start:first-screen');
      console.log('');
      console.log('Keep this window open while testing.');
      console.log('Close it when done.');
    } else {
      console.log('Timeout waiting for DevTools automation port.');
    }
  })();

  // Keep alive - don't exit
  setInterval(() => {}, 60000);
}

if (require.main === module) {
  main();
}

module.exports = { main, findFile };