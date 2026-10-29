#!/usr/bin/env bash
# Read-only health check of the VPS (load, memory, disk, pm2 processes, response times). Changes nothing.
echo "== Koha e serverit"; date; timedatectl 2>/dev/null | grep -E "Time zone|synchronized" || true
echo; echo "== CPU / ngarkesa"; nproc; uptime
echo; echo "== Memoria"; free -m
echo; echo "== Disku"; df -h / | tail -1
echo; echo "== pm2"; pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s)){const m=p.monit||{};console.log(`${p.name.padEnd(16)} ${String(p.pm2_env.status).padEnd(8)} cpu ${String(m.cpu).padStart(4)}%  mem ${Math.round((m.memory||0)/1048576)} MB  restarts ${p.pm2_env.restart_time}  uptime ${Math.round((Date.now()-p.pm2_env.pm_uptime)/60000)} min`)}})'
echo; echo "== Proceset me te renda (CPU)"; ps -eo pid,pcpu,pmem,rss,etime,comm,args --sort=-pcpu | head -12 | cut -c1-160
echo; echo "== Proceset me te renda (memorie)"; ps -eo pid,pcpu,pmem,rss,comm --sort=-rss | head -8
echo; echo "== Koha e pergjigjes (5 here secila)"
echo "   (live u rinis para $(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="momenti");console.log(Math.round((Date.now()-p.pm2_env.pm_uptime)/60000))})') min)"
WP=$(grep -E '^WORDPRESS_URL=' /var/www/momenti/.env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
for url in "http://127.0.0.1:3000/sq" "http://127.0.0.1:3000/sq/lajme" "http://127.0.0.1:3000/sq/sport" "https://momenti.info/sq" "${WP:+$WP/wp-json/wp/v2/posts?per_page=10}"; do
  [ -n "$url" ] || continue
  for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{time_total}s %{http_code}\n" -H "Accept-Language: sq" "$url"; done | awk -v u="$url" '{t+=$1; c=$2} END { if (u ~ /wp-json/) u="WordPress API (posts)"; printf "   %-36s mesatarja %.2fs (kodi %s)\n", u, t/NR, c}'
done
echo; echo "== Swap / OOM ne 24 oret e fundit"; swapon --show 2>/dev/null; journalctl -k --since "24 hours ago" 2>/dev/null | grep -ci "out of memory" | sed 's/^/   OOM: /'
echo; echo "== Build-et e vjetra .next-* ne live"; ls -d /var/www/momenti/.next* 2>/dev/null | wc -l; du -sh /var/www/momenti/.next* 2>/dev/null | sort -h | tail -5
