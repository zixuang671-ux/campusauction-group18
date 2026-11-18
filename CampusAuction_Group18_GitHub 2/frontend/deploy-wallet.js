import {BrowserProvider, ContractFactory, Contract, formatEther, parseEther, JsonRpcProvider, FetchRequest, formatUnits} from './vendor/ethers.js';
const $=id=>document.getElementById(id);
const rpcRequest=new FetchRequest('https://ethereum-sepolia-rpc.publicnode.com');rpcRequest.timeout=20000;
const reads=new JsonRpcProvider(rpcRequest,11155111,{staticNetwork:true,cacheTimeout:0});
const chain=11155111;let provider,signer,address,state,key,busy=false;
const [NFT,AUCTION]=await Promise.all(['CampusSouvenirNFT','CampusAuction'].map(n=>fetch(`./build/${n}.json`).then(r=>r.json())));
const names=['部署 NFT','铸造 Token ID 0','部署拍卖合约','授权 NFT'];
function save(){localStorage.setItem(key,JSON.stringify(state));render();}
function render(){if(!state)return;$('state').textContent=JSON.stringify(state,null,2);$('step').textContent=state.step>=4?'部署已完成':`第 ${state.step+1} 步：${names[state.step]}`;$('step').disabled=!signer||busy||state.step>=4;$('connect').disabled=busy;$('download').disabled=busy||!state.auction;$('fresh').disabled=busy||state.step<4;$('reuse').disabled=busy||!!state.pending;if(state.step>=4){const cfg={chainId:chain,chainName:'Sepolia',auction:state.auction,nft:state.nft,tokenId:0};localStorage.setItem('campus-deployment-config',JSON.stringify(cfg));}}
async function check(){const accounts=await provider.send('eth_accounts',[]);if(Number(await provider.send('eth_chainId',[]))!==chain)throw Error('请先在 MetaMask 中切换到 Sepolia，再重新连接。');if(accounts[0]?.toLowerCase()!==address.toLowerCase())throw Error('钱包账户已变化，请重新连接。');}
$('connect').onclick=async()=>{try{$('error').textContent='';if(!window.ethereum)throw Error('当前浏览器未检测到 MetaMask。请在安装了 MetaMask 的 Chrome 中打开这个网址。');provider=new BrowserProvider(window.ethereum,'any',{cacheTimeout:0});await provider.send('eth_requestAccounts',[]);signer=await provider.getSigner();address=await signer.getAddress();await check();key=`campus-sepolia-deploy-v1:${address.toLowerCase()}`;state=JSON.parse(localStorage.getItem(key)||'null')||{chainId:chain,seller:address,step:0,transactions:[]};$('wallet').textContent=`Sepolia · ${address}`;const bal=await reads.getBalance(address);$('balance').textContent=`余额：${formatEther(bal)} Sepolia ETH${bal===0n?'。请先领取测试 ETH，然后重新连接。':''}`;render();}catch(e){$('error').textContent=e.info?.error?.message||e.reason||e.shortMessage||e.message;}};
$('step').onclick=async()=>{if(busy||!state||state.step>=4)return;busy=true;render();try{$('error').textContent='';await check();if(await reads.getBalance(address)===0n)throw Error('钱包没有 Sepolia 测试 ETH，无法支付部署 Gas。请先从水龙头领取。');const step=state.step;
 if(!state.pending){
  const f=await reads.getFeeData();const fees=f.maxFeePerGas!==null&&f.maxPriorityFeePerGas!==null?{maxFeePerGas:f.maxFeePerGas,maxPriorityFeePerGas:f.maxPriorityFeePerGas}:f.gasPrice!==null?{gasPrice:f.gasPrice}:{};
  let draft;
  if(step===0)draft=await new ContractFactory(NFT.abi,NFT.bytecode).getDeployTransaction();
  if(step===1)draft=await new Contract(state.nft,NFT.abi).mint.populateTransaction(address);
  if(step===2)draft=await new ContractFactory(AUCTION.abi,AUCTION.bytecode).getDeployTransaction(state.nft,0,parseEther('0.01'),parseEther('0.001'),30,parseEther('0.002'),900);
  if(step===3)draft=await new Contract(state.nft,NFT.abi).approve.populateTransaction(state.auction,0);
  const estimate=await reads.estimateGas({...draft,...fees,from:address});const gasLimit=(estimate*120n+99n)/100n;
  const cap=f.maxFeePerGas??f.gasPrice;if(cap===null)throw Error('无法取得当前 Sepolia Gas 费率，请稍后重试。');
  if(gasLimit*cap>await reads.getBalance(address))throw Error('当前钱包测试币不足以支付估算 Gas 上限，请先补充 Sepolia ETH。');
  $('error').textContent=`Gas 已核对：估算 ${estimate}，最大费率 ${formatUnits(cap,'gwei')} Gwei，手续费上限约 ${formatEther(gasLimit*cap)} Sepolia ETH。请在 MetaMask 核对。`;
  await check();const tx=await signer.sendTransaction({...draft,...fees,gasLimit});
  state.pending={step,hash:tx.hash};save();
 }
 const hash=state.pending.hash;$('error').textContent='交易已提交，等待确认。请勿重复发送。';const receipt=await reads.waitForTransaction(hash,1,180000);
 if(!receipt)throw Error('等待确认超时，稍后再次点击以继续检查同一笔交易。');
 if(receipt.status!==1){state.transactions.push({...state.pending,failed:true});delete state.pending;save();throw Error('交易已回滚，请检查原因后重试。');}
 if(step===0){if(!receipt.contractAddress||await reads.getCode(receipt.contractAddress)==='0x')throw Error('NFT 部署地址验证失败。');state.nft=receipt.contractAddress;}
 if(step===1){const owner=await new Contract(state.nft,NFT.abi,reads).ownerOf(0,{blockTag:receipt.blockNumber});if(owner.toLowerCase()!==address.toLowerCase())throw Error('NFT 所有权验证失败。');}
 if(step===2){if(!receipt.contractAddress||await reads.getCode(receipt.contractAddress)==='0x')throw Error('拍卖部署地址验证失败。');state.auction=receipt.contractAddress;const a=new Contract(state.auction,AUCTION.abi,reads);state.auctionConstructorArguments=[state.nft,'0',parseEther('0.01').toString(),parseEther('0.001').toString(),'30',parseEther('0.002').toString(),'900'];if((await a.seller()).toLowerCase()!==address.toLowerCase())throw Error('卖方地址验证失败。');}
 if(step===3){if((await new Contract(state.nft,NFT.abi,reads).getApproved(0,{blockTag:receipt.blockNumber})).toLowerCase()!==state.auction.toLowerCase())throw Error('NFT 授权验证失败。');}
 state.transactions.push({step,name:names[step],hash,blockNumber:receipt.blockNumber,url:`https://sepolia.etherscan.io/tx/${hash}`});delete state.pending;state.step++;save();$('error').textContent='链上确认成功。';
 }catch(e){$('error').textContent=e.code==='ACTION_REJECTED'?'已取消签名，可重新操作。':e.info?.error?.message||e.reason||e.shortMessage||e.message;}finally{busy=false;render();}};
