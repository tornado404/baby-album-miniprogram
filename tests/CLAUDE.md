# Tests/CLAUDE.md

本目录存放项目单元测试（`*.test.ts`）和 E2E 测试（`specs/*.spec.ts`）。

## 纠错经验：单测通过 ≠ 项目能跑

### 案例 1：`this` 作用域泄漏（异步回调）

**现象**：`app.ts` 中 `wx.request` 的 `success` 回调调用 `this.refreshToken()`，运行时抛 `TypeError: Cannot read property 'refreshToken' of undefined`

**原因**：`wx.request` 的回调函数中 `this` 指向 request 上下文而非 App 实例。TypeScript 编译不报错（类型已转为 ES5），单测也覆盖不到 App 入口逻辑。

**教训**：在 App/Page/Component 方法中发起 `wx.request` 时，**始终**在闭包外保存 `this` 引用：
```typescript
// ✅ 正确
var that = this;
wx.request({
  url: '...',
  success: function (res) {
    that.doSomething();  // 用 that，不用 this
  },
});

// ✅ 也可以用箭头函数（TypeScript 编译后会转为 ES5）
wx.request({
  url: '...',
  success: (res) => {
    this.doSomething();
  },
});
```

### 案例 2：WXSS 多余闭合括号

**现象**：`album_home.wxss:170` — `error at token '}'`

**原因**：CSS 块结束后多了一个 `}`，IDE 不报错，单测不检查，微信开发者工具编译时才会报错。

**教训**：编辑 WXSS 后：
1. 保存前检查大括号是否成对
2. 用格式化工具（VS Code 的 CSS 格式化 / WXSS 格式化插件）自动检查
3. **必须在微信开发者工具中验证编译通过**，不可仅依赖 IDE 视图

### 为什么单测覆盖不到

| 错误类型 | 触发阶段 | 单测能否捕获 |
|----------|----------|-------------|
| `this` 作用域泄露 | 运行时（异步回调） | ❌ — 需要真实 WeChat 环境 |
| WXSS 语法错误 | 微信编译阶段 | ❌ — 纯样式层问题 |
| app.json 配置错误 | 微信编译阶段 | ❌ — 微信专有配置 |
| 第三方组件未构建 | 微信编译阶段 | ❌ — 需要 npm 构建 |

### 预防 checklist

提交或合并前：
- [ ] 微信开发者工具真实编译通过（工具 → 构建 npm → 编译）
- [ ] 所有 `wx.request`/`wx.xxx` 回调检查 `this` 引用
- [ ] WXSS 文件无多余 `}`（可全局搜索 `^}$` 手动审视）
- [ ] `app.ts` 中无未处理的 `this.refreshToken` 等潜在 crash 点