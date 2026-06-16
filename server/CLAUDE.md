# Server CLAUDE.md

## 强制规则

### 修改代码后必须同步 ARM 测试服务器

每次修改 `server/` 下的代码后，**必须**执行以下步骤更新 ARM 测试服务器并重启 API 容器，否则改动不会生效：

```bash
# 1. 推送代码到远程 master
git push origin master

# 2. 在 ARM 服务器上拉取最新代码（当前分支非 master，需用 origin/master 检出）
ssh linaro@192.168.50.126 "cd /home/linaro/baby-album && git fetch origin master:refs/remotes/origin/master && git checkout origin/master -- server/"

# 3. 重启 API 容器（代码通过卷挂载，重启即生效）
ssh linaro@192.168.50.126 "docker restart baby-api"
```

**Why**: ARM 服务器上的 API 容器通过卷挂载 `./app:/app/app` 运行，代码变更需要 `git pull` + `docker restart` 才能生效。如果只修改本地代码而不同步，ARM 服务器运行的仍是旧代码，导致问题无法验证甚至引入新问题。

**注意**:
- 如果修改了 `.env`，需要重建容器：`docker rm -f baby-api && docker run -d --name baby-api --env-file .env -p 8000:8000 --network server_baby-network -v /home/linaro/baby-album/server/app:/app/app --restart unless-stopped baby-api-base:latest`
- 如果修改了 `Dockerfile` 或 `pyproject.toml`（依赖变更），需要重新构建镜像
- 重启后等待约 6 秒确认启动成功：`docker logs baby-api --tail=5`
