# CampusAuction

Group 18 built a Dutch auction prototype for four Lingnan University digital souvenirs in CDS528. One ERC-721 contract supplies four token IDs. Each item has a separate CampusAuction instance and the same bilingual front end.

| Token ID | Souvenir | Starting price |
| --- | --- | --- |
| 0 | Red porcelain mug | 0.010 ETH |
| 1 | Woven bag C | 0.008 ETH |
| 2 | University pin | 0.006 ETH |
| 3 | Bookmark | 0.004 ETH |

The Sepolia price drops by 0.001 ETH every 30 seconds to a 0.002 ETH floor. Each auction runs for 900 seconds after the seller starts it. When a buyer purchases, the contract transfers the NFT, credits the seller and records excess payment for the buyer to withdraw. The seller can retrieve an unsold NFT after expiry.

## Install and test

Use Node.js 22.13 or later and npm. In the repository root, run:

```sh
npm ci
npm run compile
npm run test:four
npm run demo:local
```

Open the URL printed by the local launcher. Select a souvenir, use **Seller** to approve and start, then switch to **Buyer A** or **Buyer B** to purchase. Withdraw any excess as the buyer and the proceeds as the seller. The local chain uses disposable Hardhat accounts and a five-second price interval. The integration test covers concurrent auctions, isolated credits, settlement, expiry and permissions. Its output is separate from the earlier member unit-test run described in the report.

## Use the existing Sepolia deployment

Run `npm run frontend:sepolia` and open the URL printed by the script. Anyone can read the contracts. Transactions require MetaMask connected to Sepolia (chain ID 11155111) and test ETH. The seller approves and starts an available item. A buyer purchases with a separate funded test wallet. Completed auctions can be inspected with the same interface.

| Contract | Sepolia explorer |
| --- | --- |
| NFT collection | [CampusSouvenirNFT](https://sepolia.etherscan.io/address/0xCcB4b454434D75F7EE5C9623DfbA52D374642978) |
| Mug auction | [Token 0](https://sepolia.etherscan.io/address/0x06403756b56bec4aD972d4EAE32ad81CB2C25508) |
| Bag auction | [Token 1](https://sepolia.etherscan.io/address/0x2DbFd737b7203C7E750283e4df1Bd92892Ce2F42) |
| Pin auction | [Token 2](https://sepolia.etherscan.io/address/0x0AD92b4e79D0fA1153c3bd115cF670058745abBc) |
| Bookmark auction | [Token 3](https://sepolia.etherscan.io/address/0xB194b7bb6f3195B5DCb71f5C8C408060e5ef95b1) |

See [deployment records](deployment/sepolia-four-auctions.json) and [transaction evidence](evidence/). The 18 November snapshot records same-wallet purchases for the pin and bookmark, plus the bookmark withdrawal.

## Deploy with an independent test wallet

Compile the contracts before deploying. The included `npm run deploy:sepolia` is a single-item example. It reads `SEPOLIA_RPC_URL` and `PRIVATE_KEY` from environment variables. Use a dedicated funded Sepolia wallet and keep local credentials outside version control.

For a new four-item collection, deploy CampusSouvenirNFT and mint four tokens to the seller. Deploy CampusAuction four times with arguments in this order:

```text
NFT contract address, token ID, starting price, price drop, interval, minimum price, duration
```

Use prices in wei and times in seconds. Set the per-item starting prices from the table, a drop of 0.001 ETH, a 30-second interval, a minimum of 0.002 ETH and a 900-second duration. For each NFT, call `approve(auctionAddress, tokenId)` as its owner. Update the Sepolia collection in `frontend/collection.js` to use the new NFT contract, seller and auction addresses before loading the front end. The historical `deploy-four.html` helper is configured for Group 18's original collection.

## Source and attribution

- `contracts/` contains the auction and ERC-721 collection. The Solidity files declare the MIT license and use [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts).
- `scripts/` contains the Hardhat deployment example, local launcher and integration checks.
- `frontend/` contains the bilingual app and an [ethers.js license notice](frontend/vendor/ethers-LICENSE.md). [Souvenir photographs](frontend/assets/SOURCES.md) are credited to Lingnan University and retain their original copyright.
- AI assistance contributed to integration, front-end refinement and documentation. The contracts are intended for educational testnet use.

A token represents a digital test item. The auction does not include delivery of a physical souvenir.
