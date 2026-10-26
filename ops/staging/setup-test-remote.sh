#!/usr/bin/env bash
# One-time (re-runnable) setup of test.momenti.info on the VPS. Run by GitHub Actions ("Test site: setup").
# The live site (/var/www/momenti, pm2 "momenti") is never touched.
# test.momenti.info = a separate copy in /var/www/momenti-test, running `next dev` on 127.0.0.1:3100,
# behind nginx with HTTPS + a password, not indexed, no analytics/ads, views not counted.
set -uo pipefail
exec > >(tee /tmp/momenti-test-setup.log) 2>&1
LIVE=/var/www/momenti
TEST=/var/www/momenti-test
PORT=3100
NAME=momenti-test
DOMAIN=test.momenti.info
SERVER_IP=62.171.174.17
UPLOAD=/tmp/momenti-test-src.tar.gz
HTPASSWD=/etc/nginx/.htpasswd-momenti-test
SITE=/etc/nginx/sites-available/momenti-test
fail() { echo; echo "XXX DESHTOI: $*"; echo "Faqja live NUK u prek."; exit 1; }

read -r TEST_SITE_PASSWORD || true
[ "${#TEST_SITE_PASSWORD}" -ge 8 ] || fail "TEST_SITE_PASSWORD mungon ose eshte me i shkurter se 8 shenja"
[ -f "$UPLOAD" ] || fail "arkiva e kodit nuk u ngarkua"
[ -f "$LIVE/.env.local" ] || fail "nuk u gjet $LIVE/.env.local"

echo "== 1/6 Kodi -> $TEST"
mkdir -p "$TEST"
STAGE=$(mktemp -d)
tar -xzf "$UPLOAD" -C "$STAGE" --no-same-owner || fail "arkiva eshte e demtuar"
if command -v rsync >/dev/null; then
  rsync -a --delete --exclude node_modules --exclude .env.local --exclude data --exclude '.next*' --exclude next-env.d.ts "$STAGE"/ "$TEST"/
else
  cp -a "$STAGE"/. "$TEST"/
fi
rm -rf "$STAGE"

echo "== 2/6 .env.local i testit (kopje e live-it, me ndryshimet e testit)"
grep -vE '^(NEXT_PUBLIC_GA_ID|KFL_DRAFTS_DIR|MOMENTI_STAGING)=' "$LIVE/.env.local" > "$TEST/.env.local"
{
  echo ""
  echo "# --- test.momenti.info ---"
  echo "MOMENTI_STAGING=1"
  echo "NEXT_PUBLIC_GA_ID="
  echo "KFL_DRAFTS_DIR=$TEST/data/kfl-drafts"
} >> "$TEST/.env.local"
chmod 600 "$TEST/.env.local"
mkdir -p "$TEST/data/kfl-drafts"

echo "== 3/6 Paketat (npm ci)"
cd "$TEST" || fail "nuk u hap $TEST"
npm ci --no-audit --no-fund >/tmp/momenti-test-npm.log 2>&1 || { tail -30 /tmp/momenti-test-npm.log; fail "npm ci deshtoi"; }
sha256sum package-lock.json | cut -d' ' -f1 > .lock-hash

echo "== 4/6 Procesi pm2 '$NAME' (next dev ne port $PORT)"
if pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 restart "$NAME" --update-env >/dev/null
else
  pm2 start npm --name "$NAME" --cwd "$TEST" -- run dev -- --webpack --hostname 127.0.0.1 --port "$PORT" >/dev/null || fail "pm2 nuk e nisi testin"
fi
pm2 save >/dev/null

echo "== 5/6 nginx + fjalekalimi"
command -v openssl >/dev/null || fail "openssl mungon"
printf 'momenti:%s\n' "$(printf '%s' "$TEST_SITE_PASSWORD" | openssl passwd -apr1 -stdin)" > "$HTPASSWD"
chown root:www-data "$HTPASSWD" 2>/dev/null || true
chmod 640 "$HTPASSWD"
if [ ! -f "$SITE" ] || ! grep -q "managed-by-momenti-test" "$SITE"; then
cat > "$SITE" <<NGINX
# managed-by-momenti-test (ops/staging/setup-test-remote.sh)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 25m;

    auth_basic "Momenti test";
    auth_basic_user_file $HTPASSWD;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
NGINX
fi
ln -sf "$SITE" /etc/nginx/sites-enabled/momenti-test
nginx -t >/dev/null 2>&1 || { nginx -t; rm -f /etc/nginx/sites-enabled/momenti-test; fail "konfigurimi nginx kishte gabim (u hoq, live nuk preket)"; }
systemctl reload nginx

echo "== 6/6 HTTPS (Let's Encrypt)"
RESOLVED=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
if [ "$RESOLVED" != "$SERVER_IP" ]; then
  echo "   DNS per $DOMAIN ende nuk tregon $SERVER_IP (tani: ${RESOLVED:-asgje}). HTTPS shtohet kur te rinisim setup-in."
else
  if ! command -v certbot >/dev/null; then
    apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || echo "   certbot nuk u instalua"
  fi
  if command -v certbot >/dev/null; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --keep-until-expiring --register-unsafely-without-email \
      && echo "   HTTPS: OK" || echo "   certbot deshtoi (shiko log-un me lart)"
  fi
fi

echo
echo "== Kontroll: pres qe testi te pergjigjet (kompilimi i pare zgjat)..."
code=000
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/kycu" || true)
  case "$code" in 200|30[1278]) break;; esac
  sleep 3
done
echo "   test /kycu: $code"
echo
echo "=== GATI: https://$DOMAIN (perdoruesi: momenti). Live nuk u prek."
