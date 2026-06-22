/**
 * npm 构建修复脚本
 *
 * 将 miniprogram_npm/tdesign-miniprogram/ 中的 ES module 语法（import/export）
 * 转换为微信小程序支持的 CommonJS 语法（require/module.exports）。
 *
 * tdesign-miniprogram 1.15.0 的 miniprogram_dist 自带 import/export 语法，
 * 微信开发者工具「构建 npm」在部分版本中未正确转换，需运行此脚本修复。
 *
 * 用法: node scripts/build-npm.js
 */

const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs');
const { join } = require('path');

const TARGET_DIR = join(__dirname, '..', 'miniprogram', 'miniprogram_npm', 'tdesign-miniprogram');

// ===== babel-based transpilation =====

let babelCore;
let presetEnv;

try {
  babelCore = require('@babel/core');
  presetEnv = require('@babel/preset-env');
} catch {
  console.error('❌ 未找到 @babel/core 或 @babel/preset-env');
  console.error('   请执行: npm install --save-dev @babel/core @babel/preset-env');
  process.exit(1);
}

function transpile(content, filePath) {
  const result = babelCore.transformSync(content, {
    filename: filePath,
    presets: [[presetEnv, {
      modules: 'commonjs',
      targets: { chrome: '53' },
      useBuiltIns: false,
      shippedProposals: true
    }]],
    compact: false,
    sourceMaps: false
  });
  return result.code;
}

// ===== 主逻辑 =====

function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  npm 构建修复                            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  if (!existsSync(TARGET_DIR)) {
    console.error('❌ 未找到目录: ' + TARGET_DIR);
    console.error('   请先在微信开发者工具中执行「工具 → 构建 npm」');
    process.exit(1);
  }

  // 扫描所有 .js 文件
  const files = [];
  function scan(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        scan(full);
      } else if (e.name.endsWith('.js')) {
        files.push(full);
      }
    }
  }

  try {
    scan(TARGET_DIR);
  } catch (err) {
    console.error('❌ 扫描目录失败:', err.message);
    process.exit(1);
  }

  console.log('  目标: ' + TARGET_DIR);
  console.log('  文件: ' + files.length + ' 个 .js');
  console.log('');

  // 逐文件转换
  let converted = 0;
  let skipped = 0;
  let errors = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');

      // 跳过已使用 CommonJS 的文件（无 import/export）
      if (!/\b(import|export)\b/.test(content)) {
        skipped++;
        continue;
      }

      const result = transpile(content, file);
      writeFileSync(file, result, 'utf-8');
      converted++;

      if (converted <= 10) {
        const rel = file.replace(TARGET_DIR, '').replace(/\\/g, '/');
        console.log('  ✓ ' + rel);
      } else if (converted === 11) {
        console.log('  ... 继续转换中 (' + (files.length - skipped - converted + errors.length) + ' 个剩余)');
      }
    } catch (err) {
      errors.push({ file, message: err.message });
      const rel = file.replace(TARGET_DIR, '').replace(/\\/g, '/');
      console.error('  ✗ ' + rel + ' - ' + err.message.slice(0, 60));
    }
  }

  // 输出汇总
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ✅  npm 构建修复完成                    ║');
  const stats = converted + '/' + files.length + ' 转换, ' + skipped + ' 跳过, ' + errors.length + ' 错误';
  console.log('║  ' + stats.padEnd(36) + '║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  if (errors.length > 0) {
    console.log('  错误详情:');
    for (const e of errors) {
      console.log('    ✗ ' + e.file.replace(TARGET_DIR, '').replace(/\\/g, '/'));
      console.log('      ' + e.message.slice(0, 100));
    }
    console.log('');
    console.log('  提示: 如果错误与 babel 解析有关，某些文件可能需要手动修复');
    console.log('');
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
} else {
  module.exports = { main, transpile };
}