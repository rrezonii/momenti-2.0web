#!/usr/bin/env bash
# Read-only server health report for momenti. Changes nothing.
exec > >(tee /tmp/momenti-health.log) 2>&1
echo "== Serveri: $(hostname) · $(uptime -p) · $(date '+%Y-%m-%d %H:%M')"
echo "   CPU: $(nproc) bërthama · load (1/5/15 min): $(cut -d' ' -f1-3 /proc/loadavg)"
echo "== Disku"; df -h / | tail -1 | awk '{print "   Gjithsej "$2" · i zënë "$3" ("$5") · i lirë "$4}'
echo "== Memoria"; free -m | awk 'NR==2{printf "   RAM %d MB · përdorur %d MB · e lirë/available %d MB\n",$2,$3,$7} NR==3{printf "   Swap %d MB (përdorur %d MB)\n",$2,$3}'
echo "== Folderat më të mëdhenj"
du -xsh /var/www/* 2>/dev/null | sort -rh | head -8 | sed 's/^/   /'
echo "   --- brenda /var/www/momenti:"
du -sh /var/www/momenti/{node_modules,.venv-argos,data,public} /var/www/momenti/.next* 2>/dev/null | sort -rh | head -25 | sed 's/^/   /'
echo "   build-e .next gjithsej: $(du -sch /var/www/momenti/.next* 2>/dev/null | tail -1 | cut -f1) në $(ls -d /var/www/momenti/.next* | wc -l) foldera"
echo "   --- të tjera:"
du -sh /var/backups /var/log /root/.pm2/logs /var/lib/mysql /var/lib/redis /root/.npm /root/.cache /tmp 2>/dev/null | sort -rh | sed 's/^/   /'
echo "   journal: $(journalctl --disk-usage 2>/dev/null | grep -o '[0-9.]*[KMG]B\?' | head -1)"
echo "== Proceset që marrin më shumë CPU"
ps -eo pid,pcpu,pmem,rss,etime,comm --sort=-pcpu | head -8 | awk 'NR==1{print "   PID   CPU% MEM%  RAM(MB) KOHA        PROGRAMI";next}{printf "   %-5s %-4s %-4s %-8d %-11s %s\n",$1,$2,$3,$4/1024,$5,$6}'
echo "== Proceset që marrin më shumë RAM"
ps -eo pid,pmem,rss,comm --sort=-rss | head -8 | awk 'NR>1{printf "   %-6s %5s%%  %6d MB  %s\n",$1,$2,$3/1024,$4}'
echo "== PM2 (site-i)"
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s)){const e=p.pm2_env;console.log(`   ${p.name}: ${e.status} · rinisje: ${e.restart_time} · RAM ${Math.round((p.monit.memory||0)/1048576)} MB · CPU ${p.monit.cpu}% · online prej ${Math.round((Date.now()-e.pm_uptime)/60000)} min`)}})'
echo "   pm2 logs: $(du -sh /root/.pm2/logs 2>/dev/null | cut -f1)"
echo "   Gabimet e fundit në log (24 orët e fundit, të përmbledhura):"
find /root/.pm2/logs -name '*error*' -mmin -1440 -exec tail -n 400 {} + 2>/dev/null | grep -v '^\s*$' | sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.Z+-]+//; s/[0-9a-f]{8,}/X/g' | cut -c1-140 | sort | uniq -c | sort -rn | head -10 | sed 's/^/   /'
echo "== Shërbimet"
for s in nginx mysql mariadb redis-server php8.3-fpm php8.2-fpm php8.1-fpm; do systemctl is-active --quiet $s 2>/dev/null && echo "   $s: aktiv · RAM $(systemctl show -p MemoryCurrent --value $s 2>/dev/null | awk '{printf "%d MB",$1/1048576}')"; done
echo "   Shërbime që kanë dështuar: $(systemctl --failed --no-legend 2>/dev/null | wc -l)"
echo "== Koha e përgjigjes së site-it (nga vetë serveri)"
for u in http://127.0.0.1:3000/sq http://127.0.0.1:3000/en http://127.0.0.1:3000/kycu; do
  curl -s -o /dev/null -w "   $u → %{http_code} në %{time_total}s\n" -H 'Accept-Language: sq' "$u"; done
echo "== Cron"; crontab -l 2>/dev/null | grep -v '^#' | sed 's/^/   /'
echo "== Mbaroi"
