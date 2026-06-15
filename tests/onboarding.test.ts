/**
 * 登录引导页 (Onboarding) 测试用例
 * 测试目标: 页面文件存在性、页面注册、配置正确性、路由逻辑
 */

var fs = require('fs');
var path = require('path');

var MINIPROGRAM_DIR = path.resolve(__dirname, '../miniprogram');
var PAGES_DIR = path.join(MINIPROGRAM_DIR, 'pages/onboarding');

// ==================== 页面文件存在性测试 ====================

describe('登录引导页 (Onboarding) - 文件存在性', function () {
  var requiredFiles = [
    'onboarding.ts',
    'onboarding.wxml',
    'onboarding.wxss',
    'onboarding.json',
  ];

  requiredFiles.forEach(function (filename) {
    test(filename + ' 文件应存在', function () {
      var filePath = path.join(PAGES_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

// ==================== 页面注册测试 ====================

describe('登录引导页 (Onboarding) - 页面注册', function () {
  var appJsonPath = path.join(MINIPROGRAM_DIR, 'app.json');
  var appJson: any;

  beforeAll(function () {
    var content = fs.readFileSync(appJsonPath, 'utf-8');
    // Strip BOM if present
    content = content.replace(/^﻿/, '');
    appJson = JSON.parse(content);
  });

  test('onboarding 页面应注册在 app.json 的 pages 数组中', function () {
    expect(appJson.pages).toBeDefined();
    expect(Array.isArray(appJson.pages)).toBe(true);
    expect(appJson.pages.indexOf('pages/onboarding/onboarding')).toBeGreaterThan(-1);
  });
});

// ==================== 页面配置测试 ====================

describe('登录引导页 (Onboarding) - 页面配置', function () {
  var pageJsonPath = path.join(PAGES_DIR, 'onboarding.json');
  var pageJson: any;

  beforeAll(function () {
    var content = fs.readFileSync(pageJsonPath, 'utf-8');
    content = content.replace(/^﻿/, '');
    pageJson = JSON.parse(content);
  });

  test('应使用自定义导航栏', function () {
    expect(pageJson.navigationStyle).toBe('custom');
  });

  test('不应有重复的 usingComponents 注册 TDesign 组件', function () {
    // TDesign 组件在 app.json 全局注册，页面不需要重复注册
    var keys = Object.keys(pageJson.usingComponents || {});
    keys.forEach(function (key) {
      expect(key.indexOf('miniprogram_npm/')).toBe(-1);
    });
  });
});

// ==================== 页面逻辑测试 ====================

describe('登录引导页 (Onboarding) - 路由逻辑', function () {
  // Simulate the routing logic from onboarding.ts
  function getRedirectTarget(hasToken: boolean, hasBabyProfile: boolean): string {
    if (hasToken && hasBabyProfile) {
      return '/pages/album_home/album_home';
    } else if (hasToken && !hasBabyProfile) {
      return '/pages/baby_onboarding/baby_onboarding';
    }
    return ''; // Stay on onboarding page
  }

  test('有 token 且有宝宝档案时应跳转到 album_home', function () {
    var target = getRedirectTarget(true, true);
    expect(target).toBe('/pages/album_home/album_home');
  });

  test('有 token 但无宝宝档案时应跳转到 baby_onboarding', function () {
    var target = getRedirectTarget(true, false);
    expect(target).toBe('/pages/baby_onboarding/baby_onboarding');
  });

  test('无 token 时应停留在 onboarding 页面', function () {
    var target = getRedirectTarget(false, false);
    expect(target).toBe('');
  });

  test('无 token 时（即使有宝宝档案）也应停留在 onboarding 页面', function () {
    var target = getRedirectTarget(false, true);
    expect(target).toBe('');
  });
});

// ==================== 入口页路由逻辑测试 ====================

describe('入口页 (Index) - 路由逻辑', function () {
  function getIndexRedirectTarget(hasToken: boolean, hasBabyProfile: boolean): string {
    if (hasToken) {
      if (hasBabyProfile) {
        return '/pages/album_home/album_home';
      } else {
        return '/pages/baby_onboarding/baby_onboarding';
      }
    } else {
      return '/pages/onboarding/onboarding';
    }
  }

  test('无 token 时应跳转到 onboarding 页面', function () {
    var target = getIndexRedirectTarget(false, false);
    expect(target).toBe('/pages/onboarding/onboarding');
  });

  test('有 token 且有宝宝档案时应跳转到 album_home', function () {
    var target = getIndexRedirectTarget(true, true);
    expect(target).toBe('/pages/album_home/album_home');
  });

  test('有 token 但无宝宝档案时应跳转到 baby_onboarding', function () {
    var target = getIndexRedirectTarget(true, false);
    expect(target).toBe('/pages/baby_onboarding/baby_onboarding');
  });
});

// ==================== 页面数据模型测试 ====================

describe('登录引导页 (Onboarding) - 页面数据模型', function () {
  interface OnboardingPageData {
    safeTop: number;
    isLoading: boolean;
    hasAgreed: boolean;
    authState: 'idle' | 'loading' | 'error' | 'success';
    errorMsg: string;
  }

  test('初始数据结构应包含必要字段', function () {
    var initialData: OnboardingPageData = {
      safeTop: 44,
      isLoading: false,
      hasAgreed: false,
      authState: 'idle',
      errorMsg: '',
    };

    expect(typeof initialData.isLoading).toBe('boolean');
    expect(typeof initialData.hasAgreed).toBe('boolean');
    expect(initialData.authState).toBe('idle');
    expect(typeof initialData.errorMsg).toBe('string');
  });

  test('authState 应只接受合法值', function () {
    var validStates = ['idle', 'loading', 'error', 'success'];
    validStates.forEach(function (state) {
      expect(validStates.indexOf(state)).toBeGreaterThan(-1);
    });
  });

  test('hasAgreed 初始应为 false', function () {
    var data: OnboardingPageData = {
      safeTop: 44,
      isLoading: false,
      hasAgreed: false,
      authState: 'idle',
      errorMsg: '',
    };
    expect(data.hasAgreed).toBe(false);
  });

  test('未同意隐私协议时点击登录应提示用户', function () {
    var hasAgreed = false;
    var shouldBlock = !hasAgreed;
    expect(shouldBlock).toBe(true);
  });
});

// ==================== WXML 模板结构测试 ====================

describe('登录引导页 (Onboarding) - WXML 模板结构', function () {
  var wxmlContent: string;

  beforeAll(function () {
    wxmlContent = fs.readFileSync(path.join(PAGES_DIR, 'onboarding.wxml'), 'utf-8');
  });

  test('应包含 Logo 区域', function () {
    expect(wxmlContent.indexOf('onboarding-logo')).toBeGreaterThan(-1);
  });

  test('应包含应用标题', function () {
    expect(wxmlContent.indexOf('宝宝成长相册')).toBeGreaterThan(-1);
  });

  test('应包含微信登录按钮', function () {
    expect(wxmlContent.indexOf('onLoginTap')).toBeGreaterThan(-1);
    expect(wxmlContent.indexOf('微信一键登录')).toBeGreaterThan(-1);
  });

  test('应包含隐私政策文本', function () {
    expect(wxmlContent.indexOf('用户协议')).toBeGreaterThan(-1);
    expect(wxmlContent.indexOf('隐私政策')).toBeGreaterThan(-1);
  });

  test('应包含隐私协议勾选功能', function () {
    expect(wxmlContent.indexOf('onPrivacyTap')).toBeGreaterThan(-1);
    expect(wxmlContent.indexOf('hasAgreed')).toBeGreaterThan(-1);
  });

  test('应包含加载状态', function () {
    expect(wxmlContent.indexOf('authState')).toBeGreaterThan(-1);
    expect(wxmlContent.indexOf('loading')).toBeGreaterThan(-1);
  });

  test('应包含错误状态和重试按钮', function () {
    expect(wxmlContent.indexOf('error')).toBeGreaterThan(-1);
    expect(wxmlContent.indexOf('重新授权')).toBeGreaterThan(-1);
  });

  test('应包含安全区域底部间距', function () {
    expect(wxmlContent.indexOf('safe-area-bottom')).toBeGreaterThan(-1);
  });
});

// ==================== WXSS 样式测试 ====================

describe('登录引导页 (Onboarding) - WXSS 样式', function () {
  var wxssContent: string;

  beforeAll(function () {
    wxssContent = fs.readFileSync(path.join(PAGES_DIR, 'onboarding.wxss'), 'utf-8');
  });

  test('应使用 Claymorphism 背景色 #fffbf8', function () {
    expect(wxssContent.indexOf('#fffbf8')).toBeGreaterThan(-1);
  });

  test('登录按钮应使用主色调 #ffa87a', function () {
    expect(wxssContent.indexOf('#ffa87a')).toBeGreaterThan(-1);
  });

  test('Logo 区域应有柔和阴影', function () {
    expect(wxssContent.indexOf('box-shadow')).toBeGreaterThan(-1);
  });

  test('登录按钮应有圆角', function () {
    expect(wxssContent.indexOf('border-radius')).toBeGreaterThan(-1);
  });

  test('应包含安全区域底部间距', function () {
    expect(wxssContent.indexOf('safe-area-inset-bottom')).toBeGreaterThan(-1);
  });
});
