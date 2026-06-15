# 开发规范与常见错误总结

> **版本**: v1.0 | **最后更新**: 2026-06-15
> **状态**: ✅ 已定稿 | **配套**: `miniprogram/tsconfig.json`（编译配置）

本文档归档本项目开发过程中反复出现的错误特征，作为后续开发的参考规范。

---

## 一、微信小程序语法限制

微信小程序**不支持 ES2020+ 语法**，编译时不报错但 runtime 会报 `SyntaxError: Unexpected token`。

### 1.1 禁止使用的语法

| 语法 | 说明 | 替代方案 |
|------|------|----------|
| `?.` | 可选链 | `obj && obj.prop` |
| `??` | 空值合并 | `val !== null ? val : default` |
| `??=` | 空值赋值 | `if (val === null) val = default` |
| `?.()` | 可选调用 | `fn && fn()` |

**示例**：
```typescript
// 错误
const name = baby?.name ?? '未命名';
const handler = obj?.getHandler?.();

// 正确
const name = baby && baby.name !== null ? baby.name : '未命名';
const handler = obj && obj.getHandler ? obj.getHandler() : null;
```

### 1.2 类字段语法限制

ES6 类字段声明语法**不支持**，必须使用 constructor 赋值：

```typescript
// 错误 - ES6 类字段语法
class StorageService {
  private PREFIX = 'album_';
  private cache: { babies?: Baby[] } = { babies: [] };
}

// 正确 - constructor 赋值
class StorageService {
  private PREFIX: string;
  private cache: { babies?: Baby[] };

  constructor() {
    this.PREFIX = 'album_';
    this.cache = { babies: [] };
  }
}
```

### 1.3 函数声明限制

工具函数导出时避免箭头函数赋值：

```typescript
// 错误
export const formatTime = (date: Date): string => { ... };

// 正确
export function formatTime(date: Date): string { ... }
```

---

## 二、TypeScript 配置规范

### 2.1 Target 必须为 ES5

```json
{
  "compilerOptions": {
    "target": "ES5"  // 禁止使用 ES6/ES2020
  }
}
```

### 2.2 Vant 类型问题

`skipLibCheck: true` 用于跳过 node_modules 类型检查，避免第三方库类型冲突：

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

---

## 三、Vant Weapp 组件库规范

### 3.1 必须使用 @vant/weapp 版本

 vant-weapp 0.5.x 使用 ES 模块格式，微信小程序不支持。

```bash
# 错误
npm install vant-weapp

# 正确
npm install @vant/weapp
```

### 3.2 组件注册路径

组件**只允许在 app.json 中全局注册**，页面/组件的 `usingComponents` 中**不要**重复配置：

```json
// app.json - 正确
{
  "usingComponents": {
    "van-button": "miniprogram_npm/@vant/weapp/button/index"
  }
}

// 页面 .json - 错误，会导致路径拼接错误
{
  "usingComponents": {
    "van-button": "miniprogram_npm/@vant/weapp/button/index"  // 不要重复注册
  }
}
```

### 3.3 npm 构建要求

在 miniprogram 目录安装或更新 npm 包后，**必须**在微信开发者工具中重新构建 npm：
> 菜单：工具 -> 构建 npm

---

## 四、路径规范

### 4.1 类型导入路径

组件中导入 `typings/models` 时，路径层级与页面路径相关：

```typescript
// miniprogram/components/age_filter/age_filter.ts - 错误
import type { Baby } from '../../typings/models';

// miniprogram/components/age_filter/age_filter.ts - 正确
import type { Baby } from '../../../typings/models';
```

### 4.2 路径计算规则

```
页面文件: miniprogram/pages/album_home/album_home.ts
组件文件: miniprogram/components/age_filter/age_filter.ts

组件向上找两层: ../../../typings/models
```

---

## 五、全局类型声明规范

### 5.1 IAppOption 声明

微信小程序的全局 app 实例类型需要使用 `declare global` 扩展：

```typescript
// typings/index.d.ts
declare global {
  interface IAppOption {
    globalData: any;
    userInfo: any;
  }
}

export {};
```

### 5.2 避免重复导出

同一类型不要同时使用 `export *` 和显式导出：

```typescript
// 错误 - 重复导出
export * from './baby_age';
export { BabyAge } from './baby_age';

// 正确 - 只使用一种方式
export * from './baby_age';
// 或
export { BabyAge } from './baby_age';
```

---

## 六、npm 包结构

本项目采用**双 package.json 结构**：

| 位置 | 用途 |
|------|------|
| 根目录/ | 开发依赖（typescript, jest, ts-jest 等） |
| miniprogram/ | 运行依赖（@vant/weapp, miniprogram-api-typings 等） |

安装依赖时注意：
```bash
# 开发依赖 - 根目录
npm install -D typescript jest

# 运行依赖 - miniprogram 目录
cd miniprogram && npm install @vant/weapp
```

---

## 七、常见错误排查

| 错误现象 | 常见原因 | 解决方案 |
|----------|----------|----------|
| `SyntaxError: Unexpected token .` | 使用了 `?.` 或 `??` 语法 | 替换为 ES5 兼容语法 |
| 组件路径解析错误 | 重复注册组件 | 删除页面 json 中的 usingComponents |
| `IAppOption` 类型错误 | 缺少 global 声明 | 使用 `declare global` 扩展 |
| Vant 组件不显示 | 未构建 npm | 微信开发者工具：工具 -> 构建 npm |
| 类型找不到 | 导入路径错误 | 检查相对路径层级 |
