#!/usr/bin/env bash
# Read-only security + incident report. Prints counts and paths only, never file contents or secrets.
L=/var/log/nginx/access.log
LOGS="$L $(ls /var/log/nginx/access.log.1 2>/dev/null)"
IP=79.124.58.82
echo "== 1. Skaneri $IP: c'pergjigje mori (kodet HTTP)"
cat $LOGS | grep "^$IP " | awk '{print $9}' | sort | uniq -c | sort -rn
echo "   A mori ndonje 200 (sukses)?"; cat $LOGS | grep "^$IP " | awk '$9==200 {print "   200 " $7}' | head -10
echo "   Hera e pare / e fundit:"; cat $LOGS | grep "^$IP " | head -1 | awk '{print "   "$4}'; cat $LOGS | grep "^$IP " | tail -1 | awk '{print "   "$4}'
echo "   Sa faqe te ndryshme provoi:"; cat $LOGS | grep "^$IP " | awk '{print $7}' | sort -u | wc -l

echo; echo "== 2. Kerkesa per skedare sekrete nga CDO IP (24-48 ore) qe moren 200"
cat $LOGS | grep -iE '"(GET|POST|HEAD) [^ ]*(\.env|\.git/|wp-config|\.sql|\.bak|\.zip|\.tar|id_rsa|\.htpasswd|phpinfo|config\.(php|js|json|yml)|settings\.py|docker-compose|composer\.(json|lock)|package(-lock)?\.json|\.DS_Store|backup)' | awk '$9==200 {print "   " $1 " " $9 " " $7}' | sort | uniq -c | sort -rn | head -20
echo "   (bosh = asnje skedar sekret nuk u dha)"

echo; echo "== 3. A jane skedaret sekrete te arritshem nga interneti? (prove direkte)"
for u in https://momenti.info/.env https://momenti.info/.env.local https://momenti.info/package.json https://momenti.info/.git/config https://momenti.info/next.config.ts https://momenti.info/data/invoices/invoices.json \
         https://cms.momenti.info/.env https://cms.momenti.info/wp-config.php https://cms.momenti.info/wp-config.php.bak https://cms.momenti.info/.git/config https://cms.momenti.info/wp-content/debug.log \
         https://redaksia.momenti.info/.env https://test.momenti.info/.env https://test.momenti.info/.env.local; do
  r=$(curl -s -m 10 -o /tmp/probe -w '%{http_code} %{size_download}' "$u"); echo "   $r  $u"
done
echo "   (200 me madhesi > 0 do te thoshte rrezik; wp-config.php 200 me 0 bajt eshte normale)"

echo; echo "== 4. Hyrje ne panelet admin (24-48 ore)"
echo "   wp-login.php sipas kodit:"; cat $LOGS | grep "wp-login.php" | awk '{print $9}' | sort | uniq -c | sort -rn | head
echo "   IP qe provuan wp-login (top):"; cat $LOGS | grep "POST /wp-login.php" | awk '{print $1}' | sort | uniq -c | sort -rn | head -5
echo "   xmlrpc.php:"; cat $LOGS | grep -c "xmlrpc.php"
echo "   /kycu (KFL) POST login:"; cat $LOGS | grep -E 'POST /kycu' | awk '{print $9}' | sort | uniq -c | sort -rn | head -5
echo "   redaksia login POST:"; cat $LOGS | grep -E 'POST / HTTP' | grep -c . 

echo; echo "== 5. SSH: tentime te deshtuara dhe hyrje te suksesshme (7 dite)"
journalctl -u ssh -u sshd --since "7 days ago" --no-pager 2>/dev/null | grep -c "Failed password\|Invalid user" | sed 's/^/   tentime te deshtuara: /'
journalctl -u ssh -u sshd --since "7 days ago" --no-pager 2>/dev/null | grep "Accepted" | awk '{print "   " $1" "$2" "$3"  "$9" nga "$11" ("$7")"}' | sort | uniq -c | tail -15
grep -E "^PasswordAuthentication|^PermitRootLogin" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | sed 's/^/   /'
command -v fail2ban-client >/dev/null && fail2ban-client status 2>/dev/null | sed 's/^/   /' || echo "   fail2ban: nuk eshte instaluar"

echo; echo "== 6. Perdoruesit dhe celesat SSH"
awk -F: '$3>=1000 && $7 !~ /nologin|false/ {print "   user: "$1}' /etc/passwd
echo "   root authorized_keys: $(grep -c . /root/.ssh/authorized_keys 2>/dev/null) celesa"; awk '{print "     " $1 " ... " $NF}' /root/.ssh/authorized_keys 2>/dev/null

echo; echo "== 7. WordPress: perdoruesit admin dhe skedare PHP te rinj ne uploads"
WPDIR=$(grep -rhoE "root [^;]+" /etc/nginx/sites-enabled/momenti-cms 2>/dev/null | head -1 | awk '{print $2}')
echo "   WP: $WPDIR"
[ -n "$WPDIR" ] && find "$WPDIR/wp-content/uploads" -name "*.php" 2>/dev/null | head -5 | sed 's/^/   PHP ne uploads (dyshimte): /'
[ -n "$WPDIR" ] && find "$WPDIR" -name "*.php" -newer "$WPDIR/wp-config.php" -mtime -7 2>/dev/null | grep -v "/wp-content/plugins/\|/wp-content/themes/\|/wp-content/languages/" | head -10 | sed 's/^/   PHP i ndryshuar ne 7 dite: /'
mysql -N -e "SELECT CONCAT('   admin: ',u.user_login,'  regjistruar ',u.user_registered) FROM wp_users u JOIN wp_usermeta m ON m.user_id=u.ID WHERE m.meta_key LIKE '%capabilities' AND m.meta_value LIKE '%administrator%'" $(grep -oP "DB_NAME',\s*'\K[^']+" "$WPDIR/wp-config.php" 2>/dev/null) 2>/dev/null || echo "   (perdoruesit WP nuk u lexuan)"

echo; echo "== 8. Kur ngeci faqja sot? (kodet 499/502/504 sipas minutes)"
grep "31/Oct/2026" $L | awk '$9 ~ /^(499|502|504)$/ {print substr($4,14,5)}' | uniq -c | head -40
echo; echo "== 9. Te gjitha kerkesat sipas minutes 08:00-08:50 (sasia)"
grep -E "31/Oct/2026:0(7|8):" $L | awk '{print substr($4,14,4)"0"}' | uniq -c | head -20
echo; echo "== 10. Rifillimet e pm2 momenti (log)"; grep -h "momenti" /root/.pm2/pm2.log 2>/dev/null | grep -iE "restart|exit|kill|online" | tail -12 | cut -c1-160
echo; echo "== 11. Memoria e kernelit (OOM)"; journalctl -k --since "3 days ago" --no-pager 2>/dev/null | grep -iE "out of memory|killed process" | tail -5
