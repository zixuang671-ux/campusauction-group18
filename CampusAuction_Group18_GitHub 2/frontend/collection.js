// One collection, four real NFTs, four independent CampusAuction instances.
export const ITEMS = Object.freeze([
 {id:'mug',tokenId:0,startPrice:'0.010',minPrice:'0.002'},
 {id:'bag',tokenId:1,startPrice:'0.008',minPrice:'0.002'},
 {id:'pin',tokenId:2,startPrice:'0.006',minPrice:'0.002'},
 {id:'bookmark',tokenId:3,startPrice:'0.004',minPrice:'0.002'},
]);
export const RULES = Object.freeze({drop:'0.001',localInterval:5,sepoliaInterval:30,duration:900});
export const EXISTING_NFT='0xCcB4b454434D75F7EE5C9623DfbA52D374642978';
export const EXISTING_SELLER='0x59a62E3DA22Ad9251fe4E0767E090Adc2B578651';
export const EXISTING_MUG_AUCTION='0x06403756b56bec4aD972d4EAE32ad81CB2C25508';
// Confirmed on Sepolia, 17 November 2026. Full receipts: deployment/sepolia-four-auctions.json.
export const SEPOLIA_AUCTIONS=Object.freeze({mug:EXISTING_MUG_AUCTION,bag:'0x2DbFd737b7203C7E750283e4df1Bd92892Ce2F42',pin:'0x0AD92b4e79D0fA1153c3bd115cF670058745abBc',bookmark:'0xB194b7bb6f3195B5DCb71f5C8C408060e5ef95b1'});
export function defaultSepoliaCollection(){return {schemaVersion:2,chainId:11155111,sessionId:'sepolia-four-v2',nftAddress:EXISTING_NFT,seller:EXISTING_SELLER,items:ITEMS.map(x=>({...x,address:SEPOLIA_AUCTIONS[x.id]})),parameters:{...RULES,intervalSeconds:30}};}
export function validateCollection(input,expectedChain){
 const cfg=input?.collection||input;
 const address=a=>typeof a==='string'&&/^0x[0-9a-fA-F]{40}$/.test(a)&&!/^0x0{40}$/i.test(a);
 if(!cfg||cfg.schemaVersion!==2||Number(cfg.chainId)!==expectedChain||!address(cfg.nftAddress)||!address(cfg.seller)||!Array.isArray(cfg.items)||cfg.items.length!==4)throw Error('Invalid four-auction collection configuration / 四拍品配置格式或网络不匹配。');
 if(expectedChain===11155111&&(cfg.nftAddress.toLowerCase()!==EXISTING_NFT.toLowerCase()||cfg.seller.toLowerCase()!==EXISTING_SELLER.toLowerCase()))throw Error('This Sepolia collection must reuse the existing NFT and seller / 此版本须复用现有 NFT 合约和卖方。');
 const used=new Set();const normalized=ITEMS.map(item=>{const matches=cfg.items.filter(x=>x.id===item.id);if(matches.length!==1||Number(matches[0].tokenId)!==item.tokenId)throw Error('The NFT IDs must be 0, 1, 2, 3 with one auction per item.');const a=matches[0].address||null;if(a&&(!address(a)||used.has(a.toLowerCase())))throw Error('Auction addresses must be valid and distinct.');if(a)used.add(a.toLowerCase());return {...item,address:a};});
 return {...cfg,chainId:expectedChain,items:normalized};
}
