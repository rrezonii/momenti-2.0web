#!/usr/bin/env bash
# Restart the live site (pm2 "momenti") when it stops answering. Keeps the current build. Logs first, for the cause.
echo "== pm2 log-u i fundit (para rinisjes)"
tail -n 60 /root/.pm2/logs/momenti-error.log 2>/dev/null | cut -c1-220 | tail -n 40
echo; echo "== Out log"
tail -n 20 /root/.pm2/logs/momenti-out.log 2>/dev/null | cut -c1-220
echo; echo "== Kerkesa ne nginx (5 min e fundit, sipas IP)"
awk -v d="$(date -d '-5 min' '+%d/%b/%Y:%H:%M')" '$4 > "["d' /var/log/nginx/access.log 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head -8
echo; echo "== Rinis momenti"
pm2 restart momenti >/dev/null && echo "   u rinis"
for i in $(seq 1 30); do
  sleep 2
  code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' -H "Accept-Language: sq" http://127.0.0.1:3000/sq || true)
  case "$code" in 200) break;; esac
done
echo "   /sq pas rinisjes: $code"
curl -s -m 15 -o /dev/null -w "   https://momenti.info/sq: %{http_code} ne %{time_total}s\n" https://momenti.info/sq
