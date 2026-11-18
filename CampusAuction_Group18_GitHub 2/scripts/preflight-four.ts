import assert from 'node:assert/strict';
import {network} from 'hardhat';
import {ITEMS,RULES,validateCollection} from '../frontend/collection.js';
const {ethers}=await network.connect('hardhat');
const [seller,buyerA,buyerB]=await ethers.getSigners();
const nft=await ethers.deployContract('CampusSouvenirNFT');await nft.waitForDeployment();
for(const item of ITEMS){await(await nft.mint(seller.address)).wait();assert.equal(await nft.ownerOf(item.tokenId),seller.address);}
const auctions=[];
for(const item of ITEMS){const a=await ethers.deployContract('CampusAuction',[await nft.getAddress(),item.tokenId,ethers.parseEther(item.startPrice),ethers.parseEther(RULES.drop),5,ethers.parseEther(item.minPrice),900]);await a.waitForDeployment();assert.equal(await a.tokenId(),BigInt(item.tokenId));assert.equal(await a.startPrice(),ethers.parseEther(item.startPrice));auctions.push(a);}
const config={schemaVersion:2,chainId:31337,nftAddress:await nft.getAddress(),seller:seller.address,items:await Promise.all(ITEMS.map(async (x,i)=>({...x,address:await auctions[i].getAddress()})))};
validateCollection(config,31337);assert.equal(new Set(config.items.map(x=>x.address)).size,4);
assert.throws(()=>validateCollection({...config,items:config.items.map((x,i)=>i===1?{...x,address:config.items[0].address}:x)},31337));
assert.throws(()=>validateCollection({...config,items:config.items.map((x,i)=>i===1?{...x,tokenId:0}:x)},31337));
assert.throws(()=>validateCollection(config,11155111));
await assert.rejects(auctions[0].startAuction());assert.equal(await auctions[0].status(),0n);
for(let i=0;i<4;i++){const a=auctions[i];await(await nft.approve(await a.getAddress(),i)).wait();await assert.rejects(a.connect(buyerA).startAuction());await(await a.startAuction()).wait();assert.equal(await nft.ownerOf(i),await a.getAddress());}
await assert.rejects(auctions[0].connect(buyerA).buy({value:1n}));
for(let i=0;i<3;i++){
 const a=auctions[i],buyer=i%2?buyerB:buyerA;const paid=ethers.parseEther(ITEMS[i].startPrice)+ethers.parseEther('0.002');await(await a.connect(buyer).buy({value:paid})).wait();const final=await a.finalPrice();assert.equal(await nft.ownerOf(i),buyer.address);assert.equal(await a.winner(),buyer.address);assert.equal(await a.pendingWithdrawals(seller.address),final);assert.equal(await a.pendingWithdrawals(buyer.address),paid-final);
 for(let j=i+1;j<4;j++){assert.equal(await auctions[j].status(),1n);assert.equal(await nft.ownerOf(j),await auctions[j].getAddress());assert.equal(await auctions[j].pendingWithdrawals(buyer.address),0n);}
 await assert.rejects(a.connect(buyer).buy({value:paid}));await(await a.connect(buyer).withdraw()).wait();await(await a.withdraw()).wait();assert.equal(await a.pendingWithdrawals(seller.address),0n);assert.equal(await a.pendingWithdrawals(buyer.address),0n);assert.equal(await ethers.provider.getBalance(await a.getAddress()),0n);
}
const last=auctions[3],end=await last.endTime();await ethers.provider.send('evm_setNextBlockTimestamp',[Number(end)+1]);await ethers.provider.send('evm_mine',[]);assert.equal(await last.getCurrentPrice(),ethers.parseEther('0.002'));await assert.rejects(last.connect(buyerA).buy({value:ethers.parseEther('0.01')}));await assert.rejects(last.connect(buyerA).withdrawUnsoldNFT());await(await last.withdrawUnsoldNFT()).wait();assert.equal(await nft.ownerOf(3),seller.address);assert.equal(await last.status(),3n);
console.log('PASS: 4 unique NFTs, 4 unique auctions, 4 distinct start prices, independent concurrent states, isolated funds, buyer refunds and seller proceeds, expiry recovery, access controls and invalid-manifest rejection. Ephemeral local chain only.');
