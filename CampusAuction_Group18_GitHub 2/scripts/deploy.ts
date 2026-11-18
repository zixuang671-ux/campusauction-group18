import { network } from "hardhat";

async function main() {
  // Hardhat 3 way to get ethers
  const { ethers } = await network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // 1. Deploy NFT
  const NFT = await ethers.getContractFactory("CampusSouvenirNFT");
  const nft = await NFT.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("CampusSouvenirNFT deployed to:", nftAddress);

  // 2. Mint tokenId 0
  const mintTx = await nft.mint(deployer.address);
  await mintTx.wait();
  console.log("Minted tokenId 0 to:", deployer.address);

  // 3. Auction parameters
  const startPrice        = ethers.parseEther("0.01");
  const priceDropStep     = ethers.parseEther("0.001");
  const priceDropInterval = 30n;
  const minPrice          = ethers.parseEther("0.002");
  const duration          = 300n;

  // 4. Deploy Auction
  const Auction = await ethers.getContractFactory("CampusAuction");
  const auction = await Auction.deploy(
    nftAddress,
    0n,
    startPrice,
    priceDropStep,
    priceDropInterval,
    minPrice,
    duration
  );
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log("CampusAuction deployed to:", auctionAddress);

  // 5. Approve
  const approveTx = await nft.approve(auctionAddress, 0n);
  await approveTx.wait();
  console.log("Approved auction contract for tokenId 0");

  // Output CONFIG
  console.log("\n================================================");
  console.log("Copy the following into frontend/app.js CONFIG:");
  console.log("================================================");
  console.log(`
const CONFIG = {
  chainId: 11155111,
  chainName: "sepolia",
  auction: "${auctionAddress}",
  nft: "${nftAddress}",
  tokenId: 0,
};
  `);
  console.log("================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
