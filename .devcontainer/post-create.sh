#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"

echo "Đang chuẩn bị trình biên dịch C++ cách ly..."
docker pull "${JUDGE_DOCKER_IMAGE:-gcc:14-bookworm}"

echo "Kiểm tra cú pháp máy chấm..."
node --check judge/src/server.js
node --check judge/src/judge.js
node --check judge/public/app.js

echo "Chạy thử một bài C++ trong Docker..."
JUDGE_RUNNER=docker node judge/test/docker-smoke.js

echo "Codespace đã sẵn sàng. Máy chấm sẽ tự khởi động ở cổng 3000."
