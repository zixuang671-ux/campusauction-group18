// Static frontend only. No local chain and no wallet keys.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const web=path.resolve(__dirname,'../frontend'),port=Number(process.env.CAMPUS_FRONTEND_PORT||5194);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let file;try{file=path.resolve(web,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));}catch{res.writeHead(400);return res.end();}if(!file.startsWith(web+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);});});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Sepolia frontend: http://127.0.0.1:${port}/index.html\nFour-item setup: http://127.0.0.1:${port}/deploy-four.html\nUse Chrome with MetaMask. Keep this terminal open.`));
process.on('SIGINT',()=>server.close(()=>process.exit()));process.on('SIGTERM',()=>server.close(()=>process.exit()));