$('download').onclick=()=>{const blob=new Blob([JSON.stringify({config:state.auction?{chainId:chain,chainName:'Sepolia',auction:state.auction,nft:state.nft,tokenId:0}:null,evidence:state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='campus-sepolia-deployment.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
window.ethereum?.on('accountsChanged',()=>{signer=undefined;$('step').disabled=true;$('error').textContent='钱包账户已变化，请重新连接。';});window.ethereum?.on('chainChanged',()=>location.reload());

$('fresh').onclick=()=>{if(busy||!state||state.step<4)return;localStorage.setItem(`campus-deployment-history:${Date.now()}`,JSON.stringify(state));state={chainId:chain,seller:address,step:0,transactions:[],createdAt:new Date().toISOString()};save();$('error').textContent='已新建部署记录。请按四步操作，每笔交易在钱包确认。旧拍卖记录已保留。';};
$('repairNetwork').onclick=async()=>{try{if(!window.ethereum)throw Error('请使用安装了 MetaMask 的 Chrome。');await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});$('error').textContent='已请求切换 Sepolia。若钱包仍提示无法连接，请在 MetaMask 的 Sepolia 网络设置中更换可用 RPC。';}catch(e){$('error').textContent=e.info?.error?.message||e.reason||e.shortMessage||e.message;}};

$('reuse').onclick=async()=>{if(busy||!signer||state?.pending)return;busy=true;render();try{await check();const nft='0xCcB4b454434D75F7EE5C9623DfbA52D374642978';const owner=await new Contract(nft,NFT.abi,reads).ownerOf(0);if(owner.toLowerCase()!==address.toLowerCase())throw Error('当前钱包不是已有 NFT #0 的持有者，无法复用。');localStorage.setItem(`campus-deployment-history:${Date.now()}`,JSON.stringify(state));state={chainId:chain,seller:address,nft,step:2,reusedNFT:true,transactions:[],createdAt:new Date().toISOString()};save();$('error').textContent='已确认已有 NFT #0 属于当前钱包。下一步只部署新的拍卖合约，随后重新授权 NFT。';}catch(e){$('error').textContent=e.info?.error?.message||e.reason||e.shortMessage||e.message;}finally{busy=false;render();}};
