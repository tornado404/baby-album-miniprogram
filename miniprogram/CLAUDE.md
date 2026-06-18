# miniprogram/CLAUDE.md

## Skyline 渲染器注意事项

`album_home` 页面使用 Skyline 渲染器，与其他 WebView 页面行为不同。

### 禁止使用的 WXML 模式

| 模式 | 问题 | 替代方案 |
|------|------|----------|
| `<block wx:for>` | Skyline 报错 `Element iterators can only be used in elements or text nodes` | 直接在 `<view wx:for>` 上迭代 |
| `scroll-view` + `enable-flex` | Skyline 不支持，页面白屏 | 移除该属性 |
| `overflow-y: auto` / `overflow-y: scroll` 在 scroll-view 上 | Skyline 使用自己的滚动机制 | 移除这些 CSS 属性 |
| `wx:else` 分支内含 `wx:for` | Skyline 编译阶段会在非元素节点上创建迭代器，报错 `Element iterators can only be used in elements or text nodes` | 将 `wx:else` 改为 `wx:elif="{{!cond1 && !cond2}}"` 显式条件 |

### 瀑布流布局的实现约束

使用 `<block wx:for>` + 内部 `<view wx:if>` 筛选左右列的实现在 Skyline 中不工作。必须：

1. 在 JS 中预先将数据拆分为 `leftItems`/`rightItems` 两个数组
2. WXML 中直接对两个数组分别使用 `<view wx:for>`
3. 不要在同一组件上同时使用 `wx:for` 和 `wx:if`

参见 `album_home.ts:groupByMilestone()` 的实现。

## 组件注册策略

### 全局注册 vs 页面本地注册

`glass-easel` 组件框架下，全局注册的组件（在 `app.json` 的 `usingComponents` 中）在 Skyline 页面中可能触发错误：

```
Cannot read property '__subscribe_webviewId' of undefined
```

**规则**：自定义业务组件（如 `bottom-nav`）必须在每个使用页面的独立 `.json` 文件中注册，不要在 `app.json` 中全局注册。

TDesign 等第三方组件库可以继续在 `app.json` 中全局注册，不影响 Skyline 页面。

### 使用 bottom-nav 的页面清单

每个使用到 `<bottom-nav>` 的页面必须在自己的 `.json` 中配置：

```json
{
  "usingComponents": {
    "bottom-nav": "/components/bottom-nav/bottom-nav"
  }
}
```

当前使用的页面：`album_home`、`upload`、`settings`、`gallery`、`journey`

## 页面路由

- 应用未配置 `tabBar`，禁止使用 `wx.switchTab()`
- Tab 切换使用 `wx.redirectTo()`
- 首页入口使用 `wx.reLaunch()`