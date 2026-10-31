#!/usr/bin/env bash
# Read-only: what must be saved before the reinstall, and how big it is.
sz() { du -sh "$1" 2>/dev/null | awk -v p="$1" '{printf "   %-55s %s\n", p, $1}'; }
echo "== Faqet ne nginx"; for f in /etc/nginx/sites-enabled/*; do echo "   $(basename $f): $(grep -h server_name $f | head -1 | xargs) | root/proxy: $(grep -hoE 'root [^;]+|proxy_pass [^;]+' $f | sort -u | head -3 | xargs)"; done
echo "== /var/www"; for d in /var/www/*; do sz "$d"; done
echo "== WordPress"; WP=/var/www/momenti-cms; sz $WP/wp-content/uploads; sz $WP/wp-content/plugins; sz $WP/wp-content/themes
ls $WP/wp-content/plugins | sed 's/^/   plugin: /'; ls $WP/wp-content/themes | sed 's/^/   theme: /'
echo "   PHP ne uploads: $(find $WP/wp-content/uploads -name '*.php' 2>/dev/null | wc -l)"
DB=$(grep -oP "DB_NAME',\s*'\K[^']+" $WP/wp-config.php); echo "   DB: $DB"
mysql -N -e "SELECT table_schema, ROUND(SUM(data_length+index_length)/1048576) FROM information_schema.tables GROUP BY table_schema" 2>/dev/null | sed 's/^/   db (MB): /'
echo "== Te dhenat e Next"; for d in /var/www/momenti/data/* /var/www/momenti-test/data/*; do sz "$d"; done
echo "== .env skedaret (vetem emrat e celesave)"; for f in /var/www/momenti/.env* /var/www/momenti-test/.env* /var/www/momenti/klan-rss/.env*; do [ -f "$f" ] && echo "   $f: $(grep -oE '^[A-Z0-9_]+' $f | tr '\n' ' ')"; done
echo "== Cron i root"; crontab -l 2>/dev/null | grep -v '^#' | sed 's/^/   /'
echo "== /etc/cron.d"; ls /etc/cron.d | sed 's/^/   /'
echo "== Sherbime systemd te veta (jo paketa)"; for f in /etc/systemd/system/*.service /etc/systemd/system/*.timer; do [ -f "$f" ] && echo "   $(basename $f)"; done
echo "== pm2"; pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))console.log("   "+p.name+": "+p.pm2_env.pm_exec_path+" "+(p.pm2_env.args||[]).join(" ")+" cwd="+p.pm2_env.pm_cwd)})'
echo "== Versionet"; lsb_release -ds; node -v; npm -v; php -v | head -1; mysql --version; nginx -v 2>&1; redis-server --version | cut -c1-40; python3 --version; pip3 list 2>/dev/null | grep -iE "argos|ctranslate|sentencepiece|stanza" | sed 's/^/   /'
echo "== Argos modelet"; du -sh /root/.local/share/argos-translate 2>/dev/null
echo "== /var/lib/momenti-scraper"; sz /var/lib/momenti-scraper; ls /var/lib/momenti-scraper 2>/dev/null | head
echo "== Let's Encrypt domenet"; ls /etc/letsencrypt/live 2>/dev/null | sed 's/^/   /'
echo "== PHP-FPM / PHP ext"; php -m | tr '\n' ' ' | cut -c1-400; echo
echo "== Disk"; df -h / | tail -1
