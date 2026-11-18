// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CampusAuction
 * @notice 校园数字纪念品降价拍卖（荷兰拍卖）核心合约
 */
contract CampusAuction is IERC721Receiver, ReentrancyGuard {
    enum AuctionStatus { Pending, Active, Finalized, Cancelled }

    address public immutable seller;
    IERC721 public immutable nftContract;
    uint256 public immutable tokenId;

    uint256 public immutable startPrice;
    uint256 public immutable priceDropStep;
    uint256 public immutable priceDropInterval;
    uint256 public immutable minPrice;
    uint256 public immutable duration;

    uint256 public startTime;
    uint256 public endTime;
    AuctionStatus public status;

    address public winner;
    uint256 public finalPrice;

    mapping(address => uint256) public pendingWithdrawals;

    event AuctionStarted(uint256 startTime, uint256 endTime);
    event AuctionSuccessful(address indexed buyer, uint256 price);
    event AuctionEndedUnsold();
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    modifier onlySeller() {
        require(msg.sender == seller, "CampusAuction: Caller is not the seller");
        _;
    }

    constructor(
        address _nftContract,
        uint256 _tokenId,
        uint256 _startPrice,
        uint256 _priceDropStep,
        uint256 _priceDropInterval,
        uint256 _minPrice,
        uint256 _duration
    ) {
        require(_nftContract != address(0), "CampusAuction: Invalid NFT address");
        require(_startPrice > _minPrice, "CampusAuction: Start price must be greater than min price");
        require(_priceDropInterval > 0, "CampusAuction: Interval must be > 0");
        require(_duration > 0, "CampusAuction: Duration must be > 0");

        seller = msg.sender;
        nftContract = IERC721(_nftContract);
        tokenId = _tokenId;

        startPrice = _startPrice;
        priceDropStep = _priceDropStep;
        priceDropInterval = _priceDropInterval;
        minPrice = _minPrice;
        duration = _duration;

        status = AuctionStatus.Pending;
    }

    function startAuction() external onlySeller {
        require(status == AuctionStatus.Pending, "CampusAuction: Auction already started");
        
        status = AuctionStatus.Active;
        startTime = block.timestamp;
        endTime = block.timestamp + duration;

        nftContract.safeTransferFrom(msg.sender, address(this), tokenId);

        emit AuctionStarted(startTime, endTime);
    }

    function getCurrentPrice() public view returns (uint256) {
        if (status != AuctionStatus.Active) {
            return startPrice;
        }
        if (block.timestamp >= endTime) {
            uint256 totalSteps = duration / priceDropInterval;
            uint256 totalDrop = totalSteps * priceDropStep;
            if (startPrice <= totalDrop + minPrice) {
                return minPrice;
            }
            return startPrice - totalDrop;
        }

        uint256 elapsedTime = block.timestamp - startTime;
        uint256 currentStep = elapsedTime / priceDropInterval;
        uint256 currentDrop = currentStep * priceDropStep;

        if (startPrice <= currentDrop + minPrice) {
            return minPrice;
        }

        uint256 calculatedPrice = startPrice - currentDrop;
        return calculatedPrice < minPrice ? minPrice : calculatedPrice;
    }

    function buy() external payable nonReentrant {
        require(status == AuctionStatus.Active, "CampusAuction: Auction not active");
        require(block.timestamp < endTime, "CampusAuction: Auction expired");

        uint256 currentPrice = getCurrentPrice();
        require(msg.value >= currentPrice, "CampusAuction: Insufficient payment");

        status = AuctionStatus.Finalized;
        winner = msg.sender;
        finalPrice = currentPrice;

        pendingWithdrawals[seller] += currentPrice;

        uint256 excess = msg.value - currentPrice;
        if (excess > 0) {
            pendingWithdrawals[msg.sender] += excess;
        }

        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        emit AuctionSuccessful(msg.sender, currentPrice);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "CampusAuction: No funds to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "CampusAuction: Transfer failed");

        emit FundsWithdrawn(msg.sender, amount);
    }

    function withdrawUnsoldNFT() external onlySeller nonReentrant {
        require(status == AuctionStatus.Active, "CampusAuction: Auction not active");
        require(block.timestamp >= endTime, "CampusAuction: Auction not yet expired");

        status = AuctionStatus.Cancelled;

        nftContract.safeTransferFrom(address(this), seller, tokenId);

        emit AuctionEndedUnsold();
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
