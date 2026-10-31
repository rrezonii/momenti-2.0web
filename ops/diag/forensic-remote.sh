#!/usr/bin/env bash
# Read-only forensics. Shows short snippets of suspicious files; executes none of them.
show() { echo "   --- $1 ($(stat -c '%y %s B' "$1" 2>/dev/null | cut -c1-19))"; head -c 900 "$1" 2>/dev/null | tr -cd '\11\12\15\40-\176' | head -25 | sed 's/^/     /'; echo; }
echo "== Cron i dyshimte"; for f in /etc/cron.d/perfclean /etc/cron.hourly/perfclean /etc/cron.daily/perfclean /root/.config/cron/perfcc; do show $f; done
echo "== /etc/profile (fundi)"; tail -n 12 /etc/profile | sed 's/^/     /'
echo "== /usr/bin/.local/bin"; ls -la --time-style=+%F_%T /usr/bin/.local/bin/ 2>/dev/null | sed 's/^/     /'; show /usr/bin/.local/bin/top
echo "== /usr/bin/wbin"; ls -la --time-style=+%F_%T /usr/bin/wbin/ 2>/dev/null | sed 's/^/     /'
echo "== /dev/shm dhe /tmp te fshehura"; ls -la --time-style=+%F_%T /dev/shm/ /dev/shm/.config 2>/dev/null | sed 's/^/     /'; file /dev/shm/YddJuvFCuFfoLr /tmp/.apid 2>/dev/null | sed 's/^/     /'; show /tmp/.apid
echo "== /usr/sbin/nologin (duhet te jete binar i vogel)"; ls -la /usr/sbin/nologin; file /usr/sbin/nologin | sed 's/^/     /'
echo "== /etc/passwd: llogari me shell (bash/sh)"; grep -E "(bash|sh)$" /etc/passwd | sed 's/^/     /'
echo "== /etc/shells"; cat /etc/shells | sed 's/^/     /'
echo "== /etc/group: sudo/docker"; grep -E "^(sudo|docker|root|adm):" /etc/group | sed 's/^/     /'
echo "== sudoers.d"; ls -la /etc/sudoers.d/ | sed 's/^/     /'
echo "== Proceset nga /proc (anashkalon programet e falsifikuara)"
for p in /proc/[0-9]*; do pid=${p#/proc/}; exe=$(readlink $p/exe 2>/dev/null); cmd=$(tr '\0' ' ' < $p/cmdline 2>/dev/null | cut -c1-110); [ -n "$cmd" ] || continue
  case "$exe" in /usr/lib/*|/usr/sbin/sshd|/usr/sbin/nginx*|/usr/sbin/mariadbd|/usr/bin/redis*|/usr/sbin/php-fpm*|/usr/bin/node|/usr/bin/bash|/usr/sbin/cron|/usr/bin/dbus*|/usr/sbin/rsyslogd|/usr/bin/python3*|/usr/sbin/agetty|/usr/bin/sleep|/usr/sbin/irqbalance|/usr/bin/sudo|/usr/bin/curl) continue;; esac
  echo "     $pid  exe=$exe  cpu=$(awk '{print $14+$15}' $p/stat)  $cmd"; done | head -40
echo "== Docker"; ls -la /var/lib/docker 2>/dev/null | head -3 | sed 's/^/     /'; systemctl is-active docker 2>/dev/null | sed 's/^/     docker: /'; [ -x /usr/bin/wbin/dockerd ] && echo "     dockerd i fshehur ekziston"
echo "== Sherbime systemd te reja (7 dite)"; find /etc/systemd/system /lib/systemd/system -name "*.service" -mtime -7 2>/dev/null | sed 's/^/     /'
echo "== ufw"; ufw status 2>/dev/null | head -20 | sed 's/^/     /'
echo "== Lidhje dalese (IP te jashtme)"; ss -tnp state established 2>/dev/null | awk 'NR>1 {print $4}' | grep -vE "^(127\.|\[::1\]|62\.171\.174\.17)" | sed -E 's/:[0-9]+$//' | sort | uniq -c | sort -rn | head -10 | sed 's/^/     /'
echo "== Ngarkesa reale CPU (top 8 nga /proc)"; for p in /proc/[0-9]*; do echo "$(awk '{print $14+$15}' $p/stat 2>/dev/null) ${p#/proc/} $(readlink $p/exe 2>/dev/null)"; done | sort -rn | head -8 | sed 's/^/     /'
echo "== Hyrja nga 154.16.112.232 dhe 213.177.179.x: c'u be 10 min pas (auth.log)"
grep -hE "Oct 30 22:(3[1-9]|4[0-9])|Oct 29 23:5[7-9]|Oct 30 00:0" /var/log/auth.log* 2>/dev/null | grep -vE "Invalid user|Failed password|Connection closed|Disconnected|Received disconnect|authentication failure|maximum authentication|Connection reset|invalid user|preauth" | cut -c1-170 | head -30 | sed 's/^/     /'
