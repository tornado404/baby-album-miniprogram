# styles 目录

本目录存放微信小程序的全局样式文件。

## 目录结构

```
styles/
├── variables.wxss    # CSS 变量和主题配置
├── common.wxss       # 全局公共样式类和工具类
└── CLAUDE.md        # 本文件
```

## 文件说明

### variables.wxss

定义全局 CSS 变量（Custom Properties），包括：

- **主题颜色**：primary、secondary、accent 等
- **文字颜色**：primary、secondary、tertiary、disabled
- **背景颜色**：页面背景、白色背景、遮罩层
- **边框颜色**：浅、中、深三种边框色
- **间距**：xs、sm、md、lg、xl 五档间距
- **圆角**：sm、md、lg、xl、full 五档圆角
- **字体大小**：xs 至 xxl 六档字号
- **行高**：tight、normal、loose 三档行高
- **阴影**：sm、md、lg 三档阴影
- **动画时长**：fast、normal、slow 三档过渡时间

### common.wxss

全局可复用的样式类，包括：

- **文字省略**：`.ellipsis`（单行）、`.ellipsis-2`（2行）、`.ellipsis-3`（3行）
- **清除浮动**：`.clearfix`
- **文本对齐**：`.text-left`、`.text-center`、`.text-right`
- **Flex 布局**：`.flex`、`.flex-column`、`.flex-center`、`.flex-between` 等
- **内外边距**：基于 `--spacing-*` 变量的便捷类
- **1px 边框**：`.hairline-top`、`.hairline-bottom` 等
- **卡片样式**：`.card`

## 使用方式

全局样式统一在 `app.wxss` 中引入，**所有页面和组件无需再单独 import**：

```wxss
/* app.wxss */
@import "/styles/variables.wxss";
@import "/styles/common.wxss";
```

路径使用 `/styles/xxx.wxss`（从项目根目录开始），而非 `../styles/xxx.wxss`。

引入后，所有页面和组件可直接使用变量和公共类：

```wxss
.page {
  background: var(--bg-color);
  color: var(--text-primary);
}

.title {
  font-size: var(--font-size-lg);
  color: var(--primary-color);
}

.ellipsis {
  /* 已定义 */
}
```

## 编写规范

1. **变量命名**：采用 CSS 变量格式 `--xxx-yyy`，使用小写字母和连字符
2. **颜色值**：优先使用十六进制格式，如 `#07c160`
3. **尺寸单位**：微信小程序推荐使用 `rpx`，全局保持一致
4. **避免冲突：类名添加项目前缀或采用语义化命名，防止与组件库冲突
5. **勿直接写死**：样式中优先使用变量，便于主题切换和维护
6. **保持简洁**：工具类只提供最常用的样式，避免过度封装

## 注意事项

- CSS 变量在 `page` 作用域下定义，可在整个页面生效
- Vant Weapp 组件已使用 `var()` 引用自身变量，引入本目录样式不会覆盖组件内部样式
- 组件内部样式仍使用自身隔离的样式域，不受全局变量影响
