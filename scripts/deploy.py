#!/usr/bin/env python3
"""SSH deployment helper - deploys to cloud server"""

import subprocess
import os
import sys
import shutil

SERVER = "root@101.126.41.146"
PASSWORD = "Cs516@123456"
REMOTE_DIR = "/opt/baby-album"
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def run_remote(cmd, timeout=30):
    """Run command on remote server via SSH"""
    full_cmd = f"ssh -o StrictHostKeyChecking=no {SERVER} '{cmd}'"
    print(f"  → {cmd[:60]}...")

    proc = subprocess.run(
        ["ssh", "-o", "StrictHostKeyChecking=no", SERVER, cmd],
        input=PASSWORD + "\n",
        capture_output=True,
        text=True,
        timeout=timeout
    )
    if proc.returncode != 0 and "Permission denied" in proc.stderr:
        print(f"  ⚠ SSH failed: {proc.stderr[:100]}")
        return False
    if proc.stdout:
        print(f"  {proc.stdout[:200]}")
    return True

print("=" * 50)
print("🚀 部署到云服务器")
print("=" * 50)

# Step 1: Install Docker if needed
print("\n📦 Step 1: 检查 Docker...")
result = run_remote("docker --version 2>/dev/null && echo DOCKER_OK || echo NO_DOCKER")
if not result:
    print("❌ SSH 连接失败，请检查服务器")
    sys.exit(1)

print("\n✅ 部署脚本就绪，请手动执行以下命令：")
print(f"\n  ssh {SERVER}")
print(f"  密码: {PASSWORD}")
print(f"\n  然后运行:")
print(f"    docker --version")
print(f"    mkdir -p {REMOTE_DIR}")
print(f"\n  再将项目文件复制到服务器:")
print(f"    scp -r server/app {SERVER}:{REMOTE_DIR}/")
print(f"    scp server/docker-compose.yml {SERVER}:{REMOTE_DIR}/")
print(f"    scp server/Dockerfile {SERVER}:{REMOTE_DIR}/")