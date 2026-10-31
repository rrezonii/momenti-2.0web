#!/usr/bin/env bash
# Read-only: check the two root logins made with a PASSWORD, and look for signs of an intruder.
echo "== Hyrjet me fjalekalim (password) ne 14 dite"
journalctl -u ssh -u sshd --since "14 days ago" --no-pager 2>/dev/null | grep "Accepted password" | awk '{print "   "$1" "$2" "$3"  user "$9"  nga "$11}'
echo; echo "== Sesionet e tyre (last)"
last -i -F 2>/dev/null | grep -E "213.177.179.80|154.16.112.232" | head -10 | sed 's/^/   /'
echo; echo "== Te gjitha hyrjet root (last, 15 te fundit)"; last -i -F root 2>/dev/null | head -15 | sed 's/^/   /'
echo; echo "== Cfare ndodhi ne serverin gjate atyre sesioneve (journal, 3 min pas hyrjes)"
for t in $(journalctl -u ssh -u sshd --since "14 days ago" --no-pager -o short-iso 2>/dev/null | grep "Accepted password" | awk '{print $1}'); do
  echo "   --- $t"; journalctl --since "$t" --until "$(date -d "$t + 3 min" --iso-8601=seconds)" --no-pager 2>/dev/null | grep -vE "sshd\[.*(Invalid user|Failed password|Connection closed|Disconnected|Received disconnect|pam_unix\(sshd:auth\)|maximum authentication)" | cut -c1-170 | head -25
done
echo; echo "== Historia e komandave te root (vetem emrat e komandave, rreshtat e fundit)"
[ -f /root/.bash_history ] && { ls -l --time-style=+%F_%T /root/.bash_history | awk '{print "   ndryshuar: "$6}'; tail -n 40 /root/.bash_history | awk '{print "   " $1 " " $2}' ; }
echo; echo "== Cron (te gjitha)"; ls -la --time-style=+%F_%T /etc/cron.d/ | sed 's/^/   /'; crontab -l -u root 2>/dev/null | grep -v "^#" | sed 's/^/   root: /'; crontab -l -u ubuntu 2>/dev/null | grep -v "^#" | sed 's/^/   ubuntu: /'
echo; echo "== Skedare te ndryshuar ne 4 ditet e fundit ne /etc, /root, /usr/local/bin, /tmp, systemd"
find /etc /root /usr/local/bin /usr/bin /usr/sbin /etc/systemd /lib/systemd/system /tmp /var/tmp /dev/shm -xdev -type f -mtime -4 2>/dev/null | grep -vE "^/etc/(nginx/conf.d/momenti-protect|cron.d/momenti-watchdog|letsencrypt|nginx/sites-available/momenti-redaksia)|/root/.pm2/|/root/.npm/|/root/.cache/|/tmp/momenti|/root/.codex/|/etc/ld.so.cache|/tmp/claude|/tmp/nginx-test|/tmp/probe|/root/.config/" | head -40 | sed 's/^/   /'
echo; echo "== Porta te hapura (ne te gjitha adresat)"; ss -ltnup | awk 'NR>1 {print "   "$1" "$5" "$7}' | sort -u
echo; echo "== Procese te dyshimta (miner, reverse shell, emra te rastit)"
ps -eo pid,user,etime,pcpu,args --sort=-pcpu | grep -iE "xmrig|kinsing|kdevtmp|minerd|\bnc\b|ncat|socat|/tmp/|/dev/shm|perl -e|python -c|bash -i|curl .*\| *sh|wget .*\| *sh" | grep -v grep | head | sed 's/^/   /'
echo "   (bosh = asgje e dyshimte)"
echo; echo "== Lidhje dalese aktive"; ss -tnp state established 2>/dev/null | awk 'NR>1 {print $4" "$5" "$6}' | grep -vE "127.0.0.1|::1" | awk '{print "   "$2"  "$3}' | sort | uniq -c | sort -rn | head -15
echo; echo "== authorized_keys (rreshti 2, vetem forma)"; sed -n 2p /root/.ssh/authorized_keys | cut -c1-60 | sed 's/^/   /'; ls -l --time-style=+%F_%T /root/.ssh/authorized_keys | awk '{print "   ndryshuar: "$6}'
echo; echo "== Perdoruesit me UID 0 dhe me shell"; awk -F: '$3==0 {print "   uid0: "$1}' /etc/passwd; ls -l --time-style=+%F_%T /etc/passwd /etc/shadow | awk '{print "   "$7" "$6}'
echo; echo "== WordPress: versioni dhe kur u perditesua"; grep "wp_version =" /var/www/momenti-cms/wp-includes/version.php | sed 's/^/   /'; ls -l --time-style=+%F_%T /var/www/momenti-cms/wp-includes/version.php | awk '{print "   version.php: "$6}'
