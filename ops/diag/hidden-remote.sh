#!/usr/bin/env bash
# Read-only: why is the load ~5 with no busy process? Look for hidden processes / kernel rootkit.
echo "== loadavg / vmstat"; cat /proc/loadavg; vmstat 1 5 | sed 's/^/   /'
echo "== Procese ne gjendje R/D (ps)"; ps -eo pid,stat,pcpu,wchan:20,comm | awk 'NR==1 || $2 ~ /^(R|D)/' | head -20 | sed 's/^/   /'
echo "== CPU sipas procesit (top -b, 1 cikel)"; COLUMNS=200 /usr/bin/top -b -n 2 -d 2 | tail -n +7 | sed -n '/PID/,+12p' | tail -13 | sed 's/^/   /'
echo "== Procese te fshehura (kill -0 vs /proc)"
max=$(cat /proc/sys/kernel/pid_max); [ "$max" -gt 4194304 ] && max=4194304
cur=$(cat /proc/loadavg | awk -F/ '{print $2}' | awk '{print $NF}')
hidden=0; last=$(awk '{print $5}' /proc/loadavg)
for pid in $(seq 1 $((last+50))); do
  if kill -0 $pid 2>/dev/null && [ ! -d /proc/$pid ]; then hidden=$((hidden+1)); [ $hidden -le 10 ] && echo "   I FSHEHUR: pid $pid"; fi
done
echo "   gjithsej te fshehur: $hidden"
echo "== Modulet e kernelit (jo-standarde)"; lsmod | awk 'NR>1{print $1}' | while read m; do f=$(modinfo -n $m 2>/dev/null); case "$f" in /lib/modules/*/kernel/*|"(builtin)") ;; *) echo "   $m -> ${f:-pa skedar}";; esac; done
echo "   taint: $(cat /proc/sys/kernel/tainted)"
echo "== dmesg (gabime/module)"; dmesg 2>/dev/null | grep -iE "module|taint|out of memory|hung task|blocked for" | tail -10 | sed 's/^/   /'
echo "== Kush perdor CPU sipas cgroup (systemd)"; systemd-cgtop -b -n 2 -d 2 --order=cpu 2>/dev/null | tail -12 | sed 's/^/   /'
echo "== Rrjeti: trafiku dales (5 s)"; r1=$(awk '/eth0|ens/ {print $10; exit}' /proc/net/dev); sleep 5; r2=$(awk '/eth0|ens/ {print $10; exit}' /proc/net/dev); echo "   dales: $(( (r2-r1)/5/1024 )) KB/s"
echo "== Perdoruesi momentscraper"; ls -ld /var/lib/momenti-scraper 2>/dev/null | sed 's/^/   /'; grep -rl "momentscraper\|momenti-scraper" /etc/systemd/system /etc/cron* 2>/dev/null | sed 's/^/   ref: /'
