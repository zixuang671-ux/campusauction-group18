import {ethers} from './vendor/ethers.js';
import {ITEMS,RULES,EXISTING_NFT,EXISTING_SELLER,defaultSepoliaCollection,validateCollection} from './collection.js';
import {themes} from './products.js';
const $=id=>document.getElementById(id),chain=11155111;
const q=new ethers.FetchRequest('https://ethereum-sepolia-rpc.publicnode.com');q.timeout=20000;
const reads=new ethers.JsonRpcProvider(q,chain,{staticNetwork:true,cacheTimeout:0});
const [N,A]=await Promise.all(['CampusSouvenirNFT','CampusAuction'].map(n=>fetch(`./build/${n}.json`).then(r=>r.json())));
const nft=new ethers.Contract(EXISTING_NFT,N.abi,reads);
let wallet,signer,address,state,key,busy=false,nextAction;
const name=a=>a?`${themes[a.id].name[1]} / NFT #${a.tokenId}：${{mint:'铸造 NFT',deploy:'部署独立拍卖',approve:'授权此 NFT'}[a.type]}`:'四场拍卖已准备完成';
function stored(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}}
function error(e){return e.info?.error?.message||e.reason||e.shortMessage||e.message;}
function status(msg){$('error').textContent=msg;}
function render(){
 $('connect').disabled=busy;$('step').disabled=busy||!signer||(!state?.pending&&!nextAction);$('step').textContent=state?.pending?'检查已提交交易（不重复发送）':signer?name(nextAction):'先连接卖方钱包';$('download').disabled=busy||!state;
 $('state').textContent=state?JSON.stringify(state,null,2):'等待连接…';
 for(const item of ITEMS){const el=$(`row-${item.id}`),info=state?.collection.items.find(x=>x.id===item.id);el.textContent=`NFT #${item.tokenId} · ${themes[item.id].name[1]} · 起拍 ${item.startPrice} ETH · ${state?(info?.address||'尚未部署'):'待连接后核对'}`;}
}
function save(){localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('campus-four-sepolia',JSON.stringify(state.collection));render();}
async function checkWallet(){if(Number(await wallet.send('eth_chainId',[]))!==chain)throw Error('请切换到 Sepolia。');const accounts=await wallet.send('eth_accounts',[]);if(accounts[0]?.toLowerCase()!==address?.toLowerCase())throw Error('账户已变化，请重新连接。');if(address.toLowerCase()!==EXISTING_SELLER.toLowerCase()||(await nft.owner()).toLowerCase()!==address.toLowerCase())throw Error('请使用现有 NFT 合约管理员钱包 0x59a6…8651。');}
async function tokenOwner(id,blockTag='latest'){try{return await nft.ownerOf(id,{blockTag});}catch(e){let parsed;try{parsed=nft.interface.parseError(e.data)}catch{}if(parsed?.name==='ERC721NonexistentToken')return null;throw e;}}
async function verifyAuction(item,at={}){const a=new ethers.Contract(item.address,A.abi,reads);const keys=['seller','nftContract','tokenId','startPrice','minPrice','priceDropStep','priceDropInterval','duration'];const v=await Promise.all(keys.map(k=>a[k](at)));if(v[0].toLowerCase()!==EXISTING_SELLER.toLowerCase()||v[1].toLowerCase()!==EXISTING_NFT.toLowerCase()||Number(v[2])!==item.tokenId||v[3]!==ethers.parseEther(item.startPrice)||v[4]!==ethers.parseEther(item.minPrice)||v[5]!==ethers.parseEther(RULES.drop)||Number(v[6])!==30||Number(v[7])!==900)throw Error(`NFT #${item.tokenId} 的拍卖参数不匹配，已停止。`);return a;}
async function determineNext(){
 const block=Math.max(await reads.getBlockNumber(),state.confirmedBlock||0),at={blockTag:block};
 for(const item of state.collection.items){
  const owner=await tokenOwner(item.tokenId,block);
  if(!owner)return {type:'mint',id:item.id,tokenId:item.tokenId};
  if(!item.address){if(owner.toLowerCase()!==address.toLowerCase())throw Error(`NFT #${item.tokenId} 不在当前卖方钱包，无法部署拍卖。`);return {type:'deploy',id:item.id,tokenId:item.tokenId};}
  const a=await verifyAuction(item,at);const st=Number(await a.status(at));
  if(st===0&&(await nft.getApproved(item.tokenId,at)).toLowerCase()!==item.address.toLowerCase()){if(owner.toLowerCase()!==address.toLowerCase())throw Error('待授权的 NFT 不在卖方钱包。');return {type:'approve',id:item.id,tokenId:item.tokenId};}
 }
 return null;
}
async function connect(){if(busy)return;busy=true;render();try{if(!window.ethereum)throw Error('请用安装了 MetaMask 的 Chrome 打开本页。');wallet=new ethers.BrowserProvider(window.ethereum,'any',{cacheTimeout:0});await wallet.send('eth_requestAccounts',[]);signer=await wallet.getSigner();address=await signer.getAddress();await checkWallet();key=`campus-setup-four-v2:${address.toLowerCase()}`;state=stored(key)||{schemaVersion:2,collection:defaultSepoliaCollection(),transactions:[],createdAt:new Date().toISOString()};state.collection=validateCollection(state.collection,chain);await verifyAuction(state.collection.items[0]);nextAction=state.pending?.action||await determineNext();$('wallet').textContent=`Sepolia · ${address} · 余额 ${ethers.formatEther(await reads.getBalance(address))} ETH`;save();status(state.pending?'检测到已提交交易，请先检查同一笔交易。':nextAction?'已复用现有 NFT 合约和红瓷杯拍卖。下一步会处理所显示的那件物品。':'四场拍卖的合约和授权均已核对。');}catch(e){signer=undefined;status(error(e));}finally{busy=false;render();}}
async function step(){if(busy||!state||!signer)return;busy=true;let continueQueue=false;render();try{await checkWallet();
 if(!state.pending){nextAction=await determineNext();if(!nextAction){status('四场拍卖均已就绪。');return;}const action={...nextAction};const item=state.collection.items.find(x=>x.id===action.id);let draft;
  if(action.type==='mint')draft=await nft.mint.populateTransaction(address);
  if(action.type==='deploy')draft=await new ethers.ContractFactory(A.abi,A.bytecode).getDeployTransaction(EXISTING_NFT,item.tokenId,ethers.parseEther(item.startPrice),ethers.parseEther(RULES.drop),30,ethers.parseEther(item.minPrice),900);
  if(action.type==='approve'){await verifyAuction(item);draft=await nft.approve.populateTransaction(item.address,item.tokenId);}
  const fee=await reads.getFeeData(),fees=fee.maxFeePerGas!==null&&fee.maxPriorityFeePerGas!==null?{maxFeePerGas:fee.maxFeePerGas,maxPriorityFeePerGas:fee.maxPriorityFeePerGas}:{gasPrice:fee.gasPrice};const gas=await reads.estimateGas({...draft,...fees,from:address}),limit=(gas*120n+99n)/100n,cap=fee.maxFeePerGas??fee.gasPrice;if(cap===null||limit*cap>await reads.getBalance(address))throw Error('无法估算费用或 Sepolia 测试币余额不足。');status(`${name(action)}。手续费上限 ${ethers.formatEther(limit*cap)} Sepolia ETH。请在 MetaMask 核对并亲自确认。`);await checkWallet();const tx=await signer.sendTransaction({...draft,...fees,chainId:chain,gasLimit:limit});state.pending={action,hash:tx.hash};save();
 }
 const pending=state.pending,item=state.collection.items.find(x=>x.id===pending.action.id);status(`等待 ${pending.hash} 确认；请勿重复发送。`);const receipt=await reads.waitForTransaction(pending.hash,1,180000);if(!receipt)throw Error('等待超时。再次点击只会检查同一笔交易，不会重新发送。');
 if(receipt.status!==1){state.transactions.push({...pending,failed:true,block:receipt.blockNumber});delete state.pending;save();throw Error('交易已回滚，请检查后重试。');}
 const at={blockTag:receipt.blockNumber};
 if(pending.action.type==='mint'){const minted=receipt.logs.flatMap(l=>{try{const e=nft.interface.parseLog(l);return e.name==='Transfer'&&e.args.from===ethers.ZeroAddress?[Number(e.args.tokenId)]:[];}catch{return [];}});if(minted.length!==1||minted[0]!==item.tokenId||(await tokenOwner(item.tokenId,receipt.blockNumber)).toLowerCase()!==address.toLowerCase())throw Error('铸造出的编号与计划不同，请停止并核对记录。');}
 if(pending.action.type==='deploy'){if(!receipt.contractAddress||await reads.getCode(receipt.contractAddress,receipt.blockNumber)==='0x')throw Error('部署地址检查失败。');const proposed={...item,address:receipt.contractAddress};await verifyAuction(proposed,at);item.address=receipt.contractAddress;}
 if(pending.action.type==='approve'&&(await nft.getApproved(item.tokenId,at)).toLowerCase()!==item.address.toLowerCase())throw Error('授权状态核对失败，请检查这笔已提交交易。');
 state.confirmedBlock=Math.max(state.confirmedBlock||0,receipt.blockNumber);state.transactions.push({...pending,block:receipt.blockNumber,url:`https://sepolia.etherscan.io/tx/${pending.hash}`});delete state.pending;save();nextAction=await determineNext();continueQueue=!!nextAction;save();status(nextAction?`上一笔已确认。下一步：${name(nextAction)}`:'四场拍卖均已部署并授权。保持未启动，等现场准备好后分别启动。');
 }catch(e){status(e.code==='ACTION_REJECTED'?'已取消签名，没有发送新交易。':error(e));}finally{busy=false;render();if(continueQueue&&$('autoNext').checked)setTimeout(()=>step(),1000);}}
$('connect').onclick=connect;$('step').onclick=step;$('download').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='campus-sepolia-four-collection.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
window.ethereum?.on('accountsChanged',()=>{signer=undefined;render();status('钱包账户已变化，请重新连接。');});window.ethereum?.on('chainChanged',()=>location.reload());render();
