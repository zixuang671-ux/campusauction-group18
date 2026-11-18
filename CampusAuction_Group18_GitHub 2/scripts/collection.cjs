const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const {randomUUID}=require('node:crypto');const {ContractFactory,parseEther}=require('ethers');
async function deployLocalCollection(provider){
 if(Number(await provider.send('eth_chainId',[]))!==31337)throw Error('Collection launcher is restricted to local chain 31337.');
 const web=path.resolve(__dirname,'../frontend');const {ITEMS,RULES}=await import(pathToFileURL(path.join(web,'collection.js')).href);
 const seller=await provider.getSigner(0);const address=await seller.getAddress();const load=n=>JSON.parse(fs.readFileSync(path.join(web,'build',n+'.json'),'utf8'));const N=load('CampusSouvenirNFT'),A=load('CampusAuction');
 const nft=await new ContractFactory(N.abi,N.bytecode,seller).deploy();await nft.waitForDeployment();
 for(const item of ITEMS){await(await nft.mint(address)).wait();if((await nft.ownerOf(item.tokenId)).toLowerCase()!==address.toLowerCase())throw Error('Minted NFT ID verification failed.');}
 const items=[];for(const item of ITEMS){const auction=await new ContractFactory(A.abi,A.bytecode,seller).deploy(await nft.getAddress(),item.tokenId,parseEther(item.startPrice),parseEther(RULES.drop),RULES.localInterval,parseEther(item.minPrice),RULES.duration);await auction.waitForDeployment();items.push({...item,address:await auction.getAddress()});}
 return {schemaVersion:2,sessionId:randomUUID(),chainId:31337,network:'Local Hardhat',nftAddress:await nft.getAddress(),seller:address,items,parameters:{...RULES,intervalSeconds:RULES.localInterval}};
}
module.exports={deployLocalCollection};
