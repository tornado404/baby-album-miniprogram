# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeChat Mini Program (微信小程序) for tracking baby growth — **宝宝成长相册 (Baby Album)**.

- **GitHub**: https://github.com/tornado404/baby-album-miniprogram
- **Figma Design**: [宝宝成长日记 - Claymorphism UI](https://www.figma.com/design/KcqY6GUSvdn24Ur1qKkcim/%E5%AE%9D%E5%AE%9D%E6%88%90%E9%95%BF%E6%97%A5%E8%AE%B0---Claymorphism-UI)
- **AppID**: `wx5d0e66dc0e6fb16d`（在 `project.config.json` 中，不可移除）
- **Base Library**: `3.16.1`
- **Component Framework**: `glass-easel`

### 设计目标
- 记录宝宝成长照片/视频，带有**年龄里程碑**标注
- **Claymorphism UI**：暖色调（米白底 `#fffbf8`）、柔和阴影、大圆角
- 组件库：TDesign（全局注册）
- 渲染策略：**album_home 使用 Skyline**，其他页面使用默认 WebView

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────────────┐
│  WeChat MiniProgram  │────▶│  FastAPI Backend (server/)       │
│  (TypeScript + WXML) │     │  Python 3.11 + SQLAlchemy 2.0   │
│  TDesign Components  │     │  Celery + Redis                 │
└─────────────────────┘     └───────┬──────────────────────────┘
                                    │
                          ┌─────────┴──────────┐
                          │  PostgreSQL (15)    │
                          │  MinIO (S3)         │
                          │  Redis (7)          │
                          └────────────────────┘
```

### 三端代码结构

| Directory | Technology | Purpose |
|-----------|-----------|---------|
| `miniprogram/` | TypeScript + WXML/WXSS | WeChat Mini Program frontend |
| `server/` | Python FastAPI + SQLAlchemy | Backend API |
| `tests/` | Jest + ts-jest | Unit tests (frontend) |
| `scripts/` | Node.js + Python | Build, deploy, CI, screenshot utilities |

### 部署环境

| Environment | Server | Method |
|-------------|--------|--------|
| **Production** | `101.126.41.146` (Tencent Cloud, root) | `deploy-to-server.sh` |
| **Testing** | `192.168.50.126` (ARM dev board, linaro) | `deploy-arm.sh` |
| **Local Dev** | `localhost:8000` (Docker) | `docker-compose up` |

---

## Development Environment

- **WeChat DevTools**: Required for running/debugging the miniprogram
- **ARM Test Server**: `ssh linaro@192.168.50.126`（局域网免密，后端+数据库+MinIO+Redis）
- **Node.js**: 20+ (project uses 24 LTS)
- **Python**: 3.11+ (backend, managed via Poetry)

---

## Common Commands

### Testing
```bash
npm test                    # Run all tests (unit + e2e)
npm run test:unit           # Unit tests only (Jest `--selectProjects unit`)
npm run test:e2e            # E2E tests (requires DevTools running, `--runInBand`)
npm run test:first-screen   # First-screen E2E test only
npm run test:first-screen:auto  # First-screen + auto-launch DevTools (Windows)
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

### Miniprogram Development
```bash
npm run start:first-screen  # Standalone first-screen test (no Jest)
npm run capture:first-screen # Screenshot capture (DevTools must be visible)
cd miniprogram && npx tsc -p tsconfig.json  # TypeScript compilation
```

### npm Build (after installing/updating miniprogram dependencies)
```bash
# 1. Install in miniprogram/:
npm i tdesign-miniprogram -S --production
# 2. Rebuild npm in WeChat DevTools: 工具 → 构建 npm
# 3. Or run the fix script:
npm run build:npm    # Converts ES modules → CommonJS for miniprogram runtime
```

### Backend / Server
```bash
# Deploy to ARM test server
cd server && docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d --build

# Deploy to production cloud
bash scripts/deploy-to-server.sh

# Run backend tests (via pytest on server)
# SSH in first, then: cd server && pytest
```

### CI/CD
```bash
npm run ci:build      # miniprogram-ci build
npm run ci:preview    # miniprogram-ci preview
npm run ci:upload     # miniprogram-ci upload
```

---

## Important Limitations

### JavaScript Syntax (Must Follow)
WeChat Mini Program runtime does NOT support ES2020+. **Forbidden syntax:**

| Syntax | Alternative |
|--------|-------------|
| `?.` (optional chaining) | `obj && obj.prop` |
| `??` (nullish coalescing) | `val !== null ? val : default` |
| `??=` | `if (val === null) val = default` |
| `?.()` (optional call) | `fn && fn()` |

TypeScript compiles without error, but runtime throws `SyntaxError: Unexpected token .`

### TypeScript Target: ES5
- `tsconfig.json` has `strict: true`, `target: ES5`, `module: CommonJS`
- Custom type declarations in `typings/` directory
- WeChat API types from `miniprogram-api-typings`

---

## Skyline Renderer Rules (album_home only)

The `album_home` page uses Skyline renderer. Behavior differs from WebView pages.

### Forbidden WXML Patterns in Skyline
| Pattern | Problem | Fix |
|---------|---------|-----|
| `<block wx:for>` | `Element iterators can only be used in elements or text nodes` | Iterate on `<view wx:for>` directly |
| `scroll-view` + `enable-flex` | White screen | Remove `enable-flex` |
| `overflow-y: auto/scroll` on scroll-view | Skyline uses its own scrolling | Remove these CSS properties |
| `wx:else` containing `wx:for` | Compile-time iterator error on non-element node | Use `wx:elif="{{!cond1 && !cond2}}"` |

### Masonry Layout in Skyline
- `<block wx:for>` + `<view wx:if>` for column splitting does NOT work
- **Must** pre-split data into `leftItems`/`rightItems` arrays in JS
- Use two separate `<view wx:for>` in WXML
- Reference: `album_home.ts:groupByMilestone()`

### Component Registration Strategy
- **TDesign** components: register globally in `app.json` (with `miniprogram_npm/` prefix)
- **Custom business components** (`bottom-nav`, etc.): register in each page's `.json` file, NOT in `app.json`
  - Reason: global registration triggers `Cannot read property '__subscribe_webviewId' of undefined` in Skyline pages
- Pages using `bottom-nav`: `album_home`, `upload`, `settings`, `gallery`, `journey`

---

## Project Structure

### Miniprogram Frontend (`miniprogram/`)

```
miniprogram/
├── app.ts / app.json / app.wxss    # Entry, config (18 pages), global styles
├── tsconfig.json                   # ES5 target, strict off (for miniprogram runtime)
│
├── pages/                          # ═══════════════════ 18 pages
│   ├── album_home/                 #   Home - Skyline renderer
│   ├── upload/                     #   Upload media
│   ├── settings/                   #   Settings / profile
│   ├── baby_profile/               #   Baby profile editing
│   ├── baby_onboarding/            #   First-time baby setup
│   ├── baby_list/                  #   Baby list / switcher
│   ├── gallery/                    #   Photo gallery
│   ├── journey/                    #   Growth journey timeline
│   ├── media_detail/               #   Media detail view
│   ├── 3d_viewer/                  #   3D model viewer
│   ├── achievements/               #   Achievement badges
│   ├── growth_compare/             #   Growth comparison
│   ├── share_settings/             #   Family sharing settings
│   ├── about/                      #   About page
│   ├── index/                      #   Legacy entry
│   ├── onboarding/                 #   App onboarding
│   ├── logs/                       #   Debug logs
│   └── tech_validate/              #   Tech validation
│
├── components/                     # ═══════════════════ 7 components
│   ├── bottom-nav/                 #   4-tab navigation (home/album/upload/profile)
│   ├── age_filter/                 #   Age filter
│   ├── masonry_layout/             #   Masonry layout
│   ├── media_card/                 #   Media card
│   ├── media_uploader/             #   Media uploader
│   ├── navigation-bar/             #   Custom nav bar
│   └── edit-overlay/               #   Edit overlay
│
├── services/                       # ═══════════════════ 9 services
│   ├── api.ts                      #   API client wrapper
│   ├── request.ts                  #   HTTP request (token mgmt, auto-refresh, offline fallback)
│   ├── auth_api.ts                 #   Auth API calls
│   ├── baby_api.ts                 #   Baby profile API
│   ├── media_api.ts                #   Media API
│   ├── media_service.ts            #   Media service layer
│   ├── storage_service.ts          #   Local storage
│   ├── config_service.ts           #   Environment config
│   └── mock_cloud_service.ts       #   Mock cloud for testing
│
├── utils/                          # ═══════════ age_calculator, date_utils, image_utils, i18n, util
├── constants/                      # ═══════════ album_constants, storage_keys
├── config/                         # ═══════════ api.ts (environment config center)
├── styles/                         # ═══════════ variables.wxss (Claymorphism tokens), common.wxss
│
├── tests/                          # E2E tests
│   ├── e2e/                        #   global-setup/teardown, screenshot, reporter, ai-validator
│   ├── specs/                      #   Test specs (.spec.ts)
│   └── reports/                    #   Auto-generated reports
│
├── miniprogram_npm/                # Built TDesign components (generated, not committed)
└── node_modules/
```

### Backend Server (`server/`)

```
server/
├── app/
│   ├── main.py                     # FastAPI entry (v1.1.0, 8 routers, RateLimit/Exception/CORS middleware)
│   ├── config.py                   # Pydantic Settings (DB, Redis, JWT, WeChat, MinIO, upload limits)
│   ├── database.py                 # Async SQLAlchemy engine + session
│   ├── models/                     # 6 ORM models: User, Baby, Media, Share, SyncLog, Achievement
│   ├── routers/                    # 9 routers: auth, baby, media, upload, sync, share, analytics, export, storage
│   ├── services/                   # 9 services: auth, baby, media, file, thumbnail, export, share, sync, achievement
│   ├── schemas/                    # Pydantic schemas: auth, baby, media, common
│   ├── middleware/                 # auth (JWT), error_handler, permission, rate_limiter
│   └── tasks/                      # Celery: thumbnail generation (Redis broker)
├── tests/                          # 25+ pytest files (conftest, test_auth, test_baby, test_media, etc.)
├── migrations/                     # Alembic migrations (init + sync_logs fix)
├── nginx/                          # default.conf (production) + default.conf.arm (testing)
├── docker-compose.yml              # 5 services: postgres, redis, api, celery_worker, nginx
├── docker-compose.arm.yml          # ARM override
├── docker-compose-minio.yml        # Standalone MinIO
├── Dockerfile                      # Python 3.11-slim, uvicorn :8000
└── pyproject.toml                  # Poetry: Python 3.11+, FastAPI, SQLAlchemy 2.0, asyncpg, Celery
```

### Root
```
tests/          # 40+ unit test files (.test.ts) covering components, pages, services, utils
typings/        # TypeScript type definitions: Baby, BabyAge, Media models
scripts/        # Build, deploy, screenshot, CI utilities
docs/           # Requirements, design, architecture, testing, plans, deployment docs
```

---

## API Configuration & Environments

```typescript
// miniprogram/config/api.ts
development: 'http://localhost:8000/api/v1'        // Docker local
testing:     'http://192.168.50.126:8000/api/v1'   // ARM LAN
production:  'http://101.126.41.146:8000/api/v1'   // Cloud server
```

Switching between environments is handled by `config_service.ts` with compile-time + runtime switching. Tests use `mock_cloud_service.ts` to mock API responses.

### Backend API Routers

| Router | Endpoints | Purpose |
|--------|-----------|---------|
| `auth` | login, refresh, me | WeChat OAuth + JWT |
| `baby` | CRUD | Baby profiles |
| `media` | CRUD + query | Photos/videos |
| `upload` | POST | File upload to MinIO |
| `sync` | sync, pull | Offline data sync |
| `share` | invite, manage | Family sharing |
| `analytics` | stats, charts | Growth statistics |
| `export` | download | Data export |
| `storage` | manage | Storage management |

---

## UI / Design Rules

### Claymorphism Design Tokens
Defined in `miniprogram/styles/variables.wxss`:
```css
--clay-bg: #fffbf8             /* 米白背景 */
--clay-primary: #ffa87a        /* 橙色主色调 */
--clay-card-pink: #f1dce2      /* 粉色卡片 */
--clay-card-blue: #dceaf1      /* 蓝色卡片 */
--clay-card-beige: #f4e6d6     /* 米色卡片 */
--clay-card-mint: #e2f1e6      /* 绿色卡片 */
--clay-shadow-card: 0px 6px 16px 0px rgba(230, 198, 179, 0.35)
```

### UI Layout Iron Rule: No Buttons in Top-Right
System capsule (close/share) occupies the top-right. **Never** place business buttons there:
- ❌ Save button, settings, more actions (•••), share button
- ✅ Back button on left (←), action buttons at bottom center
- ✅ Menu/entries via bottom-nav tab or list items

### Bottom Navigation (`bottom-nav`)
- 4 tabs: Home 🏠 / Gallery 📖 / Upload ➕ / Profile 👤
- Active: `#ffa87a`, Inactive: `#999`
- Tab switching: `wx.redirectTo()` (no `tabBar` configured, no `wx.switchTab()`)
- Home entry: `wx.reLaunch()`

### Figma Design-to-Code Workflow
1. Use Figma MCP (`/figma-use`) to get design context
2. Export as React+Tailwind code
3. Convert to wxml/wxss using **exact hex color values** (not CSS variables)
4. Design width: 375px, conversion: `1px = 2rpx`

---

## Testing

### Test Organization
| Type | Pattern | Config | Timeout |
|------|---------|--------|---------|
| Unit | `tests/**/*.test.ts` + `miniprogram/tests/**/*.test.ts` | Jest `unit` project | Default |
| E2E | `miniprogram/tests/specs/**/*.spec.ts` | Jest `e2e` project | 120s |

### Jest Configuration (jest.config.js)
- Two-project mode: `unit` + `e2e`
- E2E: `--runInBand` (serial execution), custom global setup/teardown
- Coverage collects from `typings/**/*.ts` and `miniprogram/**/*.ts`

### E2E Testing (miniprogram-automator)
- Requires WeChat DevTools running with automation port enabled (9420)
- **Known issues**:
  - `miniprogram-automator` 0.12.1 has `reLaunch` serialization bug (use `App.callWxMethod` directly)
  - `App.captureScreenshot` hangs if DevTools window is not visible
  - Import `connect` directly (not destructured) to avoid `this.launcher` binding issues

### Mock Strategy
- `mock_cloud_service.ts` for API mocking in unit tests
- `storage_service.ts` tested with local storage mocks
- Backend tests: pytest with test database

---

## CI/CD Pipeline

### GitHub Actions (3 workflows)
1. **backend-ci.yml** — Push/PR to master with `server/**` changes: lint (ruff) → test (pytest, 30s)
2. **backend.yml** — Same as above but `continue-on-error` on tests
3. **miniprogram-ci.yml** — Push/PR to master/feat/* with `miniprogram/` changes: Node 20 → npm ci → unit tests → build → verify

### WebHook Auto-Deploy (server/scripts/webhook/)
- Python stdlib HTTP listener on port 9002
- HMAC-SHA256 signature verification (GitHub WebHook secret)
- Triggers `deploy.sh` on push events affecting `server/` directory
- systemd-managed (independent of API container to avoid self-amputation)
- Full setup guide: `server/scripts/webhook/SETUP.md`

---

## Common Tasks

### Adding a New Page
1. Create folder `miniprogram/pages/<page_name>/` with 4 files (`.ts`, `.wxml`, `.wxss`, `.json`)
2. Add to `pages` array in `miniprogram/app.json`
3. For Skyline: set `"renderer": "skyline"` in page `.json`
4. If using bottom-nav, register component in page `.json`: `"bottom-nav": "/components/bottom-nav/bottom-nav"`
5. Add `<bottom-nav current="tab-key"></bottom-nav>` in wxml

### Adding a Component
1. Create `miniprogram/components/<name>/` with 4 files
2. Set `"component": true` in `.json`
3. Register in consuming page's `.json` (NOT in `app.json` for business components)

### Adding Global Types
- Types go in `typings/` directory
- WeChat API types: `typings/types/wx/`
- Export from `typings/index.d.ts`

### Deploying Backend Changes
1. SSH to target server: `ssh linaro@192.168.50.126` (testing) or `ssh root@101.126.41.146` (production)
2. `git pull` inside the deployment directory
3. Restart services: `docker compose up -d --build`
4. Or use deploy scripts: `bash scripts/deploy-arm.sh` / `bash scripts/deploy-to-server.sh`

---

## Known Issues

| Issue | Workaround |
|-------|------------|
| App blank screen + timeout | DevTools: 工具 → 构建 npm, then 清除缓存 → 全部清除 |
| JSON files with BOM header | `sed -i '1s/^\xEF\xBB\xBF//' file.json` |
| AppID moved to `project.private.config.json` | Must stay in `project.config.json` |
| Screenshot hangs in headless | Keep DevTools window visible (minimized OK), 20s timeout guard |
| `Failed to load font at.alicdn.com` | Safe to ignore (iconfont CDN) |
| Babel transpilation for npm | Run `scripts/build-npm.js` after npm install |