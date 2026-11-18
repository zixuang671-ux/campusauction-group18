// Local, disposable Hardhat accounts only. Never loads .env or wallet secrets.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {randomUUID}=require('node:crypto');
const {JsonRpcProvider}=require('ethers');
const {deployLocalCollection}=require('./collection.cjs');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'frontend');
const children=[];let server,provider,stopping=false;
function stop(){if(stopping)return;stopping=true;server?.close();provider?.destroy();for(const c of children)c.kill('SIGTERM');setTimeout(()=>process.exit(),250);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function rpcReady(){try{const p=new JsonRpcProvider('http://127.0.0.1:8545',undefined,{cacheTimeout:0});try{const id=await p.send('eth_chainId',[]);if(id!=='0x7a69')throw Error('Port 8545 is not the local chain (31337). Stop that service first.');return true;}finally{p.destroy();}}catch(e){if(e.message.includes('not the local'))throw e;return false;}}
async function main(){
 process.chdir(root);
 if(!await rpcReady()){
  fs.mkdirSync(path.join(root,'logs'),{recursive:true});
  const log=fs.openSync(path.join(root,'logs/local-chain.log'),'w');
  const cli=path.join(root,'node_modules/hardhat/dist/src/cli.js');
  const child=spawn(process.execPath,[cli,'node','--network','hardhat','--hostname','127.0.0.1'],{cwd:root,stdio:['ignore',log,log]});children.push(child);
  console.log('Starting local blockchain…');
  let ready=false;for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,500));if(child.exitCode!==null)throw Error('Chain failed. See logs/local-chain.log');if(await rpcReady()){ready=true;break;}}
  if(!ready)throw Error('Local chain did not start. See logs/local-chain.log');
 }else console.log('Using existing local chain on 127.0.0.1:8545.');
 provider=new JsonRpcProvider('http://127.0.0.1:8545',31337,{cacheTimeout:0});
 const deployment=await deployLocalCollection(provider);
 fs.writeFileSync(path.join(web,'local-deployment.json'),JSON.stringify(deployment,null,2)+'\n');
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{
  let file;try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=path.resolve(web,'.'+(name==='/'?'/index.html':name));}catch{res.writeHead(400);return res.end();}
  if(!file.startsWith(web+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
 });
 server.on('error',e=>{console.error('Web server:',e.message);stop();process.exitCode=1;});
 const port=Number(process.env.CAMPUS_WEB_PORT||5188);
 server.listen(port,'127.0.0.1',()=>console.log(`\nOPEN: http://127.0.0.1:${port}/index.html?mode=local\n4 independent NFTs / 4 auctions. Local blockchain only. No MetaMask required. Keep this terminal open. Ctrl+C to stop.\n`));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;stop();});
