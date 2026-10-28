#!/usr/bin/env bash
# Sets up redaksia.momenti.info on the VPS: nginx site + HTTPS. Only the newsroom routes are reachable:
#   /            -> the portal (/redaksia: login, Faturat + Kalkulatori tiles)
#   /faturat, /calculator, /redaksia, /_next (assets)
# Everything else redirects to /. Re-running is safe. Usage: bash setup-redaksia-remote.sh <backend-port>
set -uo pipefail
exec > >(tee /tmp/momenti-redaksia-setup.log) 2>&1
DOMAIN=redaksia.momenti.info
SERVER_IP=62.171.174.17
PORT=${1:-3100}
SITE=/etc/nginx/sites-available/momenti-redaksia
fail() { echo; echo "XXX DESHTOI: $*"; echo "Site-i live dhe testi NUK u prekën."; exit 1; }
case "$PORT" in 3100|3000) ;; *) fail "porti $PORT nuk lejohet";; esac

echo "== 1/3 nginx per $DOMAIN -> 127.0.0.1:$PORT"
PROXY="proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_read_timeout 300s;"
NEW=$(mktemp)
cat > "$NEW" <<NGINX
# managed-by-momenti-redaksia (ops/redaksia/setup-redaksia-remote.sh) backend-port=$PORT
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 25m;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    location = / {
        proxy_pass http://127.0.0.1:$PORT/redaksia\$is_args\$args;
        $PROXY
    }
    location ~ ^/(redaksia|faturat|calculator)(/|\$) {
        proxy_pass http://127.0.0.1:$PORT;
        $PROXY
    }
    location /_next/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        $PROXY
    }
    location = /favicon.ico {
        proxy_pass http://127.0.0.1:$PORT;
        $PROXY
    }
    location / {
        return 302 /;
    }
}
NGINX
# Keep the HTTPS part certbot added earlier: only replace the file when it was never certified,
# otherwise swap the port in place.
if [ -f "$SITE" ] && grep -q "managed by Certbot" "$SITE"; then
  sed -i -E "s#127\.0\.0\.1:[0-9]+#127.0.0.1:$PORT#g; s#backend-port=[0-9]+#backend-port=$PORT#" "$SITE"
  echo "   (HTTPS ekziston, u ndërrua vetëm porti)"
else
  cp "$NEW" "$SITE"
fi
rm -f "$NEW"
ln -sf "$SITE" /etc/nginx/sites-enabled/momenti-redaksia
nginx -t >/dev/null 2>&1 || { nginx -t; rm -f /etc/nginx/sites-enabled/momenti-redaksia; fail "konfigurimi nginx kishte gabim (u hoq)"; }
systemctl reload nginx
echo "   nginx: OK"

echo "== 2/3 HTTPS (Let's Encrypt)"
RESOLVED=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
if [ "$RESOLVED" != "$SERVER_IP" ]; then
  echo "   DNS per $DOMAIN ende nuk tregon $SERVER_IP (tani: ${RESOLVED:-asgje}). Shto A record ne GoDaddy dhe rinise setup-in."
else
  command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || echo "   certbot nuk u instalua"
  if command -v certbot >/dev/null; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --keep-until-expiring --register-unsafely-without-email \
      && echo "   HTTPS: OK" || echo "   certbot deshtoi (shiko log-un me lart)"
  fi
fi

echo "== 3/3 Kontroll"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" "http://127.0.0.1:$PORT/redaksia" || true)
echo "   portali (direkt nga app-i): $code"
echo
echo "=== GATI: https://$DOMAIN -> port $PORT"
