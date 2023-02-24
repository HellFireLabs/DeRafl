// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IRoyaltyFeeRegistry.sol";

/// @title DeRafl
/// @author 0xCappy
/// @notice This contract is used by DeRafl to hold raffles for any erc721 token
/// @dev Designed to be as trustless as possible.
/// There are no owner functions.
/// Chainlink VRF is used to determine a winning ticket of a raffle.
/// A refund for a raffle can be initiated 2 days after a raffles expiry date if not already released.
/// LooksRare royaltyFeeRegistry is used to determine royalty rates for collections.
/// Collection royalties are honoured with a max payout of 10%

contract DeRafl is VRFConsumerBaseV2, Ownable {

    // CONSTANTS
    /// @dev ERC721 interface
    bytes4 public constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    /// @dev ERC2981 interface
    bytes4 public constant INTERFACE_ID_ERC2981 = 0x2a55205a;
    /// @dev Maximum seconds a raffle can be active
    uint256 constant MAX_RAFFLE_DURATION_SECONDS = 2592000; //30 days
    /// @dev Minimum amount of Eth
    uint256 constant MIN_ETH = 0.1 ether;
    /// @dev Maximum royalty fee percentage (10%)
    uint256 constant FEE_DENOMINATOR = 10000;
    /// @dev Maximum royalty fee percentage (10%)
    uint256 constant MAX_ROYALTY_FEE_PERCENTAGE = 1000;
    /// @dev DeRafl protocol fee (5%)
    uint256 constant DERAFL_FEE_PERCENTAGE = 500;
    /// @dev DeRafl Chainlink Fee
    uint256 constant DERAFL_CHAINLINK_FEE = 0.005 ether;
    /// @dev Price per ticket
    uint256 constant TICKET_PRICE = 0.001 ether;

    // CHAINLINK
    uint64 subscriptionId;
    address vrfCoordinator;
    bytes32 keyHash = 0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15;
    uint32 callbackGasLimit = 40000;
    uint16 requestConfirmations = 3;
    uint32 numWords =  1;
    VRFCoordinatorV2Interface COORDINATOR;

    /// @dev Emitted when a raffle is created
    /// @param raffleId The id of the raffle created
    /// @param nftAddress The address of the NFT being raffled
    /// @param tokenId The tokenId of the NFT being raffled
    /// @param tickets Maximum amount of tickets to be sold
    /// @param expires The timestamp when the raffle expires
    event RaffleOpened(uint256 raffleId, address nftAddress, uint256 tokenId, uint256 tickets, uint256 expires);

    /// @dev Emitted when a raffle is closed
    /// @param raffleId The id of the raffle being closed
    event RaffleClosed(uint256 raffleId);

    /// @dev Emitted when a raffle is drawn and winning ticket determined
    /// @param raffleId The id of the raffle being drawn
    /// @param winningTicket The winning ticket of the raffle being drawn
    event RaffleDrawn(uint256 raffleId, uint256 winningTicket);

    /// @dev Emitted when a raffle is released
    /// @param raffleId The id of the raffle being released
    /// @param winner The address of the winning ticket holder
    /// @param royaltiesPaid Collection royalties paid in wei
    /// @param ethPaid Ethereum paid to the raffle owner in wei
    event RaffleReleased(uint256 raffleId, address winner, uint256 royaltiesPaid, uint256 ethPaid);

    /// @dev Emitted when a raffle has been changed to a refunded state
    /// @param raffleId The id of the raffle being refunded
    event RaffleRefunded(uint256 raffleId);

    /// @dev Emitted when tickets are purchased
    /// @param raffleId The raffle id of the tickets being purchased
    /// @param batchId The batch id of the ticket purchase
    /// @param purchaser The address of the account making the purchase
    /// @param ticketFrom The first ticket of the ticket batch
    /// @param ticketAmount The amount of tickets being purchased
    event TicketPurchased(uint256 raffleId, uint256 batchId, address purchaser, uint256 ticketFrom, uint256 ticketAmount);

    /// @dev Emitted when a refund has been placed
    /// @param raffleId The raffle id of the raffle being refunded
    /// @param refundee The account being issued a refund
    /// @param ethAmount The ethereum amount being refunded in wei
    event TicketRefunded(uint256 raffleId, address refundee, uint256 ethAmount);

    /// @dev Emitted when create raffle is toggled
    /// @param enabled next state of createEnabled
    event CreateEnabled(bool enabled);

    enum RaffleState {
        NONE,
        ACTIVE,
        CLOSED,
        REFUNDED,
        PENDING_DRAW,
        DRAWN,
        RELEASED
    }

    /// @dev Ticket Owner represents a participants total input in a raffle (sum of all ticket batches)
    struct TicketOwner {
        uint128 ticketsOwned;
        bool isRefunded;
    }

    /// @dev TicketBatch represents a batch of tickets purchased for a raffle
    struct TicketBatch {
        address owner;
        uint96 startTicket;
        uint96 endTicket;
    }

    struct Raffle {
        uint256 raffleId;
        RaffleState raffleState;
        address payable raffleOwner;
        address nftAddress;
        uint256 tokenId;
        uint256 ticketsAvailable;
        uint256 ticketsSold;
        uint256 batchIndex;
        uint256 expiryTimestamp;
        uint256 chainlinkRequestId;
        uint256 winningTicket;
        address winner;
        uint256 royaltyPercentage;
        address royaltyRecipient;
    }

    /// @dev LooksRare royaltyFeeRegistry
    IRoyaltyFeeRegistry royaltyFeeRegistry;
    /// @dev mapping of raffleId => raffle
    mapping(uint256 => Raffle) raffles;
    /// @dev maps a participants TOTAL tickets bought for a raffle
    mapping(uint256 => mapping(address => TicketOwner)) ticketOwners;
    /// @dev maps ticketBatches purchased for a raffle
    mapping(uint256 => mapping(uint256 => TicketBatch)) ticketBatches;
    /// @dev maps raffleId to a chainlink VRF request
    mapping(uint256 => uint256) chainlinkRequestIdMap;
    /// @dev incremented raffleId
    uint256 raffleNonce = 1;
    /// @dev address to collect protocol fee
    address payable deraflFeeCollector;
    /// @dev indicates if a raffle can be created
    bool createEnabled = false;
    
    constructor(
        uint64 _subscriptionId,
        address _vrfCoordinator,
        address royaltyFeeRegistryAddress,
        address feeCollector
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _subscriptionId;
        royaltyFeeRegistry = IRoyaltyFeeRegistry(royaltyFeeRegistryAddress);
        deraflFeeCollector = payable(feeCollector);
    }

    /// @notice DeRafl Returns information about a particular raffle
    /// @dev Returns the Raffle struct of the specified Id
    /// @param raffleId a parameter just like in doxygen (must be followed by parameter name)
    /// @return rafl the Raffle struct at the specified raffleId
    function getRaffle(uint256 raffleId) external view returns (Raffle memory rafl){
        return raffles[raffleId];
    }

    /// @notice DeRafl Returns an accounts particiaption for a raffle
    /// @dev TicketOwner contains the total amount of tickets bought for a raffle (sum of all ticket batches)
    /// and the refund status of a participant in the raffle
    /// @param raffleId The raffle Id of the raffle being queried
    /// @param ticketOwner The address of the participant being queried
    /// @return TicketOwner
    function getUserInfo(uint256 raffleId, address ticketOwner) external view returns(TicketOwner memory) {
        return ticketOwners[raffleId][ticketOwner];
    }

    /// @notice DeRafl Information about a specific TicketBatch for a raffle
    /// @dev Finds the TicketBatch for a specific raffle via the ticketBatches mapping
    /// @param raffleId The raffle Id of the TicketBatch being queried
    /// @param batchId The batchId for the TicketBatch being queried
    /// @return TicketBatch
    function getBatchInfo(uint256 raffleId, uint256 batchId) external view returns(TicketBatch memory) {
        return ticketBatches[raffleId][batchId];
    }

    /// @notice toggles the ability for users to create raffles
    function toggleCreateEnabled() external onlyOwner {
        createEnabled = !createEnabled;
        emit CreateEnabled(createEnabled);
    }

    /// @notice DeRafl Creates a new raffle
    /// @dev Creates a new raffle and adds it to the raffles mapping 
    /// @param nftAddress The address of the NFT being raffled
    /// @param tokenId The token id of the NFT being raffled
    /// @param expiryTimestamp How many days until the raffle expires
    /// @param ethInput The maximum amount of Eth to be raised for the raffle
    function createRaffle(address nftAddress, uint256 tokenId, uint256 expiryTimestamp, uint256 ethInput) external {
        require(createEnabled, "Create is not enabled");
        uint256 duration = expiryTimestamp - block.timestamp;
        require(expiryTimestamp > block.timestamp && duration <= MAX_RAFFLE_DURATION_SECONDS, "Invalid expiry timestamp");
        require((IERC165(nftAddress).supportsInterface(INTERFACE_ID_ERC721)), "NFTAddress must be ERC721");
        require(ethInput % TICKET_PRICE == 0, "Input must be divisible by ticket price");
        require(ethInput >= MIN_ETH, "Invalid eth");
        IERC721 nftContract = IERC721(nftAddress);
        Raffle storage raffle = raffles[raffleNonce];
        raffle.raffleState = RaffleState.ACTIVE;
        raffle.raffleId = raffleNonce;
        raffleNonce ++;
        raffle.raffleOwner = payable(msg.sender);
        raffle.nftAddress = nftAddress;
        raffle.tokenId = tokenId;
        raffle.ticketsAvailable = ethInput / TICKET_PRICE;
        raffle.expiryTimestamp = expiryTimestamp;

        // set royalty info at creation to avoid unexpected changes in royalties when raffle is closed
        (address royaltyRecipient, uint256 royaltyPercentage) = getRoyaltyInfo(nftAddress, tokenId);
        raffle.royaltyPercentage = royaltyPercentage;
        raffle.royaltyRecipient = royaltyRecipient;
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        emit RaffleOpened(raffle.raffleId, nftAddress, tokenId, raffle.ticketsAvailable, raffle.expiryTimestamp);
    }

    /// @notice DeRafl Purchase tickets for a raffle
    /// @dev Allows a user to purchase a ticket batch for a raffle.
    /// Validates the raffle state.
    /// Refunds extra Eth if overpayed, or if tickets remaining < tickets intended to purchase.
    /// Creates a new ticketBatch and adds to ticketBatches mapping.
    /// Increments ticketOwner in ticketOwners mapping.
    /// Update state of Raffle with specified raffleId.
    /// Emit TicketsPurchased event.
    /// @param raffleId The address of the NFT being raffled
    /// @param ticketAmount The amount of tickets to purchase
    function buyTickets(uint256 raffleId, uint256 ticketAmount) external payable {
        require(ticketAmount > 0, "Cannot purchase 0 tickets");
        Raffle storage raffle = raffles[raffleId];
        require(msg.sender != raffle.raffleOwner, "Owner cannot purchase tickets");
        require(raffle.raffleState == RaffleState.ACTIVE, "Invalid Raffle State");
        require(raffle.expiryTimestamp > block.timestamp, "Raffle has expired");
        uint256 ticketsRemaining = raffle.ticketsAvailable - raffle.ticketsSold;
        uint256 ticketsToPurchase = ticketsRemaining >= ticketAmount ? ticketAmount : ticketsRemaining;

        uint256 ethAmount = ticketsToPurchase * TICKET_PRICE;
        require(msg.value >= ethAmount, "Insufficient msg.value");

        // refund any extra eth in the event that someone has over paid
        // or they are purchasing REMAINING tickets as their order could not be completely fulfilled
        if (ethAmount < msg.value) {
            uint256 amountOver = msg.value - ethAmount;
            payable(msg.sender).transfer(amountOver);
        }

        // increment the total tickets bought for this raffle by this address
        TicketOwner storage ticketData = ticketOwners[raffleId][msg.sender];
        ticketData.ticketsOwned += uint128(ticketsToPurchase);

        uint256 batchId = raffle.batchIndex;
        // create a new batch purchase
        TicketBatch storage batch = ticketBatches[raffleId][batchId];
        batch.owner = msg.sender;
        batch.startTicket = uint96(raffle.ticketsSold + 1);
        batch.endTicket = uint96(raffle.ticketsSold + ticketsToPurchase);

        raffle.ticketsSold += ticketsToPurchase;
        raffle.batchIndex ++;

        if (raffle.ticketsSold == raffle.ticketsAvailable) {
            raffle.raffleState = RaffleState.CLOSED;
        }
        emit TicketPurchased(raffleId, batchId, msg.sender, batch.startTicket, ticketsToPurchase);
    }

    /// @notice DeRafl starts the drawing process for a raffle
    /// @dev Sends a request to chainlink VRF for a random number used to draw a winner.
    /// Validates raffleState is closed (sold out), or raffle is expired.
    /// Stores the chainlinkRequestId in chainlinkRequestIdMap against the raffleId.
    /// emits raffle closed event.
    /// @param raffleId The raffleId of the raffle being drawn
    function drawRaffle(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        require(raffle.raffleState == RaffleState.ACTIVE || raffle.raffleState == RaffleState.CLOSED, "Raffle is already closed");
        
        bool soldOut = raffle.ticketsSold == raffle.ticketsAvailable;
        bool isExpired = block.timestamp > raffle.expiryTimestamp;
        require(soldOut || isExpired, "A raffle must either be sold out or expired in order to be drawn");

        uint256 chainlinkRequestId = requestRandomNumber();
        chainlinkRequestIdMap[chainlinkRequestId] = raffleId;

        raffle.raffleState = RaffleState.PENDING_DRAW;
        raffle.chainlinkRequestId = chainlinkRequestId;
        emit RaffleClosed(raffleId);
    }

    /// @notice Completes a raffle, releases prize and accumulated Eth to relevant stake holders
    /// @dev Validates that the batch referenced includes the winning ticket. Releases 
    /// the nft and Ethereum
    /// @param raffleId The raffle Id of the raffle being released
    /// @param batchId The batch Id of the batch including the winning ticket
    function release(uint256 raffleId, uint256 batchId) external {
        Raffle storage raffle = raffles[raffleId];
        require(raffle.raffleState == RaffleState.DRAWN, "Invalid raffle state");

        TicketBatch storage batch = ticketBatches[raffleId][batchId];
        uint256 winningTicket = raffle.winningTicket;

        // confirm that the batch passed in includes the winning ticket
        require(winningTicket >= batch.startTicket && winningTicket <= batch.endTicket, "Batch is not the winner");
        address winner = batch.owner;

        // update state before making any transfers
        raffle.raffleState = RaffleState.RELEASED;

        // send the nft to the winner
        IERC721 nftContract = IERC721(raffle.nftAddress);
        nftContract.safeTransferFrom(address(this), winner, raffle.tokenId);
        raffle.winner = winner;

        // allocate and send the Eth
        uint256 ethRaised = raffle.ticketsSold * TICKET_PRICE;
        uint256 protocolEth = (ethRaised * DERAFL_FEE_PERCENTAGE / FEE_DENOMINATOR) + DERAFL_CHAINLINK_FEE;
        uint256 royaltyEth = raffle.royaltyPercentage == 0 ? 0 : (ethRaised * raffle.royaltyPercentage) / FEE_DENOMINATOR;
        uint256 ownerEth = ethRaised - protocolEth - royaltyEth;

        (bool feeCallSuccess,) = deraflFeeCollector.call{value: protocolEth}("");
        require(feeCallSuccess, "Failed to transfer derafl eth");

        (bool ownerCallSuccess,) = raffle.raffleOwner.call{value: ownerEth}("");
        require(ownerCallSuccess, "Failed to transfer owner eth");

        if (royaltyEth > 0) {
            (bool royaltyCallSuccess,) = payable(raffle.royaltyRecipient).call{value: royaltyEth}("");
            require(royaltyCallSuccess, "Failed to transfer royalty eth");
        }

        emit RaffleReleased(raffleId, winner, royaltyEth, ownerEth);
    }

    /// @dev Changes a raffles state to REFUNDED, allowing participants to be issued refunds.
    /// A raffle can be refunded 2 days after it has expired, and is not in a RELEASED state
    /// @param raffleId The raffle id of the raffle being refunded
    function refundRaffle(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        require(raffle.raffleState != RaffleState.RELEASED && raffle.raffleState != RaffleState.REFUNDED, "Invalid raffle state");
        require(block.timestamp > raffle.expiryTimestamp + 2 days, "Raffle must be closed for at least 2 days before being refunded");
        raffle.raffleState = RaffleState.REFUNDED;
        emit RaffleRefunded(raffleId);
    }

    /// @dev Issues a refund to an individual participant for all tickets purchased (sum of all ticket batches)
    /// @param raffleId The raffle id of the raffle being refunded
    function refundTickets(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        require(raffle.raffleState == RaffleState.REFUNDED, "Raffle is not refunded");
        TicketOwner storage ticketData = ticketOwners[raffleId][msg.sender];
        require(!ticketData.isRefunded, "Tickets are already refunded");

        // update refunded before sending any eth
        ticketData.isRefunded = true;
        uint256 refundAmount = ticketData.ticketsOwned * TICKET_PRICE;
        (bool success,) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Failed to transfer refund eth");
        emit TicketRefunded(raffleId, msg.sender, refundAmount);
    }

    /// @dev Returns the NFT of a refunded raffle to the raffle owner
    /// @param raffleId The raffle id of the raffle
    function claimRefundedNft(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        require(raffle.raffleState == RaffleState.REFUNDED, "Invalid raffle state");
        IERC721 nftContract = IERC721(raffle.nftAddress);
        require(nftContract.ownerOf(raffle.tokenId) == address(this), "NFT is not held by raffle contract");
        nftContract.safeTransferFrom(address(this), raffle.raffleOwner, raffle.tokenId);
    }

    /// @notice Gets the royalty fee percentage of an nft. Returns a maximum of 10%
    /// @dev checks for erc2981 as a priority for royalties, followed by looksrare royaltyFeeRegistry
    /// @dev maximum 10% royalties
    /// @param nftAddress The address of the token being queried
    function getRoyaltyInfo(address nftAddress, uint256 tokenId) public view returns(address feeReceiver, uint256 royaltyFee) {
        (bool isErc2981) = IERC165(nftAddress).supportsInterface(INTERFACE_ID_ERC2981);
        if (isErc2981) {
            (bool status, bytes memory data) = nftAddress.staticcall(
                abi.encodeWithSelector(IERC2981.royaltyInfo.selector, tokenId, FEE_DENOMINATOR)
            );
            if (status) {
                (feeReceiver, royaltyFee) = abi.decode(data, (address, uint256));
            }
        } else {
            try royaltyFeeRegistry.royaltyFeeInfoCollection(nftAddress) returns (address, address _feeReceiver, uint256 _royaltyFee) {
                feeReceiver = _feeReceiver;
                royaltyFee = _royaltyFee;
            } catch {
                return (address(0), 0);
            }
        }
        royaltyFee = royaltyFee > MAX_ROYALTY_FEE_PERCENTAGE ? MAX_ROYALTY_FEE_PERCENTAGE : royaltyFee;
        return(feeReceiver, royaltyFee);
    }

    /// @dev Requests a random number from chainlink VRF
    /// @return chainlinkRequestId of the request
    function requestRandomNumber() internal returns(uint256) {
        return COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
    }

    /// @notice DeRafl Callable by chainlink VRF to receive a random number
    /// @dev Generates a winning ticket number between 0 - tickets sold for a raffle
    /// @param requestId The chainlinkRequestId which maps to raffle id
    /// @param randomWords random words sent by chainlink
    function fulfillRandomWords(uint256 requestId , uint256[] memory randomWords) internal override {
        uint256 raffleId = chainlinkRequestIdMap[requestId];
        Raffle storage raffle = raffles[raffleId];
        uint256 winningTicket = (randomWords[0] % raffle.ticketsSold) + 1;
        raffle.winningTicket = winningTicket;
        raffle.raffleState = RaffleState.DRAWN;
        emit RaffleDrawn(raffleId, winningTicket);
    }
}
