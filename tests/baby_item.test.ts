/**
 * 宝宝信息编辑页 (Baby Item) 测试用例
 * 测试目标: 页面文件存在性、注册、配置、数据逻辑、事件处理
 */

var fs = require('fs');
var path = require('path');

var MINIPROGRAM_DIR = path.resolve(__dirname, '../miniprogram');
var PAGES_DIR = path.join(MINIPROGRAM_DIR, 'pages/baby_item');

// ==================== 页面文件存在性测试 ====================

describe('宝宝信息编辑页 (Baby Item) - 文件存在性', function () {
  var requiredFiles = [
    'baby_item.ts',
    'baby_item.js',
    'baby_item.wxml',
    'baby_item.wxss',
    'baby_item.json',
  ];

  requiredFiles.forEach(function (filename) {
    test(filename + ' 文件应存在', function () {
      var filePath = path.join(PAGES_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

// ==================== 页面注册测试 ====================

describe('宝宝信息编辑页 (Baby Item) - 页面注册', function () {
  var appJson: any;

  beforeAll(function () {
    var appJsonPath = path.join(MINIPROGRAM_DIR, 'app.json');
    var content = fs.readFileSync(appJsonPath, 'utf-8');
    content = content.replace(/^﻿/, '');
    appJson = JSON.parse(content);
  });

  test('baby_item 页面应注册在 app.json 的 pages 数组中', function () {
    expect(appJson.pages).toBeDefined();
    expect(Array.isArray(appJson.pages)).toBe(true);
    expect(appJson.pages.indexOf('pages/baby_item/baby_item')).toBeGreaterThan(-1);
  });
});

// ==================== 页面配置测试 ====================

describe('宝宝信息编辑页 (Baby Item) - 页面配置', function () {
  var pageJson: any;

  beforeAll(function () {
    var content = fs.readFileSync(path.join(PAGES_DIR, 'baby_item.json'), 'utf-8');
    content = content.replace(/^﻿/, '');
    pageJson = JSON.parse(content);
  });

  test('应使用 custom 导航栏', function () {
    expect(pageJson.navigationStyle).toBe('custom');
  });
});

// ==================== JS 逻辑测试 ====================

describe('宝宝信息编辑页 (Baby Item) - JS 逻辑', function () {
  var jsContent: string;

  beforeAll(function () {
    jsContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_item.js'), 'utf-8');
  });

  // ---- 核心功能 ----

  test('应导入 STORAGE_KEYS', function () {
    expect(jsContent).toContain('storage_keys');
  });

  test('应导入 tokenManager', function () {
    expect(jsContent).toContain('tokenManager');
  });

  test('应定义 MILESTONES 数组（最少 8 个里程碑）', function () {
    expect(jsContent).toContain('MILESTONES');
    // Count unique milestone entries by finding the array values
    var match = jsContent.match(/MILESTONES\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    if (match) {
      var items = match[1].split(',').filter(function(s) { return s.trim().length > 0; });
      expect(items.length).toBeGreaterThanOrEqual(8);
    }
  });

  // ---- Data 字段 ----

  test('data 应包含 babyName 字段', function () {
    expect(jsContent).toContain('babyName');
  });

  test('data 应包含 birthDate 字段', function () {
    expect(jsContent).toContain('birthDate');
  });

  test('data 应包含 selectedMilestone 字段', function () {
    expect(jsContent).toContain('selectedMilestone');
  });

  test('data 应包含 showMilestonePicker 字段', function () {
    expect(jsContent).toContain('showMilestonePicker');
  });

  test('data 应包含 description 字段', function () {
    expect(jsContent).toContain('description');
  });

  test('data 应包含 charCount 和 maxChars 字段', function () {
    expect(jsContent).toContain('charCount');
    expect(jsContent).toContain('maxChars');
  });

  test('maxChars 默认应为 200', function () {
    expect(jsContent).toContain('200');
  });

  test('data 应包含 isLoading 和 isSaving 字段', function () {
    expect(jsContent).toContain('isLoading');
    expect(jsContent).toContain('isSaving');
  });

  // ---- 事件处理方法 ----

  test('应包含 onDateChange 日期选择方法', function () {
    expect(jsContent).toContain('onDateChange');
  });

  test('应包含 onMilestoneTap 里程碑下拉切换', function () {
    expect(jsContent).toContain('onMilestoneTap');
  });

  test('应包含 onMilestoneSelect 里程碑选择', function () {
    expect(jsContent).toContain('onMilestoneSelect');
  });

  test('应包含 onDescriptionInput 文本输入处理', function () {
    expect(jsContent).toContain('onDescriptionInput');
  });

  test('onDescriptionInput 应限制最大字符数', function () {
    expect(jsContent).toContain('substring');
    expect(jsContent).toContain('maxChars');
  });

  // ---- 数据加载 ----

  test('应包含 loadBabyData 方法（API 获取）', function () {
    expect(jsContent).toContain('loadBabyData');
  });

  test('应包含 loadFromLocal 方法（本地降级）', function () {
    expect(jsContent).toContain('loadFromLocal');
  });

  test('应包含 setBabyData 方法', function () {
    expect(jsContent).toContain('setBabyData');
  });

  // ---- 保存逻辑 ----

  test('应包含 onSave 保存方法', function () {
    expect(jsContent).toContain('onSave');
  });

  test('应包含 updateBaby 方法', function () {
    expect(jsContent).toContain('updateBaby');
  });

  test('应包含 createBaby 方法', function () {
    expect(jsContent).toContain('createBaby');
  });

  test('应包含 syncLocal 方法（本地同步）', function () {
    expect(jsContent).toContain('syncLocal');
  });

  // ---- 头像上传 ----

  test('应包含 onAvatarTap 头像点击方法', function () {
    expect(jsContent).toContain('onAvatarTap');
  });

  test('应包含 uploadAvatar 方法', function () {
    expect(jsContent).toContain('uploadAvatar');
  });

  test('uploadAvatar 应使用 wx.uploadFile', function () {
    expect(jsContent).toContain('wx.uploadFile');
  });

  // ---- 页面生命周期 ----

  test('应包含 onLoad 页面加载方法', function () {
    expect(jsContent).toContain('onLoad');
  });

  test('onLoad 应读取 currentBabyId 缓存', function () {
    expect(jsContent).toContain('STORAGE_KEYS.currentBabyId');
  });

  test('应包含 onBack 返回导航', function () {
    expect(jsContent).toContain('onBack');
  });

  // ---- 错误处理 ----

  test('wx.getStorageSync 调用应有 try-catch', function () {
    expect(jsContent).toContain('try');
    expect(jsContent).toContain('catch');
  });

  test('setStorageSync 调用应有 try-catch', function () {
    var tryCount = (jsContent.match(/try/g) || []).length;
    expect(tryCount).toBeGreaterThanOrEqual(3);
  });
});

// ==================== WXML 结构测试 ====================

describe('宝宝信息编辑页 (Baby Item) - WXML 结构', function () {
  var wxmlContent: string;

  beforeAll(function () {
    wxmlContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_item.wxml'), 'utf-8');
  });

  // ---- 导航 ----

  test('应包含返回按钮', function () {
    expect(wxmlContent).toContain('onBack');
  });

  test('应包含保存按钮', function () {
    expect(wxmlContent).toContain('保存');
    expect(wxmlContent).toContain('onSave');
  });

  test('标题应为 "宝宝信息"', function () {
    expect(wxmlContent).toContain('宝宝信息');
  });

  // ---- 头像 ----

  test('应包含头像区', function () {
    expect(wxmlContent).toContain('avatar-section');
    expect(wxmlContent).toContain('onAvatarTap');
  });

  test('应包含相机徽章', function () {
    expect(wxmlContent).toContain('📷');
  });

  test('应包含"点击上传头像"提示', function () {
    expect(wxmlContent).toContain('点击上传头像');
  });

  // ---- 表单字段 ----

  test('应包含日期选择器', function () {
    expect(wxmlContent).toContain('mode="date"');
    expect(wxmlContent).toContain('onDateChange');
  });

  test('出生日期标签应存在', function () {
    expect(wxmlContent).toContain('出生日期');
  });

  test('应包含里程碑选择', function () {
    expect(wxmlContent).toContain('onMilestoneTap');
    expect(wxmlContent).toContain('里程碑');
  });

  test('里程碑下拉选项应存在', function () {
    expect(wxmlContent).toContain('milestone-dropdown');
    expect(wxmlContent).toContain('milestone-option');
  });

  test('应包含描述多行文本输入', function () {
    expect(wxmlContent).toContain('textarea');
  });

  test('textarea 应设置 placeholder', function () {
    expect(wxmlContent).toContain('记录宝宝此时此刻的精彩瞬间');
  });

  test('应包含字符计数', function () {
    expect(wxmlContent).toContain('charCount');
    expect(wxmlContent).toContain('maxChars');
  });

  // ---- 状态 ----

  test('应包含加载中状态', function () {
    expect(wxmlContent).toContain('isLoading');
    expect(wxmlContent).toContain('加载中');
  });
});

// ==================== WXSS 样式测试 ====================

describe('宝宝信息编辑页 (Baby Item) - WXSS 样式', function () {
  var wxssContent: string;

  beforeAll(function () {
    wxssContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_item.wxss'), 'utf-8');
  });

  test('应使用 Claymorphism 背景色 #fffbf8', function () {
    expect(wxssContent).toContain('#fffbf8');
  });

  test('应包含卡片阴影效果', function () {
    expect(wxssContent).toContain('box-shadow');
  });

  test('保存按钮应为橙色', function () {
    expect(wxssContent).toContain('#ffa87a');
  });

  test('应包含头像区样式', function () {
    expect(wxssContent).toContain('avatar-section');
    expect(wxssContent).toContain('avatar-circle');
  });

  test('应包含表单字段样式', function () {
    expect(wxssContent).toContain('form-field');
  });

  test('应包含文本域样式', function () {
    expect(wxssContent).toContain('text-area');
  });

  test('应包含里程碑下拉菜单样式', function () {
    expect(wxssContent).toContain('milestone-dropdown');
    expect(wxssContent).toContain('milestone-option');
  });

  test('应包含圆角样式', function () {
    expect(wxssContent).toContain('border-radius');
  });

  test('字符计数应为小字', function () {
    expect(wxssContent).toContain('char-count');
  });
});

// ==================== 页面间集成测试 ====================

describe('宝宝信息编辑页 (Baby Item) - 页面间集成', function () {
  test('TS 文件应导入 STORAGE_KEYS', function () {
    var tsContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_item.ts'), 'utf-8');
    expect(tsContent).toContain('STORAGE_KEYS');
  });

  test('TS 文件应导入 API_CONFIG', function () {
    var tsContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_item.ts'), 'utf-8');
    expect(tsContent).toContain('API_CONFIG');
  });

  test('TS 文件应导入 tokenManager', function () {
    var tsContent = fs.readFileSync(path.join(PAGES_DIR, 'baby_item.ts'), 'utf-8');
    expect(tsContent).toContain('tokenManager');
  });
});