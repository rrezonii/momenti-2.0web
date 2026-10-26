#!/usr/bin/env bash
# Read-only inspection of the Momenti deployment. Prints no secret values.
echo "== host"; hostname; uptime; node -v; npm -v; free -m; df -h / | tail -1
echo "== pm2"; pm2 list --no-color
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s)){const e=p.pm2_env||{};console.log(["APP",p.name,e.pm_cwd,e.pm_exec_path,JSON.stringify(e.args),"DIST="+((e.env&&e.env.NEXT_BUILD_DIST_DIR)||e.NEXT_BUILD_DIST_DIR||""),"PORT="+((e.env&&e.env.PORT)||e.PORT||"")].join(" | "))}})'
for d in $(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log([...new Set(JSON.parse(s).map(p=>p.pm2_env.pm_cwd))].join("\n"))})'); do
  echo "== dir $d"; ls -la "$d" | head -60
  [ -f "$d/package.json" ] && grep -E '"(name|build|start)"' "$d/package.json"
  [ -f "$d/.env.local" ] && { echo "-- env names:"; grep -oE '^[A-Z_]+=' "$d/.env.local"; }
  [ -f "$d/.env" ] && { echo "-- .env names:"; grep -oE '^[A-Z_]+=' "$d/.env"; }
  for b in .next .next-release; do [ -f "$d/$b/BUILD_ID" ] && echo "$b BUILD_ID $(cat $d/$b/BUILD_ID) $(stat -c %y $d/$b/BUILD_ID)"; done
  [ -d "$d/app/(sq)/kycu/api" ] && ls "$d/app/(sq)/kycu/api"
done
echo "== done"
