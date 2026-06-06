/**
 * skyline_compat.test.ts - Skyline 渲染器 CSS 兼容性检查
 *
 * Skyline 支持的伪元素: ::before, ::after
 * Skyline 支持的伪类: :first-child, :last-child
 * 不支持的: ::-webkit-scrollbar, :focus, :not(), :active 等
 *
 * 此测试扫描页面 wxss 文件，检测不兼容的选择器。
 */

import * as fs from 'fs';
import * as path from 'path';

// 项目页面目录
const PAGES_DIR = path.resolve(__dirname, '../miniprogram/pages');

// Skyline 渲染的页面（album_home）
const SKYLINE_PAGES = ['album_home'];

// 不支持的 CSS 选择器模式
const UNSAFE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /:::-webkit-scrollbar/g, reason: '伪元素只支持 ::before, ::after' },
  { pattern: /::-(moz|ms|o|webkit)-/g, reason: '浏览器私有伪元素不支持' },
  { pattern: /:not\(/g, reason: ':not() 伪类不支持' },
  { pattern: /:focus/g, reason: ':focus 伪类不支持' },
  { pattern: /:hover/g, reason: ':hover 伪类不支持（Skyline）' },
  { pattern: /:active/g, reason: ':active 伪类不支持（Skyline）' },
  { pattern: /:nth-child/g, reason: ':nth-child 伪类不支持' },
  { pattern: /:nth-of-type/g, reason: ':nth-of-type 伪类不支持' },
  { pattern: /:disabled/g, reason: ':disabled 伪类不支持' },
  { pattern: /touch-action:/g, reason: 'touch-action 属性不支持' },
  { pattern: /cursor:/g, reason: 'cursor 属性不支持' },
  { pattern: /user-select:/g, reason: 'user-select 属性不支持' },
  { pattern: /outline:/g, reason: 'outline 属性不支持' },
  { pattern: /-webkit-appearance/g, reason: '-webkit-appearance 不支持' },
  { pattern: /-webkit-tap-highlight/g, reason: '-webkit-tap-highlight-color 不支持' },
  { pattern: /word-wrap:/g, reason: 'word-wrap 不支持（用 overflow-wrap）' },
];

describe('Skyline CSS 兼容性检查', () => {
  // 收集所有页面 wxss 文件
  const pageWxssFiles: string[] = [];
  const pageDirs = fs.readdirSync(PAGES_DIR, { withFileTypes: true });

  for (const dir of pageDirs) {
    if (dir.isDirectory()) {
      const wxssPath = path.join(PAGES_DIR, dir.name, dir.name + '.wxss');
      if (fs.existsSync(wxssPath)) {
        pageWxssFiles.push(wxssPath);
      }
    }
  }

  describe('所有页面通用检查', () => {
    for (const wxssFile of pageWxssFiles) {
      const pageName = path.basename(path.dirname(wxssFile));
      const content = fs.readFileSync(wxssFile, 'utf-8');
      const isSkyline = SKYLINE_PAGES.includes(pageName);

      for (const { pattern, reason } of UNSAFE_PATTERNS) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          // Skyline 页面严格要求无兼容问题
          if (isSkyline) {
            test(`[SKYLINE] ${pageName}.wxss 不应包含 ${reason}（发现 ${matches.length} 处）`, () => {
              expect(matches.length).toBe(0);
            });
          }
          // 非 Skyline 页面记录为 warning（非 fatal）
          else if (matches.length > 0) {
            test(`[WARN] ${pageName}.wxss 包含 ${reason}（${matches.length} 处，非 Skyline 页面可接受）`, () => {
              // 非强制，仅记录
              expect(true).toBe(true);
            });
          }
        }
      }
    }
  });

  // 专门检查 album_home（Skyline 页面）
  describe('Album Home（Skyline）重点检查', () => {
    const skylineWxss = path.join(PAGES_DIR, 'album_home', 'album_home.wxss');
    if (!fs.existsSync(skylineWxss)) return;

    const content = fs.readFileSync(skylineWxss, 'utf-8');

    test('不应包含 ::-webkit-scrollbar', () => {
      expect(content).not.toMatch(/:::-webkit-scrollbar/);
    });

    test('不应包含 touch-action', () => {
      expect(content).not.toMatch(/touch-action:/);
    });

    test('不应包含 :focus 伪类', () => {
      expect(content).not.toMatch(/:focus/);
    });

    test('不应包含 :hover 伪类', () => {
      expect(content).not.toMatch(/:hover/);
    });

    test('不应包含 cursor 属性', () => {
      expect(content).not.toMatch(/cursor:/);
    });

    test('不应包含 user-select 属性', () => {
      expect(content).not.toMatch(/user-select:/);
    });
  });

  // TDesign 组件库检查（仅报告，不中断）
  describe('TDesign 组件库兼容性（仅报告）', () => {
    const npmDir = path.resolve(__dirname, '../miniprogram/miniprogram_npm/tdesign-miniprogram');

    function scanDir(dir: string, results: Array<{ file: string; issues: string[] }>) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          scanDir(fullPath, results);
        } else if (entry.name.endsWith('.wxss')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const issues: string[] = [];
          // 检查 Skyline 不支持的关键属性
          if (content.includes(':focus')) issues.push(':focus');
          if (content.includes(':not(')) issues.push(':not()');
          if (content.includes('touch-action:')) issues.push('touch-action');
          if (content.includes('cursor:')) issues.push('cursor');
          if (content.includes('-webkit-appearance:')) issues.push('-webkit-appearance');
          if (content.includes('user-select:')) issues.push('user-select');
          if (issues.length > 0) {
            results.push({ file: fullPath.replace(npmDir, ''), issues });
          }
        }
      }
    }

    const tdesignIssues: Array<{ file: string; issues: string[] }> = [];
    scanDir(npmDir, tdesignIssues);

    test('TDesign Skyline 兼容问题统计', () => {
      if (tdesignIssues.length > 0) {
        console.log(`\n  ⚠ TDesign 组件库发现 ${tdesignIssues.length} 个文件有 Skyline 不兼容的 CSS:`);
        for (const { file, issues } of tdesignIssues.slice(0, 5)) {
          console.log(`    ${file}: ${issues.join(', ')}`);
        }
        if (tdesignIssues.length > 5) {
          console.log(`    ... 还有 ${tdesignIssues.length - 5} 个文件`);
        }
      }
      // 这些是已知问题，不导致测试失败
      expect(true).toBe(true);
    }, 10000);
  });
});