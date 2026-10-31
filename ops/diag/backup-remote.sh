#!/usr/bin/env bash
# Builds /root/momenti-backup.tar.gz with everything needed to rebuild after the reinstall.
# Code is NOT included (it comes from GitHub). Executable code from the old server is NOT kept
# (no PHP from uploads, no plugins/themes - they are reinstalled clean).
set -u
B=/root/momenti-backup; rm -rf $B; mkdir -p $B; chmod 700 $B
echo "== WordPress databaza"
DB=$(grep -oP "DB_NAME',\s*'\K[^']+" /var/www/momenti-cms/wp-config.php)
mysqldump --single-transaction --quick --routines --default-character-set=utf8mb4 "$DB" | gzip > $B/wordpress-db.sql.gz && echo "   $(du -h $B/wordpress-db.sql.gz | cut -f1)"
cp /var/www/momenti-cms/wp-config.php $B/wp-config.php.reference
echo "== WordPress uploads (pa PHP)"
tar -C /var/www/momenti-cms/wp-content -czf $B/wp-uploads.tar.gz --exclude='*.php' --exclude='*.phtml' --exclude='*.phar' uploads && echo "   $(du -h $B/wp-uploads.tar.gz | cut -f1)"
( cd /var/www/momenti-cms/wp-content/plugins && for p in */; do v=$(grep -rhoiE "^\s*\*?\s*Version:\s*[0-9.]+" "$p" --include=*.php 2>/dev/null | head -1 | grep -oE "[0-9.]+$"); echo "${p%/} $v"; done ) > $B/wp-plugins.txt
grep "wp_version =" /var/www/momenti-cms/wp-includes/version.php > $B/wp-version.txt
echo "== Te dhenat e faqes (drafte, fatura, kalkulator)"
tar -C /var/www/momenti -czf $B/momenti-data.tar.gz data && echo "   live: $(du -h $B/momenti-data.tar.gz | cut -f1)"
tar -C /var/www/momenti-test -czf $B/momenti-test-data.tar.gz data && echo "   test: $(du -h $B/momenti-test-data.tar.gz | cut -f1)"
echo "== Konfigurimet (.env) dhe skedare jashte git-it"
mkdir -p $B/env; cp /var/www/momenti/.env.local $B/env/live.env.local; cp /var/www/momenti/.env.translation $B/env/live.env.translation 2>/dev/null; cp /var/www/momenti-test/.env.local $B/env/test.env.local
cd /var/www/momenti && git ls-files >/dev/null 2>&1 && echo "   (git repo)" || true
find /var/www/momenti -maxdepth 3 -type f -not -path "*/node_modules/*" -not -path "*/.next*" -not -path "*/data/*" -newer /var/www/momenti/package.json -mtime -60 2>/dev/null | head -50 > $B/live-extra-files.txt
[ -d /var/www/momenti/klan-rss ] && tar -C /var/www/momenti -czf $B/klan-rss.tar.gz --exclude='*.log' klan-rss && echo "   klan-rss: $(du -h $B/klan-rss.tar.gz | cut -f1)"
echo "== Redis (numerimi i leximeve)"; redis-cli SAVE >/dev/null 2>&1; cp /var/lib/redis/dump.rdb $B/redis-dump.rdb 2>/dev/null && echo "   $(du -h $B/redis-dump.rdb | cut -f1)"
echo "== nginx, cron, pm2 (vetem per reference)"
mkdir -p $B/ref; cp /etc/nginx/sites-available/* $B/ref/ 2>/dev/null; cp /etc/nginx/conf.d/*.conf $B/ref/ 2>/dev/null
crontab -l 2>/dev/null | grep -v perfcc > $B/ref/root-crontab.txt; cp /etc/cron.d/staticroute $B/ref/ 2>/dev/null
pm2 jlist > $B/ref/pm2.json 2>/dev/null; cp /etc/php/8.1/fpm/pool.d/www.conf $B/ref/php-www.conf 2>/dev/null
[ -d /var/lib/momenti-scraper ] && tar -C /var/lib -czf $B/momenti-scraper.tar.gz momenti-scraper
pip3 freeze 2>/dev/null > $B/ref/pip-freeze.txt; du -sh /root/.local/share/argos-translate 2>/dev/null > $B/ref/argos-size.txt
echo "== Celesat publike SSH (per serverin e ri)"; grep -E "^ssh-" /root/.ssh/authorized_keys | awk '{print "   " $1 " ... " $NF}'; grep -E "^ssh-" /root/.ssh/authorized_keys > $B/ref/authorized_keys.pub
echo "== Paketimi"
tar -C /root -czf /root/momenti-backup.tar.gz momenti-backup && rm -rf $B
ls -la /root/momenti-backup.tar.gz | awk '{print "   " $5/1048576 " MB"}'; sha256sum /root/momenti-backup.tar.gz | awk '{print "   sha256 " $1}'
