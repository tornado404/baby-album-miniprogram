#!/usr/bin/env python3
"""
宝宝成长相册 — GitHub WebHook 监听器
=====================================
轻量级独立 HTTP 服务，接收 GitHub push 事件的 WebHook，
验证 HMAC 签名后触发部署脚本。

设计原则：
- 仅使用 Python 标准库，零外部依赖
- 与 API 服务解耦，独立运行在宿主机（非 Docker 内）
- 异步执行部署脚本，不阻塞 WebHook 响应

运行方式：
    python listener.py [--port 9002] [--secret <webhook-secret>] [--log deploy.log]

推荐通过 systemd 管理（见 baby-webhook.service）。
"""
import argparse
import hmac
import json
import logging
import os
import subprocess
import sys
import threading
from hashlib import sha256
from http.server import HTTPServer, BaseHTTPRequestHandler

# ── 配置 ──────────────────────────────────────────────────────────────
WEBHOOK_PORT = 9002
DEPLOY_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deploy.sh")
LOG_PATH = "/var/log/baby-webhook.log"

# 从环境变量或命令行读取 WebHook Secret
WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")

# ── 日志 ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH) if os.access(os.path.dirname(LOG_PATH), os.W_OK) else logging.StreamHandler(),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("baby-webhook")


class WebhookHandler(BaseHTTPRequestHandler):
    """处理 GitHub WebHook POST 请求"""

    # ── 路由 ──────────────────────────────────────────────────────
    def do_POST(self):
        if self.path == "/webhook/github":
            self._handle_github_webhook()
        elif self.path == "/health":
            self._handle_health()
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"not found"}')

    def do_GET(self):
        if self.path == "/health":
            self._handle_health()
        else:
            self.send_response(404)
            self.end_headers()

    # ── GitHub WebHook ────────────────────────────────────────────
    def _handle_github_webhook(self):
        # 1. 读取请求体
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # 2. 验证 HMAC-SHA256 签名
        if WEBHOOK_SECRET:
            received_sig = self.headers.get("X-Hub-Signature-256", "")
            if not self._verify_signature(body, received_sig):
                logger.warning("签名验证失败 — 拒绝请求")
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b'{"error":"invalid signature"}')
                return

        # 3. 只处理 push 事件
        event = self.headers.get("X-GitHub-Event", "")
        if event != "push":
            logger.info(f"忽略非 push 事件: {event}")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ignored","reason":"non-push event"}')
            return

        # 4. 解析 payload
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error":"invalid JSON"}')
            return

        # 5. 检查是否涉及 server/ 目录
        ref = payload.get("ref", "")
        commits = payload.get("commits", [])
        has_backend_changes = any(
            "server/" in c.get("added", []) + c.get("modified", []) + c.get("removed", [])
            for c in commits
        ) if commits else True  # 无 commits 信息时默认触发

        if not has_backend_changes and "server/" not in ref:
            logger.info("本次 push 不涉及 server/ 目录，跳过部署")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"skipped","reason":"no server/ changes"}')
            return

        # 6. 在后台线程执行部署
        branch = ref.replace("refs/heads/", "")
        pusher = payload.get("pusher", {}).get("name", "unknown")
        head_commit = payload.get("head_commit", {})
        msg = (head_commit.get("message", "") or "").split("\n")[0] if head_commit else ""
        logger.info(f"收到推送: [{branch}] {pusher} — {msg}")

        thread = threading.Thread(
            target=self._run_deploy,
            args=(branch,),
            daemon=True,
        )
        thread.start()

        # 7. 立即返回 202
        self.send_response(202)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "accepted", "message": "deploy started"}).encode())

    # ── 健康检查 ──────────────────────────────────────────────────
    def _handle_health(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "status": "ok",
            "service": "baby-webhook",
            "pid": os.getpid(),
        }).encode())

    # ── HMAC 验证 ─────────────────────────────────────────────────
    def _verify_signature(self, body: bytes, signature: str) -> bool:
        """验证 GitHub 的 HMAC-SHA256 签名"""
        if not signature.startswith("sha256="):
            return False
        expected = signature[7:]  # 去掉 "sha256="
        actual = hmac.new(WEBHOOK_SECRET.encode(), body, sha256).hexdigest()
        return hmac.compare_digest(actual, expected)

    # ── 执行部署 ──────────────────────────────────────────────────
    def _run_deploy(self, branch: str):
        """在后台线程执行部署脚本"""
        if not os.path.isfile(DEPLOY_SCRIPT):
            logger.error(f"部署脚本不存在: {DEPLOY_SCRIPT}")
            return

        env = os.environ.copy()
        env["DEPLOY_BRANCH"] = branch

        try:
            result = subprocess.run(
                ["bash", DEPLOY_SCRIPT],
                env=env,
                capture_output=True,
                text=True,
                timeout=300,  # 5 分钟超时
            )
            for line in result.stdout.splitlines():
                logger.info(f"[deploy] {line}")
            if result.stderr:
                for line in result.stderr.splitlines():
                    logger.warning(f"[deploy:stderr] {line}")
            if result.returncode == 0:
                logger.info("部署成功完成")
            else:
                logger.error(f"部署失败 (exit={result.returncode})")
        except subprocess.TimeoutExpired:
            logger.error("部署超时（>5分钟）")
        except Exception as e:
            logger.exception(f"部署脚本执行异常: {e}")

    # ── 抑制默认日志 ──────────────────────────────────────────────
    def log_message(self, format, *args):
        """抑制 BaseHTTPServer 的访问日志（用自定义日志替代）"""
        if "404" in str(args):
            logger.warning(f"{self.client_address[0]} — {args[0]} {args[1]} {args[2]}")
        # 正常请求不记录访问日志，避免冗余


def main():
    parser = argparse.ArgumentParser(description="Baby Album WebHook Listener")
    parser.add_argument("--port", type=int, default=WEBHOOK_PORT, help=f"监听端口（默认 {WEBHOOK_PORT}）")
    parser.add_argument("--secret", default="", help="GitHub WebHook Secret（覆盖 GITHUB_WEBHOOK_SECRET 环境变量）")
    parser.add_argument("--log", default=LOG_PATH, help=f"日志文件路径（默认 {LOG_PATH}）")
    args = parser.parse_args()

    port = args.port
    secret = args.secret or WEBHOOK_SECRET
    log_path = args.log

    # 更新日志配置
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_path) if os.access(os.path.dirname(log_path) or ".", os.W_OK) else logging.StreamHandler(),
            logging.StreamHandler(sys.stdout),
        ],
    )

    # 全局注入 secret
    global WEBHOOK_SECRET
    WEBHOOK_SECRET = secret

    server = HTTPServer(("0.0.0.0", port), WebhookHandler)
    logger.info(f"Baby WebHook Listener 启动 → 0.0.0.0:{port}")
    logger.info(f"部署脚本: {DEPLOY_SCRIPT}")
    if WEBHOOK_SECRET:
        logger.info("HMAC 签名验证: 已启用")
    else:
        logger.warning("HMAC 签名验证: 未启用（建议设置 --secret）")
    logger.info("等待 WebHook 事件...")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("收到中断信号，正在关闭...")
        server.shutdown()
        logger.info("服务已停止")


if __name__ == "__main__":
    main()