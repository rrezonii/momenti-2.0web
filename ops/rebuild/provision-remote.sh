#!/usr/bin/env bash
# Rebuild of the Momenti VPS on a CLEAN Ubuntu (after the 30.10.2026 intrusion and the Contabo reinstall).
# Input (uploaded by the "Server: rebuild" workflow to /root/rebuild):
#   backup.tar.gz   decrypted backup (DB dump, WP uploads without PHP, data/, .env files, redis)
#   live.tar.gz     code of branch main (git archive)    test.tar.gz  code of branch test
# Nothing executable is taken from the old server: WordPress core and plugins are downloaded fresh,
# the site code comes from GitHub. Secrets are never printed.
set -uo pipefail
exec > >(tee /root/rebuild/rebuild.log) 2>&1
R=/root/rebuild
LIVE=/var/www/momenti; TEST=/var/www/momenti-test; WP=/var/www/momenti-cms
step() { echo; echo "== $*"; }
fail() { echo; echo "XXX DESHTOI: $*"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
[ -f $R/backup.tar.gz ] && [ -f $R/live.tar.gz ] && [ -f $R/test.tar.gz ] || fail "skedaret e rindertimit mungojne"

step "1/12 Paketat e sistemit"
timedatectl set-timezone Europe/Belgrade
apt-get update -qq && apt-get -y -qq upgrade >/dev/null
apt-get install -y -qq nginx libnginx-mod-http-geoip2 mariadb-server redis-server php-fpm php-mysql php-xml php-curl php-gd \
  php-mbstring php-zip php-intl php-imagick php-bcmath certbot python3-certbot-nginx fail2ban ufw git curl unzip rsync \
  python3-venv python3-pip ca-certificates gnupg >/dev/null || fail "apt install"
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null && apt-get install -y -qq nodejs >/dev/null || fail "nodejs"
fi
npm i -g pm2 >/dev/null 2>&1 || fail "pm2"
curl -fsSLo /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod 755 /usr/local/bin/wp
PHPV=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;'); SOCK=/run/php/php$PHPV-fpm.sock
echo "   node $(node -v), php $PHPV, $(nginx -v 2>&1), $(mysql --version | cut -c1-40)"

step "2/12 Siguria: SSH vetem me celes, fail2ban, firewall, swap"
cat > /etc/ssh/sshd_config.d/00-momenti-hardening.conf <<'C'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 3
C
sshd -t && (systemctl reload ssh 2>/dev/null || systemctl reload sshd)
printf '[sshd]\nenabled = true\nmaxretry = 4\nfindtime = 10m\nbantime = 24h\n' > /etc/fail2ban/jail.d/momenti.conf
systemctl enable --now fail2ban >/dev/null 2>&1; systemctl restart fail2ban
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
for ip in 154.16.112.232 79.124.58.82; do ufw deny from $ip >/dev/null; done
ufw --force enable >/dev/null
[ -f /swapfile ] || { fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab; }
echo "   sshd: $(sshd -T | grep -E '^passwordauthentication' ) | ufw: $(ufw status | head -1)"

step "3/12 Backup-i"
rm -rf $R/b && mkdir -p $R/b && tar -xzf $R/backup.tar.gz -C $R/b && B=$R/b/momenti-backup
[ -f $B/wordpress-db.sql.gz ] || fail "backup-i s'ka databaze"
ls $B | sed 's/^/   /'

step "4/12 MariaDB (fjalekalim i ri per databazen)"
PREFIX=$(grep -oP "table_prefix\s*=\s*'\K[^']+" $B/wp-config.php.reference); PREFIX=${PREFIX:-wp_}
DBPASS=$(openssl rand -base64 33 | tr -dc 'A-Za-z0-9' | head -c 32)
mysql -e "CREATE DATABASE IF NOT EXISTS momenti_wp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'momenti_wp'@'localhost'; ALTER USER 'momenti_wp'@'localhost' IDENTIFIED BY '$DBPASS';
  GRANT ALL PRIVILEGES ON momenti_wp.* TO 'momenti_wp'@'localhost'; FLUSH PRIVILEGES;"
zcat $B/wordpress-db.sql.gz | mysql momenti_wp || fail "importi i databazes"
echo "   tabela: $(mysql -N -e "select count(*) from information_schema.tables where table_schema='momenti_wp'"), postime: $(mysql -N -e "select count(*) from momenti_wp.${PREFIX}posts where post_type='post'")"
echo "   adminet: $(mysql -N -e "select group_concat(u.user_login) from momenti_wp.${PREFIX}users u join momenti_wp.${PREFIX}usermeta m on m.user_id=u.ID where m.meta_key='${PREFIX}capabilities' and m.meta_value like '%administrator%'")"

step "5/12 WordPress i paster (core + plugin-et nga wordpress.org)"
WPVER=$(grep -oP "'\K[0-9.]+" $B/wp-version.txt | head -1)
rm -rf $WP && mkdir -p $WP && cd $WP
wp core download --allow-root --version="$WPVER" --quiet 2>/dev/null || wp core download --allow-root --quiet || fail "wp core"
wp config create --allow-root --dbname=momenti_wp --dbuser=momenti_wp --dbpass="$DBPASS" --dbprefix="$PREFIX" --skip-check --quiet
wp config shuffle-salts --allow-root --quiet
wp config set WP_DEBUG false --raw --allow-root --quiet
wp config set DISALLOW_FILE_EDIT true --raw --allow-root --quiet
for p in wpematico featured-image-from-url akismet; do wp plugin install $p --allow-root --quiet 2>&1 | tail -1; done
tar -xzf $B/wp-uploads.tar.gz -C $WP/wp-content/
find $WP/wp-content/uploads -name '*.php' -delete
wp theme install twentytwentyfive --allow-root --quiet 2>/dev/null
chown -R www-data:www-data $WP; find $WP -type d -exec chmod 755 {} +; find $WP -type f -exec chmod 644 {} +; chmod 640 $WP/wp-config.php
echo "   WordPress $(wp core version --allow-root), plugin-et aktive: $(wp plugin list --status=active --field=name --allow-root | tr '\n' ' ')"
sed -i -E 's/^(upload_max_filesize|post_max_size) = .*/\1 = 128M/' /etc/php/$PHPV/fpm/php.ini
sed -i -E 's/^pm.max_children = .*/pm.max_children = 12/; s/^pm.max_spare_servers = .*/pm.max_spare_servers = 6/; s/^pm.start_servers = .*/pm.start_servers = 3/' /etc/php/$PHPV/fpm/pool.d/www.conf
systemctl restart php$PHPV-fpm

step "6/12 Redis"
systemctl stop redis-server; [ -s $B/redis-dump.rdb ] && cp $B/redis-dump.rdb /var/lib/redis/dump.rdb && chown redis:redis /var/lib/redis/dump.rdb
systemctl enable --now redis-server >/dev/null 2>&1; systemctl start redis-server; echo "   redis: $(redis-cli ping)"

step "7/12 GeoIP (shteti i vizitorit)"
mkdir -p /usr/share/GeoIP
curl -fsSL "https://download.db-ip.com/free/dbip-country-lite-$(date +%Y-%m).mmdb.gz" | gunzip > /usr/share/GeoIP/DBIP-Country.mmdb \
  || curl -fsSL "https://download.db-ip.com/free/dbip-country-lite-$(date -d '-1 month' +%Y-%m).mmdb.gz" | gunzip > /usr/share/GeoIP/DBIP-Country.mmdb
echo "   $(du -h /usr/share/GeoIP/DBIP-Country.mmdb | cut -f1)"

step "8/12 Faqja live (kodi nga GitHub main)"
mkdir -p $LIVE && tar -xzf $R/live.tar.gz -C $LIVE --no-same-owner
cp $B/env/live.env.local $LIVE/.env.local; [ -f $B/env/live.env.translation ] && cp $B/env/live.env.translation $LIVE/.env.translation
chmod 600 $LIVE/.env.local $LIVE/.env.translation 2>/dev/null
# New session secret: everyone logs in to KFL again (the old one may have been read by the intruder).
NEWSEC=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48)
if grep -q '^KFL_SESSION_SECRET=' $LIVE/.env.local; then sed -i "s|^KFL_SESSION_SECRET=.*|KFL_SESSION_SECRET=$NEWSEC|" $LIVE/.env.local; fi
tar -xzf $B/momenti-data.tar.gz -C $LIVE
# Argos (translation): the python set in ARGOS_PYTHON gets a fresh virtualenv.
AP=$(grep -oP '^ARGOS_PYTHON=\K.*' $LIVE/.env.local | tr -d "\"'"); AP=${AP:-python3}
if [ "$AP" != "python3" ] && [ ! -x "$AP" ]; then VENV=$(dirname "$(dirname "$AP")"); python3 -m venv "$VENV" && "$VENV/bin/pip" install -q -r $LIVE/requirements-translation.txt && echo "   argos venv: $VENV"; fi
[ "$AP" = "python3" ] && pip3 install -q --break-system-packages -r $LIVE/requirements-translation.txt 2>/dev/null
PY=$( [ -x "$AP" ] && echo "$AP" || echo python3 )
$PY - <<'PY' 2>&1 | tail -1
import argostranslate.package as p
p.update_package_index()
pk=[x for x in p.get_available_packages() if x.from_code=="sq" and x.to_code=="en"]
if pk: p.install_from_path(pk[0].download()); print("   argos sq->en: OK")
else: print("   argos sq->en: nuk u gjet")
PY
cd $LIVE && npm ci --no-audit --no-fund >/tmp/npm-live.log 2>&1 || { tail -20 /tmp/npm-live.log; fail "npm ci live"; }
DIST=.next-rebuild-$(date +%Y%m%d-%H%M)
NEXT_BUILD_DIST_DIR=$DIST NEXT_TELEMETRY_DISABLED=1 npm run build >/tmp/build-live.log 2>&1 || { tail -30 /tmp/build-live.log; fail "build live"; }
pm2 delete momenti >/dev/null 2>&1; NEXT_BUILD_DIST_DIR=$DIST NEXT_TELEMETRY_DISABLED=1 pm2 start npm --name momenti --cwd $LIVE -- start >/dev/null
echo "   build: $DIST"

