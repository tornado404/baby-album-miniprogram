#!/usr/bin/env python3
"""云服务器部署工具"""

import paramiko
import os
import sys
from pathlib import Path
import time
import re

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

    def log(self, msg):
        print(f"  {msg}")
        sys.stdout.flush()

    def connect(self):
        self.log(f"Connecting {USERNAME}@{SERVER}:{PORT} ...")
        self.ssh = paramiko.SSHClient()
        self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.ssh.connect(SERVER, PORT, USERNAME, PASSWORD, timeout=15)
        self.log("OK")
        self.sftp = self.ssh.open_sftp()

    def run(self, cmd, check=True, timeout=60):
        """Run command, return (exit_code, stdout, stderr)"""
        self.log(f"$ {cmd}")
        stdin, stdout, stderr = self.ssh.exec_command(cmd, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            for line in out.split("\n"):
                self.log(f"  | {line}")
        if err and exit_code != 0:
            self.log(f"  ! {err[:300]}")
        if check and exit_code != 0:
            self.log(f"  FAIL (exit={exit_code})")
        return exit_code, out, err

    def upload_file(self, local, remote):
        """Upload single file, create parent dirs"""
        remote = remote.replace("\\", "/")
        parent = "/".join(remote.split("/")[:-1])
        self.run(f"mkdir -p {parent}", check=False)
        self.sftp.put(str(local), remote)

    def upload_dir(self, local_path, remote_path):
        """Upload directory recursively"""
        remote_path = remote_path.replace("\\", "/")
        self.log(f"Upload {local_path} -> {remote_path}")
        self.run(f"mkdir -p {remote_path}")

        exclude_dirs = {"__pycache__", ".git", ".venv", "node_modules"}
        for item in sorted(Path(local_path).rglob("*")):
            # Skip excluded and hidden dirs
            parts = item.relative_to(local_path).parts
            if any(p in exclude_dirs or p.startswith(".") for p in parts):
                continue
            rel = "/".join(parts)
            target = f"{remote_path}/{rel}"
            if item.is_dir():
                self.run(f"mkdir -p {target}", check=False)
            elif item.is_file():
                self.sftp.put(str(item), target)

    def step(self, num, title, fn):
        print(f"\n=== Step {num}: {title} ===")
        fn()

    def close(self):
        if self.sftp:
            self.sftp.close()
        if self.ssh:
            self.ssh.close()
        print("\nDisconnected")

    def deploy(self):
        try:
            self.connect()

            def s1():
                code, out, _ = self.run("docker --version 2>/dev/null || echo NO_DOCKER")
                if "NO_DOCKER" in out:
                    self.log("Installing Docker...")
                    self.run("curl -fsSL https://get.docker.com | bash", timeout=120)
                    self.run("systemctl enable docker && systemctl start docker")
                else:
                    self.log(f"Docker ready: {out}")

            def s2():
                self.run(f"mkdir -p {REMOTE_DIR}")

            def s3():
                self.upload_dir(LOCAL_SERVER, REMOTE_DIR)

            def s4():
                ts = int(time.time())
                env = (
                    "APP_NAME=baby-album-api\n"
                    "DEBUG=false\n"
                    "DATABASE_URL=postgresql+asyncpg://app:Cs516@2026@postgres:5432/baby_album\n"
                    "REDIS_URL=redis://redis:6379/0\n"
                    f"JWT_SECRET=baby-album-jwt-{ts}\n"
                    f"JWT_REFRESH_SECRET=baby-album-refresh-{ts}\n"
                    "WECHAT_APP_ID=wx3db22b5d6da5d38a\n"
                    "WECHAT_APP_SECRET=placeholder\n"
                    "COS_SECRET_ID=placeholder\n"
                    "COS_SECRET_KEY=placeholder\n"
                    "COS_BUCKET=baby-album\n"
                    "COS_REGION=ap-guangzhou\n"
                )
                with self.sftp.open(f"{REMOTE_DIR}/.env", "w") as f:
                    f.write(env)
                self.log(".env created")

            def s5():
                self.log("Pulling images...")
                # Remove obsolete version field
                self.run(f"cd {REMOTE_DIR} && sed -i '/^version:/d' docker-compose.yml", check=False)
                self.run(f"cd {REMOTE_DIR} && docker compose pull", timeout=180)
                self.log("Starting services...")
                self.run(f"cd {REMOTE_DIR} && docker compose up -d postgres redis", timeout=60)
                self.log("Waiting for DB...")
                time.sleep(5)
                self.run(f"cd {REMOTE_DIR} && docker compose up -d api nginx --build", timeout=180)

            def s6():
                time.sleep(3)
                self.run("docker ps --format 'table {{.Names}}\t{{.Status}}'")
                code, out, _ = self.run("curl -sf http://localhost:8000/health || echo FAILED")
                if "FAILED" not in out:
                    self.log(f"API OK: {out[:100]}")
                else:
                    self.log(f"Health check: {out[:100]}")

            self.step(1, "Docker check", s1)
            self.step(2, "Create dir", s2)
            self.step(3, "Upload files", s3)
            self.step(4, "Env config", s4)
            self.step(5, "Docker start", s5)
            self.step(6, "Verify", s6)

            print("\n" + "=" * 50)
            print("DEPLOY COMPLETE!")
            print(f"  API:   http://{SERVER}:8000")
            print(f"  Docs:  http://{SERVER}:8000/docs")
            print("=" * 50)

        except Exception as e:
            print(f"\nERROR: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.close()


if __name__ == "__main__":
    Deployer().deploy()