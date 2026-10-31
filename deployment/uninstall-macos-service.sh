#!/bin/zsh
set -euo pipefail

service_id="com.huhu.time-adventure"
target_plist="$HOME/Library/LaunchAgents/${service_id}.plist"

launchctl bootout "gui/$(id -u)" "$target_plist" 2>/dev/null || true
rm -f "$target_plist"

echo "时间冒险家自动启动服务已移除。"
