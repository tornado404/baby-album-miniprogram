#!/usr/bin/env python3
"""云服务器部署工具 - 使用 Paramiko SSH (支持密码认证)"""

import paramiko
import os
import sys
from pathlib import Path
import time

SERVER = "101.126.41.146"
PORT = 22
USERNAME = "root"
PASSWORD = "Cs516@123456"
REMOTE_DIR = "/opt/baby-album"
LOCAL_SERVER = Path(__file__).parent.parent / "server"

class Deployer:
    def __init__(self):
        self.ssh = None
        self.sftp = None

    def connect(self):
        print(f"[SSH] 连接 {USERNAME}@{SERVER}:{PORT} ...")
        self.ssh = paramiko.SSHClient()
        self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.ssh.connect(SERVER, PORT, USERNAME, PASSWORD, timeout=15)
        print("[OK] 连接成功")
        self.sftp = self.ssh.open_sftp()

    def run(self, cmd, check=True, timeout=60):
        """Run command and print output"""
        print(f"  $ {cmd}")
        stdin, stdout, stderr = self.ssh.exec_command(cmd, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            for line in out.split("\n"):
                print(f"  {line}")
        if err and exit_code != 0:
            print(f"  ⚠ {err[:200]}")
        if check and exit_code != 0:
            print(f"  [FAIL] 失败 (exit={exit_code})")
        return exit_code, out, err

    def upload_dir(self, local_path, remote_path):
        """Upload directory recursively"""
        print(f"  [UPLOAD] {local_path} → {remote_path}")
        self.run(f"mkdir -p {remote_path}")
        for item in Path(local_path).rglob("*"):
            if '__pycache__' in str(item) or '.git' in str(item):
                continue
            rel = item.relative_to(local_path)
            target = f"{remote_path}/{rel}"
            if item.is_dir():
                self.run(f"mkdir -p {target}", check=False)
            else:
                self.sftp.put(str(item), target)

    def step(self, num, title, fn):
        print(f"\n{'='*50}")
        print(f"步骤 {num}: {title}")
        print(f"{'='*50}")
        fn()

    def close(self):
        if self.sftp: self.sftp.close()
        if self.ssh: self.ssh.close()
        print("\n[SSH] 连接关闭")

    def deploy(self):
        try:
            self.connect()

            # Step 1: Install Docker
            def s1():
                code, out, _ = self.run("docker --version 2>/dev/null || echo NO_DOCKER")
                if "NO_DOCKER" in out:
                    print("  → 安装 Docker...")
                    self.run("curl -fsSL https://get.docker.com | bash")
                    self.run("systemctl enable docker && systemctl start docker")
                else:
                    print(f"  → Docker 已安装: {out}")

            # Step 2: Create project directory
            def s2():
                self.run(f"mkdir -p {REMOTE_DIR}")

            # Step 3: Upload server files
            def s3():
                self.upload_dir(LOCAL_SERVER, REMOTE_DIR)

            # Step 4: Create .env file
            def s4():
                env_content = f"""APP_NAME=宝宝成长相册 API
DEBUG=false
DATABASE_URL=postgresql+asyncpg://app:Cs516@2026@postgres:5432/baby_album
REDIS_URL=redis://redis:6379/0
JWT_SECRET=baby-album-jwt-secret-{int(time.time())}
JWT_REFRESH_SECRET=baby-album-refresh-{int(time.time())}
WECHAT_APP_ID=wx3db22b5d6da5d38a
WECHAT_APP_SECRET=placeholder
COS_SECRET_ID=placeholder
COS_SECRET_KEY=placeholder
COS_BUCKET=baby-album
COS_REGION=ap-guangzhou
"""
                # Upload via SFTP
                with self.sftp.open(f"{REMOTE_DIR}/.env", "w") as f:
                    f.write(env_content)
                print("  → .env 已创建")

            # Step 5: Pull images and start
            def s5():
                print("  → 拉取 Docker 镜像...")
                self.run(f"cd {REMOTE_DIR} && docker compose pull postgres redis", timeout=120)
                print("  → 启动 PostgreSQL 和 Redis...")
                self.run(f"cd {REMOTE_DIR} && docker compose up -d postgres redis", timeout=60)
                print("  → 等待数据库就绪...")
                time.sleep(5)
                print("  → 启动 API 和 Nginx...")
                self.run(f"cd {REMOTE_DIR} && docker compose up -d api nginx --build", timeout=180)

            # Step 6: Verify
            def s6():
                time.sleep(3)
                self.run("docker ps --format 'table {{.Names}}\t{{.Status}}'")
                code, out, _ = self.run("curl -sf http://localhost:8000/health || echo FAILED")
                if "ok" in out.lower() or "status" in out.lower():
                    print(f"\n  [OK] API 响应: {out[:100]}")
                else:
                    print(f"\n  ⚠ 健康检查: {out[:100]}")

            self.step(1, "Docker 安装检查", s1)
            self.step(2, "创建项目目录", s2)
            self.step(3, "上传项目文件", s3)
            self.step(4, "配置环境变量", s4)
            self.step(5, "启动 Docker 容器", s5)
            self.step(6, "验证部署", s6)

            print(f"\n{'='*50}")
            print(f"[OK] 部署完成!")
            print(f"   API:      http://{SERVER}:8000")
            print(f"   Docs:     http://{SERVER}:8000/docs")
            print(f"   Health:   http://{SERVER}:8000/health")
            print(f"{'='*50}")

        except Exception as e:
            print(f"\n[FAIL] 部署失败: {e}")
            raise
        finally:
            self.close()

if __name__ == "__main__":
    Deployer().deploy()