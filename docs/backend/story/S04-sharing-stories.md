# S04 - 家人共享故事 (Family Sharing Stories)

> 关联 Feature: F04 家人共享系统 | 目标迭代: v2.0

---

## 用户故事 (User Stories)

### US-SHARE-01: 邀请家人查看宝宝照片

**作为** 妈妈
**我想要** 邀请宝宝的爷爷奶奶加入
**以便** 他们可以随时看到宝宝的最新照片

**验收条件**:
- 设置页 → 分享设置 → 选择宝宝 → 调用 wx.shareAppMessage()
- 发送的微信卡片包含「查看 ta 的成长相册」文案
- 邀请状态可查看（已发送 / 已接受 / 已过期）

---

### US-SHARE-02: 接受家人邀请

**作为** 爷爷
**我想要** 通过微信卡片打开小程序
**以便** 查看孙女的成长照片

**验收条件**:
- 点击卡片打开小程序，URL 参数含 shareToken
- 调用 POST /api/v1/share/accept 验证并接受
- 展示邀请信息（谁邀请、查看哪个宝宝）
- 点击「接受」后进入相册查看页
- 过期 token 提示「邀请已过期，请联系邀请人重新发送」

---

### US-SHARE-03: 在首页查看共享宝宝

**作为** 被邀请人
**我想要** 在首页看到共享给我的宝宝
**以便** 与自己的宝宝切换查看

**验收条件**:
- 首页折叠态 Header 展示共享宝宝头像（带「共享」标记）
- 点击切换到该共享宝宝的时间轴
- UI 标识「由 xxx 分享」
- 无上传按钮（仅查看）

---

### US-SHARE-04: 取消共享

**作为** 妈妈
**我想要** 随时取消某个家庭成员的查看权限
**以便** 控制宝宝照片的隐私

**验收条件**:
- 分享设置页展示所有共享关系
- 点击 DELETE /api/v1/share/relations/:id
- 取消后对方无法再查看
- 已取消的共享在列表中标记「已取消」

---

## 技术故事 (Technical Stories)

### TS-SHARE-01: 创建分享邀请接口

**描述**: 实现 POST /api/v1/share/invitations

**涉及文件**:
- `server/src/routes/share.ts`

**实现要点**:
- 输入: { babyId, permission }
- 生成 shareToken = UUID
- INSERT INTO share_invitations
- 返回 shareToken（用于拼接到分享路径）

---

### TS-SHARE-02: 接受邀请接口

**描述**: 实现 POST /api/v1/share/accept

**涉及文件**:
- `server/src/routes/share.ts`

**实现要点**:
- 输入: { shareToken }
- 验证 token 存在 + 未过期 + 未被接受
- UPDATE status='accepted'
- INSERT INTO share_relations
- 返回共享关系信息

---

### TS-SHARE-03: 获取共享宝宝列表接口

**描述**: 实现 GET /api/v1/share/babies

**涉及文件**:
- `server/src/routes/share.ts`

**实现要点**:
- 查询 share_relations WHERE viewer_user_id
- JOIN babies 获取宝宝名称、头像
- 返回宝宝列表 + 权限信息 + 所有者昵称

---

### TS-SHARE-04: 共享数据查询权限

**描述**: 媒体列表接口增加共享数据查询

**涉及文件**:
- `server/src/routes/media.ts`

**实现要点**:
- GET /media 增加查询逻辑:
  `WHERE (user_id = ?) OR (baby_id IN (SELECT baby_id FROM share_relations WHERE viewer_user_id = ?))`
- 返回数据中增加 isShared 标记

---

### TS-SHARE-05: 微信分享卡片

**描述**: 通过 onShareAppMessage 生成分享卡片

**涉及文件**:
- 小程序端相关页面

**实现要点**:
- 自定义分享标题: 「一起看[宝宝昵称]的成长相册」
- 分享路径: `/pages/album_home/album_home?shareToken=xxx`
- app.ts onLaunch 检测 shareToken 参数 → 调 accept 接口

---

## Story 与 Feature 的关联

```
F04 家人共享系统
├── US-SHARE-01 邀请家人查看
├── US-SHARE-02 接受家人邀请
├── US-SHARE-03 在首页查看共享宝宝
├── US-SHARE-04 取消共享
├── TS-SHARE-01 创建分享邀请接口
├── TS-SHARE-02 接受邀请接口
├── TS-SHARE-03 获取共享宝宝列表接口
├── TS-SHARE-04 共享数据查询权限
└── TS-SHARE-05 微信分享卡片
```