step "9/12 Faqja test (kodi nga GitHub test)"
mkdir -p $TEST && tar -xzf $R/test.tar.gz -C $TEST --no-same-owner
cp $B/env/test.env.local $TEST/.env.local; chmod 600 $TEST/.env.local
grep -q '^KFL_SESSION_SECRET=' $TEST/.env.local && sed -i "s|^KFL_SESSION_SECRET=.*|KFL_SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48)|" $TEST/.env.local
sed -i "s|^KFL_DRAFTS_DIR=.*|KFL_DRAFTS_DIR=$TEST/data/kfl-drafts|" $TEST/.env.local
tar -xzf $B/momenti-test-data.tar.gz -C $TEST
cd $TEST && npm ci --no-audit --no-fund >/tmp/npm-test.log 2>&1 && sha256sum package-lock.json | cut -d' ' -f1 > .lock-hash
pm2 delete momenti-test >/dev/null 2>&1; pm2 start npm --name momenti-test --cwd $TEST -- run dev -- --webpack --hostname 127.0.0.1 --port 3100 >/dev/null
pm2 save >/dev/null; pm2 startup systemd -u root --hp /root >/dev/null 2>&1; systemctl enable pm2-root >/dev/null 2>&1

step "10/12 nginx"
rm -f /etc/nginx/sites-enabled/default
cat > /etc/nginx/conf.d/momenti-geoip2.conf <<'N'
geoip2 /usr/share/GeoIP/DBIP-Country.mmdb {
    auto_reload 24h;
    $momenti_geo_country_code default=XX country iso_code;
}
N
cat > /etc/nginx/conf.d/momenti-protect.conf <<'N'
deny 79.124.58.82;
deny 154.16.112.232;
geo $momenti_trusted { default 0; 127.0.0.1 1; ::1 1; 62.171.174.17 1; }
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
N
echo 'proxy_set_header X-Country-Code $momenti_geo_country_code;' > /etc/nginx/snippets/momenti-country-header.conf
printf 'location ^~ /static/media/ {\n    rewrite ^/static/media/(.*)$ /_next/static/media/$1 last;\n}\n' > /etc/nginx/snippets/momenti-static-media.conf
P='proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme;'
cat > /etc/nginx/sites-available/momenti <<N
server {
    listen 80; listen [::]:80;
    server_name momenti.info www.momenti.info;
    include snippets/momenti-static-media.conf;
    location = /klan-rss/klan-kosova-rss.php {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $LIVE/klan-rss/klan-kosova-rss.php;
        fastcgi_pass unix:$SOCK;
    }
    location ^~ /klan-rss/ { return 404; }
    location = /kycu/api/enhance-pruna { client_max_body_size 20M; $P proxy_read_timeout 190s; }
    location = /kycu/api/export { client_max_body_size 20M; $P include snippets/momenti-country-header.conf; }
    location = /kycu/api/enhance-ai { client_max_body_size 20M; $P include snippets/momenti-country-header.conf; proxy_read_timeout 620s; proxy_send_timeout 620s; proxy_connect_timeout 10s; }
    location = /kycu/api/drafts { client_max_body_size 100M; $P include snippets/momenti-country-header.conf; }
    location = /api/translations/process { $P include snippets/momenti-country-header.conf; proxy_read_timeout 180s; proxy_send_timeout 180s; proxy_connect_timeout 10s; }
    location / {
        proxy_cookie_path /kycu /;
        $P
        include snippets/momenti-country-header.conf;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
N
cat > /etc/nginx/sites-available/momenti-cms <<N
server {
    listen 80; listen [::]:80;
    server_name cms.momenti.info;
    client_max_body_size 128M;
    root $WP;
    index index.php index.html;
    location / { try_files \$uri \$uri/ /index.php?\$args; }
    location ~* ^/wp-content/uploads/.*\.(php|phtml|phar)\$ { deny all; }
    location = /xmlrpc.php { deny all; }
    location ~ \.php\$ { include snippets/fastcgi-php.conf; fastcgi_pass unix:$SOCK; }
    location ~ /\.(ht|git|env) { deny all; }
}
N
cat > /etc/nginx/sites-available/momenti-test <<'N'
server {
    listen 80; listen [::]:80;
    server_name test.momenti.info;
    client_max_body_size 25m;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
N
R2='proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $remote_addr; proxy_read_timeout 300s;'
cat > /etc/nginx/sites-available/momenti-redaksia <<N
# managed-by-momenti-redaksia backend-port=3000
server {
    listen 80; listen [::]:80;
    server_name redaksia.momenti.info;
    client_max_body_size 25m;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    location = / { proxy_pass http://127.0.0.1:3000/redaksia\$is_args\$args; $R2 }
    location ~ ^/(redaksia|faturat|calculator)(/|\$) { proxy_pass http://127.0.0.1:3000; $R2 }
    location /_next/ { proxy_pass http://127.0.0.1:3000; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection "upgrade"; $R2 }
    location = /favicon.ico { proxy_pass http://127.0.0.1:3000; $R2 }
    location / { return 302 /; }
}
N
for s in momenti momenti-cms momenti-test momenti-redaksia; do ln -sf /etc/nginx/sites-available/$s /etc/nginx/sites-enabled/$s; done
nginx -t 2>&1 | tail -2 && systemctl reload nginx || fail "nginx"

step "11/12 HTTPS + cron + watchdog"
certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect \
  -d momenti.info -d www.momenti.info -d cms.momenti.info -d test.momenti.info -d redaksia.momenti.info 2>&1 | grep -E "Successfully|Congratulations|error|Error" | head -5
{ crontab -l 2>/dev/null | grep -v process-translations; echo '*/5 * * * * set -a; . /var/www/momenti/.env.translation; set +a; cd /var/www/momenti && node scripts/process-translations.mjs recent >> /var/log/momenti-translation-recent.log 2>&1'; } | crontab -
cat > /usr/local/bin/momenti-watchdog.sh <<'WD'
#!/usr/bin/env bash
LOG=/var/log/momenti-watchdog.log; STATE=/run/momenti-watchdog.fail
code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' -H "Accept-Language: sq" http://127.0.0.1:3000/sq || true)
case "$code" in 200|30[1278]) rm -f "$STATE"; exit 0;; esac
if [ -f "$STATE" ]; then echo "$(date '+%F %T') live nuk u pergjigj 2 here (kodi $code) -> pm2 restart momenti" >> $LOG; PM2_HOME=/root/.pm2 pm2 restart momenti >/dev/null 2>&1; rm -f "$STATE"
else echo "$(date '+%F %T') live nuk u pergjigj (kodi $code)" >> $LOG; touch "$STATE"; fi
pid=$(ss -ltnp 2>/dev/null | awk '/127.0.0.1:3100/' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
[ -n "$pid" ] && trss=$(ps -o rss= -p "$pid" | tr -d ' ') && [ -n "$trss" ] && [ "$trss" -gt 2000000 ] && { echo "$(date '+%F %T') testi $((trss/1024)) MB -> restart" >> $LOG; PM2_HOME=/root/.pm2 pm2 restart momenti-test >/dev/null 2>&1; }
WD
chmod 755 /usr/local/bin/momenti-watchdog.sh
printf 'PATH=%s:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n*/2 * * * * root /usr/local/bin/momenti-watchdog.sh\n' "$(dirname "$(command -v pm2)")" > /etc/cron.d/momenti-watchdog

step "12/12 Kontrolli"
for i in $(seq 1 40); do c=$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/sq); [ "$c" = 200 ] && break; sleep 3; done
for u in https://momenti.info/sq https://cms.momenti.info/wp-json/ https://redaksia.momenti.info/ https://test.momenti.info/kycu; do
  curl -s -m 60 -o /dev/null -w "   $u -> %{http_code} ne %{time_total}s\n" "$u"; done
pm2 ls | sed 's/^/   /'
echo "   host key (per GitHub secret VPS_KNOWN_HOSTS):"; ssh-keyscan -t ed25519 62.171.174.17 2>/dev/null | sed 's/^/   /'
rm -rf $R/b $R/backup.tar.gz
echo; echo "=== RINDERTIMI PERFUNDOI"
