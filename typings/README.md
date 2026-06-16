# TypeScript 类型定义

本目录存放项目的 TypeScript 类型声明文件。

## 目录结构

```
typings/
├── index.d.ts        # 全局类型声明入口
├── models/           # 数据模型类型
│   ├── baby.ts       # 宝宝档案模型
│   ├── baby_age.ts   # 宝宝年龄模型
│   └── media.ts      # 媒体模型
└── types/            # 微信 API 类型
    └── index.d.ts    # 微信小程序 API 类型扩展
```

## 使用方式

类型定义通过 `index.d.ts` 统一导出，在 `tsconfig.json` 中配置：

```json
{
  "typeRoots": ["./typings", "./node_modules/@types"]
}
```

## 数据模型

### Baby

宝宝档案模型，包含基本信息、统计数据等。

```typescript
interface Baby {
  id: string;
  name: string;
  birthDate?: string;      // YYYY-MM-DD
  gender?: BabyGender;     // male | female | unknown
  avatar?: string;
  dueDate?: string;
  weight?: string;
  height?: string;
  order?: number;
  photoCount?: number;
  videoCount?: number;
  recordDays?: number;
  createdAt: string;
  updatedAt?: string;
}
```

### Media

媒体数据模型，支持照片和视频。

```typescript
interface Media {
  id: string;
  babyId: string;
  type: MediaType;         // photo | video
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  size: number;
  cosUrl?: string;
  cosKey?: string;
  fileSize?: number;
  locationName?: string;
  moment?: string;
  milestone?: string;
  isArchived?: boolean;
  title?: string;
  captureDate: string;
  babyAge?: BabyAge;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### BabyAge

宝宝月龄信息。

```typescript
interface BabyAge {
  years: number;
  months: number;
  days: number;
}
```

## 相关文档

- [TypeScript 配置](../miniprogram/tsconfig.json)
- [开发规范](../docs/06-standards/dev_rules.md)
