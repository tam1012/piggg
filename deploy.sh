#!/usr/bin/env bash
# Deploy bản mới lên VPS GreenCloud HK (heomi.tam1012.site) — chi tiết xem AGENTS.md
set -euo pipefail
cd "$(dirname "$0")"

tar czf - index.html main.js vendor | ssh -i "/c/Users/Ha Tam/.ssh/gc_hk_key" \
  -o BatchMode=yes ubuntu@192.131.142.97 "tar xzf - -C /var/www/heomi"

echo "Đã deploy lên VPS, kiểm tra:"
curl -s -o /dev/null -w "  heomi.tam1012.site → HTTP %{http_code}\n" --max-time 15 "https://heomi.tam1012.site/"
curl -s -o /dev/null -w "  main.js            → HTTP %{http_code}\n" --max-time 15 "https://heomi.tam1012.site/main.js"
