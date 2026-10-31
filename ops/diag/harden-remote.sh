#!/usr/bin/env bash
# Protection for the VPS (idempotent, safe to re-run):
#  1) nginx: block the scanner IP and limit each visitor's page requests (static files and the server itself are not limited)
#  2) watchdog: every 2 min, if the live site stops answering twice in a row, restart it (logged)
set -uo pipefail
CONF=/etc/nginx/conf.d/momenti-protect.conf
echo "== 1/2 nginx"
cp -a "$CONF" "/tmp/momenti-protect.conf.bak" 2>/dev/null || true
cat > "$CONF" <<'NGINX'
# managed by ops/diag/harden-remote.sh
# Scanner posing as Googlebot (looked for .env, docker-compose, settings.py ...), 31.10.2026
deny 79.124.58.82;

# Per-visitor limit for pages and API calls. Static files, the server itself (Next.js -> WordPress)
# and localhost are not limited. A normal visitor never reaches it; it stops floods/scrapers.
geo $momenti_trusted {
    default 0;
    127.0.0.1 1;
    ::1 1;
    62.171.174.17 1;
}
map "$momenti_trusted:$uri" $momenti_rl_key {
    ~^1: "";
    ~*\.(css|js|mjs|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm|txt|xml)$ "";
    ~^0:/_next/static/ "";
    ~^0:/_next/image "";
    default $binary_remote_addr;
}
limit_req_zone $momenti_rl_key zone=momenti_perip:20m rate=5r/s;
limit_req zone=momenti_perip burst=80 nodelay;
limit_req_status 429;
limit_req_log_level warn;
NGINX
if nginx -t >/tmp/nginx-test.txt 2>&1; then
  systemctl reload nginx && echo "   nginx: OK (IP e bllokuar + kufiri 5 kerkesa/s, burst 80)"
else
  cat /tmp/nginx-test.txt
  if [ -f /tmp/momenti-protect.conf.bak ]; then cp -a /tmp/momenti-protect.conf.bak "$CONF"; else rm -f "$CONF"; fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx
  echo "   XXX nginx nuk e pranoi konfigurimin - u kthye si ishte"
fi

echo "== 2/2 watchdog"
cat > /usr/local/bin/momenti-watchdog.sh <<'WD'
#!/usr/bin/env bash
# Restarts the live site (pm2 "momenti") if it fails to answer twice in a row. Runs from cron every 2 min.
LOG=/var/log/momenti-watchdog.log
STATE=/run/momenti-watchdog.fail
code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' -H "Accept-Language: sq" http://127.0.0.1:3000/sq || true)
case "$code" in
  200|30[1278]) rm -f "$STATE"; exit 0;;
esac
if [ -f "$STATE" ]; then
  echo "$(date '+%F %T') live nuk u pergjigj 2 here (kodi $code) -> pm2 restart momenti" >> $LOG
  PM2_HOME=/root/.pm2 pm2 restart momenti >/dev/null 2>&1
  rm -f "$STATE"
else
  echo "$(date '+%F %T') live nuk u pergjigj (kodi $code), kontrolloj perseri pas 2 min" >> $LOG
  touch "$STATE"
fi
# The test dev server (port 3100) slowly grows; restart it above 2 GB so it never starves the live site.
rss=$(ps -eo rss,args | awk '/next-server/ && /momenti-test|3100/ {print $1}' | sort -rn | head -1)
pid=$(ss -ltnp 2>/dev/null | awk '/127.0.0.1:3100/' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
if [ -n "$pid" ]; then
  trss=$(ps -o rss= -p "$pid" | tr -d ' ')
  if [ -n "$trss" ] && [ "$trss" -gt 2000000 ]; then
    echo "$(date '+%F %T') testi perdor $((trss/1024)) MB -> pm2 restart momenti-test" >> $LOG
    PM2_HOME=/root/.pm2 pm2 restart momenti-test >/dev/null 2>&1
  fi
fi
WD
chmod 755 /usr/local/bin/momenti-watchdog.sh
PM2_BIN=$(command -v pm2)
cat > /etc/cron.d/momenti-watchdog <<CRON
# managed by ops/diag/harden-remote.sh
PATH=$(dirname "$PM2_BIN"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/2 * * * * root /usr/local/bin/momenti-watchdog.sh
CRON
chmod 644 /etc/cron.d/momenti-watchdog
/usr/local/bin/momenti-watchdog.sh && echo "   watchdog: instaluar (cdo 2 min); prova: OK"
echo
echo "== Kontroll"
for u in https://momenti.info/sq https://redaksia.momenti.info/ https://cms.momenti.info/wp-json/; do
  curl -s -m 20 -o /dev/null -w "   $u -> %{http_code} ne %{time_total}s\n" "$u"
done
echo "   20 kerkesa te shpejta nga serveri (s'duhet te bllokohen):"; for i in $(seq 1 20); do curl -s -m 10 -o /dev/null -w '%{http_code} ' https://momenti.info/sq; done; echo
