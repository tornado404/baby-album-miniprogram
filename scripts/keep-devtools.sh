#!/bin/bash
# 启动 DevTools 并保持运行，端口 9420 (WebSocket) 持续监听
# 用法：nohup bash scripts/keep-devtools.sh > /tmp/devtools.log 2>&1 &

set -e

# 杀掉旧的 wechatdevtools.exe
cmd.exe /c "taskkill /F /IM wechatdevtools.exe" 2>/dev/null || true
sleep 1

# 启动 IDE（后台，不 wait）
cmd.exe /c "E:\ProgramData\Tencent\微信web开发者工具\cli.bat auto --port 9421 --auto-port 9420 --project D:\code\yuanBabyGrowthDiary\miniprogram" > /tmp/devtools-startup.log 2>&1 &

# 不调用 wait，让 WSL 把此进程移到自己的进程组
disown -a 2>/dev/null || true

# 守护：每 30s 检查一次 9420 是否还在，不在就重启
while true; do
  sleep 30
  LISTENING=$(cmd.exe /c "netstat -ano" 2>&1 | grep -E "0.0.0.0:9420.*LISTENING" | head -1)
  if [ -z "$LISTENING" ]; then
    echo "[$(date +%T)] 9420 not listening, restarting IDE..."
    cmd.exe /c "E:\ProgramData\Tencent\微信web开发者工具\cli.bat auto --port 9421 --auto-port 9420 --project D:\code\yuanBabyGrowthDiary\miniprogram" > /tmp/devtools-startup.log 2>&1 &
    disown -a 2>/dev/null || true
  fi
done
