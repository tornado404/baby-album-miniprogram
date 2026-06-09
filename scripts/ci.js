/**
 * miniprogram-ci 构建上传脚本
 * 用于编译 TypeScript、构建 npm、上传预览
 *
 * 使用方式：
 *   node scripts/ci.js [command]
 *
 * 命令：
 *   build    - 构建 npm（编译 TypeScript + 打包 npm）
 *   preview  - 上传预览版
 *   upload   - 上传正式版
 *
 * 环境变量：
 *   MINIPROGRAM_CI_PRIVATE_KEY - 私钥内容（推荐）
 *   或使用 private.wx3db22b5d6da5d38a.key 文件
 */

const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');

// 项目配置
const PROJECT_PATH = path.resolve(__dirname, '..');
const MINIPROGRAM_PATH = path.join(PROJECT_PATH, 'miniprogram');
const APPID = 'wx3db22b5d6da5d38a';

// 获取私钥
function getPrivateKey() {
  // 优先从环境变量获取
  const envKey = process.env.MINIPROGRAM_CI_PRIVATE_KEY;
  if (envKey) {
    return envKey;
  }

  // 从文件获取
  const keyPath = path.join(PROJECT_PATH, `private.${APPID}.key`);
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf-8');
  }

  throw new Error(
    '未找到私钥！请通过以下方式之一提供：\n' +
    '1. 设置环境变量 MINIPROGRAM_CI_PRIVATE_KEY\n' +
    '2. 在项目根目录放置 private.wx3db22b5d6da5d38a.key 文件\n' +
    '\n' +
    '私钥获取方式：\n' +
    '1. 登录微信公众平台 mp.weixin.qq.com\n' +
    '2. 开发管理 -> 开发设置 -> 小程序代码上传\n' +
    '3. 生成下载上传密钥\n' +
    '4. 配置 IP 白名单（可选）'
  );
}

// 创建项目实例
function createProject() {
  const privateKey = getPrivateKey();

  return new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: MINIPROGRAM_PATH,
    privateKey: privateKey,
    ignores: ['node_modules/**/*', 'tests/**/*', 'docs/**/*'],
  });
}

// 构建 npm
async function buildNpm() {
  console.log('📦 开始构建 npm...');

  try {
    const { execSync } = require('child_process');

    // 查找开发者工具 CLI
    const DEVTOOLS_PATHS = [
      'E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat',
      'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
      'D:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
    ];

    let cliPath = null;
    for (const p of DEVTOOLS_PATHS) {
      if (fs.existsSync(p)) {
        cliPath = p;
        break;
      }
    }

    if (!cliPath) {
      console.log('  ⚠ 未找到开发者工具 CLI，使用 miniprogram-ci 构建...');
      const project = createProject();
      const result = await ci.packNpm(project, {
        ignores: [],
        reporter: (info) => console.log(`    ${info.msg}`)
      });
      console.log('✅ npm 构建完成！');
      return result;
    }

    // 先安装依赖
    console.log('  → 安装依赖...');
    if (fs.existsSync(path.join(MINIPROGRAM_PATH, 'package.json'))) {
      execSync('npm install --production', {
        cwd: MINIPROGRAM_PATH,
        stdio: 'inherit'
      });
    }

    // 使用开发者工具 CLI 构建 npm（会自动处理 ES6 转换）
    console.log('  → 使用开发者工具 CLI 构建 npm...');
    const result = execSync(`"${cliPath}" build-npm --project "${MINIPROGRAM_PATH}"`, {
      encoding: 'utf-8',
      timeout: 120000
    });

    console.log(result);
    console.log('✅ npm 构建完成！');

    // 检查构建结果
    const npmDir = path.join(MINIPROGRAM_PATH, 'miniprogram_npm');
    if (fs.existsSync(npmDir)) {
      const packages = fs.readdirSync(npmDir).filter(f => !f.startsWith('.'));
      console.log(`   构建的包 (${packages.length} 个): ${packages.join(', ')}`);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ npm 构建失败:', error.message);
    throw error;
  }
}

// 上传预览版
async function preview() {
  console.log('🚀 上传预览版...');

  const project = createProject();
  const version = `preview.${Date.now()}`;

  try {
    const result = await ci.preview({
      project,
      desc: 'CI 自动构建预览版',
      setting: {
        es6: true,         // 转译 npm 包中的 ES6 语法
        minify: true,
        codeProtect: false,
        minifyWXML: true,
        minifyWXSS: true,
        minifyJS: true,
      },
      qrcodeFormat: 'image',
      qrcodeOutputDest: path.join(PROJECT_PATH, 'preview-qrcode.png'),
      onProgressUpdate: (task) => {
        if (task._status === 'done') {
          console.log(`  ✓ ${task._msg}`);
        }
      },
    });

    console.log('✅ 预览版上传成功！');
    console.log(`   - 版本: ${version}`);
    console.log(`   - 二维码: preview-qrcode.png`);

    return result;
  } catch (error) {
    console.error('❌ 上传预览版失败:', error.message);
    throw error;
  }
}

// 上传正式版
async function upload(version, desc) {
  console.log('📤 上传正式版...');

  const project = createProject();

  if (!version) {
    // 从 package.json 获取版本
    const pkgPath = path.join(MINIPROGRAM_PATH, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      version = pkg.version || '1.0.0';
    } else {
      version = '1.0.0';
    }
  }

  try {
    const result = await ci.upload({
      project,
      version,
      desc: desc || 'CI 自动构建上传',
      setting: {
        es6: true,         // 转译 npm 包中的 ES6 语法
        minify: true,
        codeProtect: false,
        minifyWXML: true,
        minifyWXSS: true,
        minifyJS: true,
      },
      onProgressUpdate: (task) => {
        if (task._status === 'done') {
          console.log(`  ✓ ${task._msg}`);
        }
      },
    });

    console.log('✅ 正式版上传成功！');
    console.log(`   - 版本: ${version}`);

    return result;
  } catch (error) {
    console.error('❌ 上传正式版失败:', error.message);
    throw error;
  }
}

// 主函数
async function main() {
  const command = process.argv[2] || 'build';
  const version = process.argv[3];
  const desc = process.argv[4];

  console.log('='.repeat(50));
  console.log('微信小程序 CI 工具');
  console.log(`AppID: ${APPID}`);
  console.log(`命令: ${command}`);
  console.log('='.repeat(50));

  switch (command) {
    case 'build':
      await buildNpm();
      break;
    case 'preview':
      await buildNpm();
      await preview();
      break;
    case 'upload':
      await buildNpm();
      await upload(version, desc);
      break;
    default:
      console.log(`未知命令: ${command}`);
      console.log('可用命令: build, preview, upload');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ 执行失败:', error.message);
  process.exit(1);
});
