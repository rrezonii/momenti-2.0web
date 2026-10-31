#!/usr/bin/env bash
# Prints server config files (no secrets) so the new server can be set up the same way.
for f in /etc/nginx/sites-available/momenti /etc/nginx/sites-available/momenti-cms /etc/nginx/conf.d/momenti-geoip2.conf /etc/cron.d/staticroute; do
  echo "=================== $f ($(stat -c %y $f | cut -c1-16))"; grep -vE "^\s*#|^\s*$" "$f" | grep -vE "ssl_certificate|ssl_dhparam|include /etc/letsencrypt"
done
echo "=================== nginx modules"; ls /etc/nginx/modules-enabled/; dpkg -l | grep -E "geoip|nginx" | awk '{print $2, $3}'
echo "=================== GeoIP db"; ls -la /usr/share/GeoIP/ /var/lib/GeoIP/ 2>/dev/null | head; grep -vE "^#|^$" /etc/GeoIP.conf 2>/dev/null | sed -E 's/(LicenseKey|AccountID).*/\1 ***/'
echo "=================== php-fpm pool"; grep -vE "^\s*;|^\s*$" /etc/php/8.1/fpm/pool.d/www.conf
echo "=================== php.ini ndryshime"; grep -E "^(upload_max_filesize|post_max_size|memory_limit|max_execution_time)" /etc/php/8.1/fpm/php.ini
echo "=================== wpematico/wp cron"; grep -E "DISABLE_WP_CRON|WP_MEMORY|WP_DEBUG|FS_METHOD|WP_HOME|WP_SITEURL" /var/www/momenti-cms/wp-config.php
echo "=================== pm2 startup"; systemctl cat pm2-root 2>/dev/null | grep -E "ExecStart|Environment" 
echo "=================== live pm2 env (emrat)"; pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="momenti");console.log(Object.keys(p.pm2_env.env||{}).filter(k=>/^(NEXT|NODE|PORT|MOMENTI)/.test(k)).map(k=>k+"="+p.pm2_env.env[k]).join("\n"))})'
echo "=================== redis conf"; grep -E "^(requirepass|bind|maxmemory|save)" /etc/redis/redis.conf | sed -E 's/requirepass .*/requirepass ***/'
echo "=================== mariadb users"; mysql -N -e "select user,host from mysql.user"
echo "=================== swap / timezone"; swapon --show; timedatectl | grep "Time zone"
