#!/bin/zsh
set -euo pipefail

service_id="com.huhu.time-adventure"
source_plist="$(cd "$(dirname "$0")" && pwd)/${service_id}.plist"
target_plist="$HOME/Library/LaunchAgents/${service_id}.plist"
domain="gui/$(id -u)"

launchctl bootout "$domain" "$target_plist" 2>/dev/null || true
install -m 644 "$source_plist" "$target_plist"
plutil -lint "$target_plist"
launchctl bootstrap "$domain" "$target_plist"
launchctl enable "$domain/$service_id"
launchctl kickstart -k "$domain/$service_id"

echo "时间冒险家服务已安装并启动。"
echo "访问地址：http://$(scutil --get LocalHostName).local:4173"
