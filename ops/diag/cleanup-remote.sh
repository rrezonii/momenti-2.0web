#!/usr/bin/env bash
# Incident 30.10.2026: remove the intruder's programs and persistence, close password logins, add fail2ban.
# Malware is MOVED to a locked quarantine folder (kept as evidence), not executed.
set -u
Q=/root/quarantine-20261031; mkdir -p "$Q"; chmod 700 "$Q"
q() { for f in "$@"; do [ -e "$f" ] || continue; dest="$Q/$(echo "$f" | tr / _)"; mv -f "$f" "$dest" 2>/dev/null && chmod -R 000 "$dest" 2>/dev/null; echo "   karantine: $f"; done; }

echo "== 1. Ndal proceset e sulmuesit"
bad=""
for p in /proc/[0-9]*; do pid=${p#/proc/}; exe=$(readlink "$p/exe" 2>/dev/null); cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null)
  case "$exe $cmd" in *"/dev/shm"*|*"/usr/bin/wbin"*|*traffmonetizer*|*YddJuvFCuFfoLr*|*"/usr/bin/.local/bin"*|*"/bin/.local/bin"*|*"(deleted)"*) bad="$bad $pid"; echo "   $pid $exe $(echo "$cmd" | cut -c1-90)";; esac
done
[ -f /tmp/.apid ] && { a=$(tr -dc 0-9 < /tmp/.apid); [ -n "$a" ] && [ -d /proc/$a ] && { bad="$bad $a"; echo "   $a (nga /tmp/.apid) $(readlink /proc/$a/exe)"; }; }
for pid in $bad; do case "$pid" in 1|$$) continue;; esac; kill -9 "$pid" 2>/dev/null; done
echo "   u ndalen: $(echo $bad | wc -w)"

echo "== 2. Docker i fshehur (instaluar nga sulmuesi me 30.10)"
for c in $(command -v docker >/dev/null && docker ps -aq 2>/dev/null); do echo "   kontejner: $(docker inspect -f '{{.Name}} {{.Config.Image}}' $c 2>/dev/null)"; done
systemctl stop docker docker.socket containerd 2>/dev/null; systemctl disable docker docker.socket containerd 2>/dev/null
pkill -9 -f "dockerd|containerd" 2>/dev/null
q /usr/bin/wbin /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.asc
[ -d /var/lib/docker ] && { mv /var/lib/docker "$Q/var_lib_docker" && chmod 000 "$Q/var_lib_docker" && echo "   karantine: /var/lib/docker"; }

echo "== 3. Programet e falsifikuara dhe PATH"
q /usr/bin/.local /dev/shm/YddJuvFCuFfoLr /dev/shm/.config /tmp/.apid
grep -n "/bin/.local/bin" /etc/profile /etc/bash.bashrc /root/.bashrc /root/.profile /home/ubuntu/.bashrc /home/ubuntu/.profile /etc/environment 2>/dev/null | sed 's/^/   gjetur: /'
for f in /etc/profile /etc/bash.bashrc /root/.bashrc /root/.profile /home/ubuntu/.bashrc /home/ubuntu/.profile /etc/environment; do [ -f "$f" ] && sed -i '\#/bin/.local/bin#d' "$f"; done
echo "   PATH: u hoq"
[ -f /etc/ld.so.preload ] && { echo "   ld.so.preload: $(cat /etc/ld.so.preload)"; q /etc/ld.so.preload; }

echo "== 4. Cron-et e sulmuesit"
q /etc/cron.d/perfclean /etc/cron.hourly/perfclean /etc/cron.daily/perfclean /root/.config/cron
crontab -l -u root 2>/dev/null > /tmp/rootcron.old
grep -v "perfcc" /tmp/rootcron.old > /tmp/rootcron.new; crontab -u root /tmp/rootcron.new && echo "   root crontab: u hoq rreshti perfcc ($(grep -c perfcc /tmp/rootcron.old) rresht)"
for b in $(command -v perfcc 2>/dev/null) /usr/bin/perfcc /usr/local/bin/perfcc /usr/sbin/perfcc /bin/perfcc; do q "$b"; done
sed -i '\#^/usr/sbin/nologin $#d' /etc/shells
atq 2>/dev/null | sed 's/^/   at: /'

echo "== 5. Kontrolli i llogarive"
echo "   ndryshimet ne /etc/passwd kundrejt kopjes rezerve:"; diff /etc/passwd- /etc/passwd 2>/dev/null | sed 's/^/     /' || true
echo "   ndryshimet ne /etc/group:"; diff /etc/group- /etc/group 2>/dev/null | sed 's/^/     /' || true
echo "   authorized_keys (rreshtat qe s'jane celesa):"; grep -vnE "^(ssh-|ecdsa-|sk-)" /root/.ssh/authorized_keys | cut -c1-40 | sed 's/^/     /'
for f in /etc/rc.local /root/.ssh/rc /etc/ssh/sshrc; do [ -f "$f" ] && echo "   ekziston: $f ($(stat -c %y "$f" | cut -c1-16))"; done
find /etc/systemd/system /lib/systemd/system /etc/init.d -newer /etc/hostname -mtime -3 -type f 2>/dev/null | sed 's/^/   systemd i ri: /'

echo "== 6. SSH: vetem me celes, pa fjalekalim"
cat > /etc/ssh/sshd_config.d/00-momenti-hardening.conf <<'C'
# Incident 30.10.2026: password logins were brute-forced. Keys only.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 3
C
if sshd -t 2>/tmp/sshd-t.txt; then systemctl reload ssh 2>/dev/null || systemctl reload sshd; echo "   sshd: OK ($(sshd -T 2>/dev/null | grep -E '^(passwordauthentication|permitrootlogin)' | tr '\n' ' '))"; else cat /tmp/sshd-t.txt; rm -f /etc/ssh/sshd_config.d/00-momenti-hardening.conf; echo "   XXX sshd nuk e pranoi - u kthye"; fi

echo "== 7. fail2ban dhe bllokimi i IP-ve"
command -v fail2ban-client >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban >/dev/null 2>&1
cat > /etc/fail2ban/jail.d/momenti.conf <<'C'
[sshd]
enabled = true
maxretry = 4
findtime = 10m
bantime = 24h
C
systemctl enable --now fail2ban >/dev/null 2>&1; systemctl restart fail2ban; sleep 2
fail2ban-client status sshd 2>/dev/null | grep -E "Currently|Total" | sed 's/^/   /'
for ip in 154.16.112.232 79.124.58.82; do ufw insert 1 deny from $ip >/dev/null 2>&1 && echo "   ufw: bllokuar $ip"; done

echo "== 8. Kontroll pas pastrimit"
left=0; for p in /proc/[0-9]*; do exe=$(readlink "$p/exe" 2>/dev/null); case "$exe" in *"/dev/shm"*|*wbin*|*traffmon*|*"(deleted)"*|*"/.local/bin"*) left=$((left+1)); echo "   ende: ${p#/proc/} $exe";; esac; done
echo "   procese te dyshimta te mbetura: $left"
echo "   lidhje dalese te jashtme:"; ss -tnp state established 2>/dev/null | awk 'NR>1 {print $4, $5}' | grep -vE "^(127\.|\[::1\]|62\.171\.174\.17)" | awk '{print "     "$1" "$2}' | head -10
for u in https://momenti.info/sq https://redaksia.momenti.info/ https://cms.momenti.info/wp-json/; do curl -s -m 20 -o /dev/null -w "   $u -> %{http_code}\n" "$u"; done
uptime
