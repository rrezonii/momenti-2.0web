#!/usr/bin/env bash
# Read-only: who is hitting the server, which processes are orphaned, how nginx is set up.
L=/var/log/nginx/access.log
echo "== Top IP ne 30 min e fundit (nga 20000 rreshtat e fundit)"
tail -n 20000 $L | awk '{print $1}' | sort | uniq -c | sort -rn | head -12
IP=79.124.58.82
echo; echo "== $IP: kerkesa sipas ores (sot)"; grep "^$IP " $L | awk '{print substr($4,2,14)}' | uniq -c | tail -12
echo; echo "== $IP: user-agent"; grep "^$IP " $L | awk -F'"' '{print $6}' | sort | uniq -c | sort -rn | head -5
echo; echo "== $IP: faqet (top)"; grep "^$IP " $L | awk '{print $7}' | sed -E 's/\?.*//' | sort | uniq -c | sort -rn | head -12
echo; echo "== $IP: host-i"; grep "^$IP " $L | awk '{print $NF}' | sort | uniq -c | sort -rn | head -3
echo; echo "== Formati i log-ut (1 rresht)"; tail -n 1 $L | cut -c1-300
echo; echo "== Te gjitha proceset next/node"; ps -eo pid,ppid,etime,rss,args --sort=-rss | grep -E "next-server|next start|next dev|npm (start|run)" | grep -v grep | cut -c1-150
echo; echo "== Kush degjon ne portat 3000 dhe 3100"; ss -ltnp | grep -E ":3000|:3100"
echo; echo "== pm2 pid-et"; pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))console.log("   "+p.name+" pid "+p.pid)})'
echo; echo "== nginx: include conf.d? site-et"; grep -n "include" /etc/nginx/nginx.conf; ls /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
echo; echo "== limit_req ekzistues"; grep -rn "limit_req\|limit_conn" /etc/nginx/ 2>/dev/null | head
echo; echo "== server_name ne site-et"; grep -rn "server_name" /etc/nginx/sites-enabled/ | head -20
