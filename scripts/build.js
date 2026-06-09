/**
 * scripts/build.js - 编译常量注入脚本
 *
 * 通过修改 project.config.json 的 setting.define 字段注入 DEFAULT_ENV 编译常量。
 * define 中的值会在 miniprogram-ci 打包时进行全局替换，对最终构建产物生效。
 *
 * 使用方式:
 *   node scripts/build.js <env>           # 注入环境常量
 *   node scripts/build.js --restore        # 恢复 project.config.json
 *
 * 环境 <env>: development / testing / production
 *
 * 示例:
 *   node scripts/build.js testing          # 注入 DEFAULT_ENV="testing"
 *   npm run build:test                     # 同上
 *   node scripts/build.js --restore        # 恢复原始配置
 */

const fs = require('fs');
const path = require('path');

// 项目根目录
var ROOT = path.resolve(__dirname, '..');
var CONFIG_PATH = path.join(ROOT, 'project.config.json');
var BACKUP_PATH = path.join(ROOT, 'project.config.json.bak');

var VALID_ENVS = ['development', 'testing', 'production'];
var ENV_DISPLAY = {
  development: '本地开发',
  testing: '测试服务器',
  production: '生产环境',
};

/**
 * 读取 project.config.json
 */
function readConfig() {
  var content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * 写入 project.config.json
 */
function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * 创建备份
 */
function backup() {
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(CONFIG_PATH, BACKUP_PATH);
    console.log('[build.js] 已备份 project.config.json');
  }
}

/**
 * 恢复备份
 */
function restore() {
  if (fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(BACKUP_PATH, CONFIG_PATH);
    fs.unlinkSync(BACKUP_PATH);
    console.log('[build.js] 已恢复 project.config.json');
    return true;
  }
  console.log('[build.js] 无备份可恢复');
  return false;
}

/**
 * 注入编译常量 DEFAULT_ENV
 */
function injectEnv(env) {
  if (VALID_ENVS.indexOf(env) === -1) {
    console.error('[build.js] 无效环境: ' + env);
    console.error('[build.js] 可用环境: ' + VALID_ENVS.join(', '));
    process.exit(1);
  }

  // 读取配置
  var config = readConfig();

  // 确保 setting 存在
  if (!config.setting) {
    config.setting = {};
  }
  if (!config.setting.define) {
    config.setting.define = {};
  }

  // 注入 DEFAULT_ENV（双引号嵌套转义）
  // define 值必须是 JS 字符串字面量：
  //   "DEFAULT_ENV": "\"testing\""
  // 外层引号是 JSON 语法，内层 \"testing\" 展开为 JS 字符串 "testing"
  config.setting.define['DEFAULT_ENV'] = '"' + env + '"';

  // 写入配置
  writeConfig(config);

  console.log('[build.js] 编译环境已注入: ' + env + ' (' + (ENV_DISPLAY[env] || env) + ')');
  console.log('[build.js]   setting.define.DEFAULT_ENV = ' + JSON.stringify(config.setting.define.DEFAULT_ENV));
}

/**
 * 打印帮助
 */
function printHelp() {
  console.log('用法: node scripts/build.js <环境>');
  console.log('环境:');
  for (var i = 0; i < VALID_ENVS.length; i++) {
    var env = VALID_ENVS[i];
    console.log('  ' + env + '  \t- ' + (ENV_DISPLAY[env] || env));
  }
  console.log('');
  console.log('恢复: node scripts/build.js --restore');
}

/**
 * 主函数
 */
function main() {
  var args = process.argv.slice(2);
  var command = args[0];

  if (!command) {
    printHelp();
    process.exit(1);
  }

  if (command === '--restore') {
    restore();
    return;
  }

  // 注入环境常量
  backup();
  injectEnv(command);
  console.log('[build.js] 完成。运行 npm run ci:build 或 miniprogram-ci 构建后，');
  console.log('[build.js] 执行 node scripts/build.js --restore 恢复配置。');
}

main();