/**
 * 宝宝列表页 (Baby List) 测试用例
 * 测试目标: 页面文件存在性、注册、配置、数据逻辑、事件处理
 */

var fs = require('fs');
var path = require('path');

var MINIPROGRAM_DIR = path.resolve(__dirname, '../miniprogram');
var PAGES_DIR = path.join(MINIPROGRAM_DIR, 'pages/baby_list');
var STORAGE_KEYS_PATH = path.join(MINIPROGRAM_DIR, 'constants/storage_keys.ts');

// ==================== 页面文件存在性测试 ====================

describe('宝宝列表页 (Baby List) - 文件存在性', function () {
  var requiredFiles = [
    'baby_list.ts',
    'baby_list.js',
    'baby_list.wxml',
    'baby_list.wxss',
    'baby_list.json',
  ];

  requiredFiles.forEach(function (filename) {
    test(filename + ' 文件应存在', function () {
      var filePath = path.join(PAGES_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

// ==================== 页面注册测试 ====================

describe('宝宝列表页 (Baby List) - 页面注册', function () {
  var appJson: any;

  beforeAll(function () {
    var appJsonPath = path.join(MINIPROGRAM_DIR, 'app.json');
    var content = fs.readFileSync(appJsonPath, 'utf-8');
    content = content.replace(/^﻿/, '');
    appJson = JSON.parse(content);
  });

  test('baby_list 页面应注册在 app.json 的 pages 数组中', function () {
    expect(appJson.pages).toBeDefined();
    expect(Array.isArray(appJson.pages)).toBe(true);
    expect(appJson.pages.indexOf('pages/baby_list/baby_list')).toBeGreaterThan(-1);
  });
});

// ==================== 页面配置测试 ====================

describe('宝宝列表页 (Baby List) - 页面配置', function () {
  var pageJson: any;

  beforeAll(function () {
    var content = fs.readFileSync(path.join(PAGES_DIR, 'baby_list.json'), 'utf-8');
    content = content.replace(/^﻿/, '');
    pageJson = JSON.parse(content);
  });

  test('应使用 custom 导航栏', function () {
    expect(pageJson.navigationStyle).toBe('custom');
  });
});

// ==================== JS 逻辑测试 ====================

describe('宝宝列表页 (Baby List) - JS 逻辑', function () {
  var jsContent: string;

  beforeAll(function () {
    jsContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_list.js'), 'utf-8');
  });

  test('应导入 STORAGE_KEYS', function () {
    expect(jsContent).toContain('storage_keys');
  });

  test('应导入 tokenManager', function () {
    expect(jsContent).toContain('tokenManager');
  });

  test('应包含 loadBabies 方法', function () {
    expect(jsContent).toContain('loadBabies');
  });

  test('应包含 fallbackBabies 方法（本地缓存降级）', function () {
    expect(jsContent).toContain('fallbackBabies');
  });

  test('应包含 getMockBabies 方法（空数据降级）', function () {
    expect(jsContent).toContain('getMockBabies');
  });

  test('应包含 loadCurrentBabyId 方法', function () {
    expect(jsContent).toContain('loadCurrentBabyId');
  });

  test('应包含 onBabyTap 事件处理', function () {
    expect(jsContent).toContain('onBabyTap');
  });

  test('应包含 onAddBaby 事件处理', function () {
    expect(jsContent).toContain('onAddBaby');
  });

  test('应包含 onBabyLongPress 事件处理（长按删除）', function () {
    expect(jsContent).toContain('onBabyLongPress');
  });

  test('应包含 deleteBaby 方法', function () {
    expect(jsContent).toContain('deleteBaby');
  });

  test('应包含 onBack 返回导航', function () {
    expect(jsContent).toContain('onBack');
  });

  test('data 应包含 currentBabyId 字段', function () {
    expect(jsContent).toContain('currentBabyId');
  });

  test('getMockBabies 应返回 2 个模拟宝宝', function () {
    expect(jsContent).toContain('demo-1');
    expect(jsContent).toContain('demo-2');
  });

  test('getMockBabies 应包含 ageText 字段', function () {
    expect(jsContent).toContain('ageText');
  });

  test('应处理 wx.getStorageSync 异常', function () {
    // fallbackBabies 中的 try-catch
    expect(jsContent).toContain('try');
    expect(jsContent).toContain('catch');
  });
});

// ==================== WXML 结构测试 ====================

describe('宝宝列表页 (Baby List) - WXML 结构', function () {
  var wxmlContent: string;

  beforeAll(function () {
    wxmlContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_list.wxml'), 'utf-8');
  });

  test('应使用 wx:for 渲染宝宝列表', function () {
    expect(wxmlContent).toContain('wx:for="{{babies}}"');
  });

  test('应包含宝宝卡片结构', function () {
    expect(wxmlContent).toContain('baby-card');
  });

  test('应包含宝宝头像展示', function () {
    expect(wxmlContent).toContain('baby-card-avatar');
  });

  test('应包含宝宝名字和年龄', function () {
    expect(wxmlContent).toContain('baby-card-name');
    expect(wxmlContent).toContain('baby-card-age');
  });

  test('应包含添加宝宝按钮', function () {
    expect(wxmlContent).toContain('添加宝宝');
  });

  test('应包含返回按钮', function () {
    expect(wxmlContent).toContain('onBack');
  });

  test('应包含长按删除事件绑定', function () {
    expect(wxmlContent).toContain('bindlongpress');
    expect(wxmlContent).toContain('onBabyLongPress');
  });

  test('应包含加载中状态', function () {
    expect(wxmlContent).toContain('isLoading');
    expect(wxmlContent).toContain('加载中');
  });

  test('应包含空状态提示', function () {
    expect(wxmlContent).toContain('还没有宝宝哦');
  });

  test('应包含活跃宝宝标识 (active-badge)', function () {
    expect(wxmlContent).toContain('active-badge');
  });

  test('应显示当前宝宝勾选标记', function () {
    expect(wxmlContent).toContain('currentBabyId');
  });

  test('非活跃宝宝应显示箭头', function () {
    expect(wxmlContent).toContain('baby-card-arrow');
  });

  test('avatarUrl 方法应过滤非 http 头像', function () {
    expect(wxmlContent).toContain('avatar.indexOf(\'http\') === 0');
  });
});

// ==================== WXSS 样式测试 ====================

describe('宝宝列表页 (Baby List) - WXSS 样式', function () {
  var wxssContent: string;

  beforeAll(function () {
    wxssContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_list.wxss'), 'utf-8');
  });

  test('应使用 Claymorphism 背景色', function () {
    expect(wxssContent).toContain('#fffbf8');
  });

  test('应包含卡片阴影效果', function () {
    expect(wxssContent).toContain('box-shadow');
  });

  test('应包含活跃宝宝标识样式', function () {
    expect(wxssContent).toContain('active-badge');
  });

  test('活跃标识应为橙色', function () {
    expect(wxssContent).toContain('#ffa87a');
  });

  test('应包含添加按钮样式', function () {
    expect(wxssContent).toContain('add-btn');
  });

  test('应包含圆角卡片样式', function () {
    expect(wxssContent).toContain('border-radius');
  });

  test('卡片应设置为 flex 布局', function () {
    expect(wxssContent).toContain('display: flex');
  });

  test('头像圆框应为圆形', function () {
    expect(wxssContent).toContain('border-radius: 56rpx');
  });

  test('应包含自定义导航栏样式', function () {
    expect(wxssContent).toContain('list-nav');
  });
});

// ==================== 页面间集成测试 ====================

describe('宝宝列表页 (Baby List) - 页面间集成', function () {
  var storageKeysContent: string;

  beforeAll(function () {
    if (fs.existsSync(STORAGE_KEYS_PATH)) {
      storageKeysContent = fs.readFileSync(STORAGE_KEYS_PATH, 'utf-8');
    } else {
      storageKeysContent = '';
    }
  });

  test('STORAGE_KEYS 应定义 currentBabyId', function () {
    if (storageKeysContent) {
      expect(storageKeysContent).toContain('currentBabyId');
    }
  });

  test('TS 文件应导入 STORAGE_KEYS', function () {
    var tsContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_list.ts'), 'utf-8');
    expect(tsContent).toContain('STORAGE_KEYS');
  });
});