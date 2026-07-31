import { spawn } from "node:child_process";
const commands = [[process.execPath,["server/cloud-server.mjs"]],[process.execPath,["node_modules/vite/bin/vite.js","--host","0.0.0.0","--port","5173"]]];
const children=commands.map(([command,args])=>spawn(command,args,{stdio:"inherit",shell:false}));
const stop=()=>{children.forEach(child=>child.kill());process.exit();};
process.on("SIGINT",stop); process.on("SIGTERM",stop);
