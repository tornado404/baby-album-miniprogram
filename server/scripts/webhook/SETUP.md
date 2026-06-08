# WebHook 自动部署 — 服务端设置指南

## 架构概览

```
GitHub Push (server/**)
    │
    ▼
GitHub WebHook ──POST──► 云服务器 :9002
                            │
                    ┌───────┴───────┐
                    │ listener.py   │ 验证 HMAC 签名
                    │ (独立服务)     │ 后台触发部署脚本
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │ deploy.sh     │ git pull → docker compose up -d
                    │ (bash 脚本)    │ 健康检查 → 自动回滚
                    └───────────────┘
```

**关键设计：**
- WebHook 监听器是**独立服务**（非 FastAPI 容器内），避免"部署时自残"问题
- 代码通过 **volume 挂载** 到容器 (`./app:/app/app`)，更新代码只需 `docker compose up -d`，无需重新构建镜像
- 内置自动回滚：健康检查连续失败 → `git reset --hard` 回退代码 → 重启容器

---

## 前置条件

服务器上需要：

1. **Git**（用于拉取代码）
2. **Docker** + Docker Compose v2（作为 `docker compose` 命令）
3. **Python 3**（用于运行 WebHook 监听器）
4. **curl**（用于健康检查）

## 第一步：在服务器上克隆仓库

```bash
# 创建用户（如果不存在）
sudo useradd -m -s /bin/bash deploy

# 克隆仓库
sudo mkdir -p /opt/baby-album
sudo chown deploy:deploy /opt/baby-album

# 以 deploy 用户操作
sudo -iu deploy

git clone https://github.com/tornado404/baby-album-miniprogram.git /opt/baby-album
cd /opt/baby-album
git checkout master
```

## 第二步：配置 Git 自动拉取权限

推荐方式：**Deploy Key**（只读，更安全）

```bash
# 生成 deploy key
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""

# 查看公钥
cat ~/.ssh/github_deploy.pub
```

然后将公钥添加到 GitHub 仓库：**Settings → Deploy Keys → Add deploy key**（勾选 Allow write access ❌）

配置 SSH：

```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    StrictHostKeyChecking accept-new
EOF
chmod 600 ~/.ssh/config

# 验证连接
ssh -T git@github.com
# 输出: Hi tornado404/baby-album-miniprogram! You've successfully authenticated
```

## 第三步：配置环境变量

```bash
cp /opt/baby-album/server/.env.example /opt/baby-album/.env
chmod 600 /opt/baby-album/.env

# 编辑 .env 填入生产环境变量
vim /opt/baby-album/.env
```

**必须填写的变量：**

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串（注意密码） |
| `JWT_SECRET` | 256 位随机密钥 |
| `JWT_REFRESH_SECRET` | 刷新令牌密钥 |
| `WECHAT_APP_SECRET` | 微信小程序 Secret |
| `GITHUB_WEBHOOK_SECRET` | WebHook 签名密钥（与 GitHub 配置一致） |

## 第四步：配置并启动 WebHook 服务

### 4.1 安装为 systemd 服务

```bash
sudo cp /opt/baby-album/server/scripts/webhook/baby-webhook.service /etc/systemd/system/
sudo mkdir -p /var/log
sudo touch /var/log/baby-webhook.log
sudo chown deploy:deploy /var/log/baby-webhook.log

# 从 .env 中读取 GITHUB_WEBHOOK_SECRET
sudo systemctl daemon-reload
sudo systemctl enable baby-webhook
sudo systemctl start baby-webhook

# 查看状态
sudo systemctl status baby-webhook

# 查看日志
journalctl -u baby-webhook -f
```

### 4.2 验证监听器运行

```bash
# 健康检查
curl http://localhost:9002/health

# 期望响应:
# {"status": "ok", "service": "baby-webhook", "pid": 12345}
```

## 第五步：配置 Nginx 反向代理（推荐）

如果已有 Nginx 运行，建议将 WebHook 端口代理到子路径：

在 `server/nginx/default.conf` 中添加：

```nginx
# WebHook 监听器（内部端口 9002）
location /webhook/ {
    proxy_pass http://127.0.0.1:9002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

然后通过 `http://101.126.41.146/webhook/github` 接收 WebHook。

## 第六步：配置 GitHub WebHook

在 GitHub 仓库的 **Settings → Webhooks → Add webhook**：

| 字段 | 值 |
|------|-----|
| **Payload URL** | `http://101.126.41.146:9002/webhook/github` （或 Nginx 代理路径） |
| **Content type** | `application/json` |
| **Secret** | 与 `.env` 中的 `GITHUB_WEBHOOK_SECRET` 一致 |
| **SSL verification** | 如果没用 HTTPS，选择 **Disable**（或配置 HTTPS） |
| **Which events?** | **Just the push event** |
| **Active** | ✅ |

点击 **Add webhook** 后，GitHub 会发送一次 `ping` 事件。如果配置正确，监听器日志会显示：

```
[INFO] Baby WebHook Listener 启动 → 0.0.0.0:9002
[INFO] 等待 WebHook 事件...
```

## 第七步：启动 Docker 服务

```bash
cd /opt/baby-album

# 构建基础镜像（仅首次，或依赖变更时）
docker compose build api

# 启动所有服务
docker compose up -d

# 验证
curl http://localhost:8000/health
```

## 日常运维

### 查看部署日志

```bash
# WebHook 监听器日志
journalctl -u baby-webhook -f

# 部署脚本输出
cat /var/log/baby-webhook.log | grep "\[deploy\]"

# API 容器日志
docker logs baby-api --tail 100 -f
```

### 手动触发部署

```bash
# 模拟 WebHook 触发（不依赖 GitHub）
curl -X POST http://localhost:9002/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/master","commits":[{"added":["server/app/main.py"],"modified":[],"removed":[]}]}'
```

### 手动回滚

```bash
cd /opt/baby-album
git log --oneline -10          # 查看历史
git reset --hard <target-sha>   # 回滚到目标版本
docker compose up -d api        # 重启容器
```

## 安全注意事项

1. **防火墙**：确保端口 9002 只对 GitHub IP 范围开放，或通过 Nginx 限制来源 IP
   ```bash
   # GitHub WebHook IP 范围
   sudo ufw allow from 192.30.252.0/22 to any port 9002
   sudo ufw allow from 185.199.108.0/22 to any port 9002
   sudo ufw allow from 140.82.112.0/20 to any port 9002
   ```

2. **Secret 保护**：`GITHUB_WEBHOOK_SECRET` 使用高强度随机字符串（`openssl rand -hex 32`）

3. **最小权限原则**：
   - Deploy Key 只需**只读**权限
   - `deploy` 用户无需 `sudo` 权限（已加入 `docker` 组即可）
   - `.env` 文件权限 `600`

4. **HTTPS 推荐**：使用 Let's Encrypt 为 WebHook endpoint 配置 HTTPS，避免 Secret 明文传输