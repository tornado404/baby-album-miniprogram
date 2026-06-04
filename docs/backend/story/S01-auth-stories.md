# S01 - 认证相关故事 (Auth Stories)

> 关联 Feature: F01 用户认证与账户系统

---

## 用户故事 (User Stories)

### US-AUTH-01: 静默登录

**作为** 新用户
**我想要** 打开小程序后自动完成登录
**以便** 无需手动注册即可开始使用

**验收条件**:
- 首次打开小程序，3秒内完成静默登录
- 无需用户手动点击「登录」按钮
- 登录失败时显示友好提示并允许重试

---

### US-AUTH-02: 老用户自动登录

**作为** 已注册用户
**我想要** 再次打开小程序时自动恢复登录态
**以便** 无需每次重新登录

**验收条件**:
- Token 有效期内直接进入首页
- Token 过期后前端自动刷新，用户无感知

---

### US-AUTH-03: 账户信息查看

**作为** 用户
**我想要** 在「我的」页面查看自己的头像、昵称和使用统计
**以便** 了解自己的使用情况

**验收条件**:
- 设置页正确展示用户微信头像和昵称
- 数据统计（记录天数、照片数等）准确

---

## 技术故事 (Technical Stories)

### TS-AUTH-01: 项目初始化与 FastAPI 骨架

**描述**: 搭建 Python + FastAPI 项目骨架

**涉及文件**:
- `pyproject.toml`
- `app/main.py`
- `app/middleware/auth.py`

**实现要点**:
- FastAPI 项目结构
- middleware: JWT 鉴权、CORS、请求日志、错误统一处理
- 环境变量管理 (.env)

---

### TS-AUTH-02: 微信登录接口

**描述**: 实现 POST /api/v1/auth/login

**涉及文件**:
- `app/routers/auth.py`
- `app/services/auth_service.py`

**实现要点**:
- 接收前端传来的 wx.login() code
- 服务端调用 `https://api.weixin.qq.com/sns/jscode2session` 换取 openId
- 查 users 表，不存在则 INSERT
- 签发 JWT (accessToken, refreshToken)
- 返回 token + userId + isNewUser

---

### TS-AUTH-03: JWT 中间件

**描述**: 实现 JWT 鉴权 FastAPI 中间件

**涉及文件**:
- `app/middleware/auth.py`

**实现要点**:
- 解析 Authorization: Bearer <token>
- 验证 JWT 签名 + 有效期
- 将 userId 注入 req.user
- 无效/过期返回 401

---

### TS-AUTH-04: Token 刷新接口

**描述**: 实现 POST /api/v1/auth/refresh

**涉及文件**:
- `app/routers/auth.py`

**实现要点**:
- 接收 refreshToken
- 验证有效性后签发新的 accessToken
- accessToken 有效期 2h

---

### TS-AUTH-05: API 请求封装（前端）

**描述**: 封装 wx.request，统一处理鉴权和 token 刷新

**涉及文件**:
- `miniprogram/services/api.ts`（新增）

**实现要点**:
- 统一添加 Authorization header
- 响应 401 时自动调 /auth/refresh 刷新 token
- 刷新失败清除 token，引导重新登录
- 请求/响应拦截器模式

---

### TS-AUTH-06: 数据库初始化

**描述**: 创建 PostgreSQL 数据库及表结构

**涉及文件**:
- `migrations/versions/`

**实现要点**:
- `CREATE TABLE users (...)`
- `CREATE TABLE babies (...)`
- `CREATE TABLE media (...)`
- 索引创建

---

## Story 与 Feature 的关联

```
F01 用户认证与账户
├── US-AUTH-01 静默登录
├── US-AUTH-02 老用户自动登录
├── US-AUTH-03 账户信息查看
├── TS-AUTH-01 项目初始化与 FastAPI 骨架
├── TS-AUTH-02 微信登录接口
├── TS-AUTH-03 JWT 中间件
├── TS-AUTH-04 Token 刷新接口
├── TS-AUTH-05 API 请求封装（前端）
└── TS-AUTH-06 数据库初始化
```
