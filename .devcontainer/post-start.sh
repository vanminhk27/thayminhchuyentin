#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
pid_file="/tmp/thayminh-judge.pid"
log_file="/tmp/thayminh-judge.log"

if [[ -f "$pid_file" ]]; then
  old_pid="$(tr -dc '0-9' < "$pid_file")"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    exit 0
  fi
fi

cd "$repo_dir/judge"
nohup env JUDGE_RUNNER="${JUDGE_RUNNER:-docker}" \
  JUDGE_CONCURRENCY="${JUDGE_CONCURRENCY:-2}" \
  node src/server.js > "$log_file" 2>&1 &
judge_pid=$!
echo "$judge_pid" > "$pid_file"

for _ in {1..20}; do
  if curl --fail --silent "http://localhost:3000/api/health" > /dev/null; then
    echo "Máy chấm đang chạy tại cổng 3000."
    exit 0
  fi
  sleep 1
done

echo "Máy chấm chưa sẵn sàng. Xem nhật ký tại $log_file"
exit 1
