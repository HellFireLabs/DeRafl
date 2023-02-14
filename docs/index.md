# Solidity API

## DeRafl

This contract is used by DeRafl to hold raffles for any erc721 token

_Designed to be as trustless as possible.
There are no owner functions.
Chainlink VRF is used to determine a winning ticket of a raffle.
A refund for a raffle can be initiated 2 days after a raffles expiry date if not already released.
LooksRare royaltyFeeRegistry is used to determine royalty rates for collections.
Collection royalties are honoured with a max payout of 10%_

### INTERFACE_ID_ERC721

```solidity
bytes4 INTERFACE_ID_ERC721
```

_ERC721 interface_

### MIN_DAYS

```solidity
uint256 MIN_DAYS
```

_Minimum days a raffle can be active_

### MAX_DAYS

```solidity
uint256 MAX_DAYS
```

_Maximum days a raffle can be active_

### MIN_ETH

```solidity
uint256 MIN_ETH
```

_Minimum amount of Eth_

### MAX_ETH

```solidity
uint256 MAX_ETH
```

_Maximum amount of Eth_

### MAX_ROYALTY_FEE_PERCENTAGE

```solidity
uint256 MAX_ROYALTY_FEE_PERCENTAGE
```

_Maximum royalty fee percentage (10%)_

### DERAFL_FEE_PERCENTAGE

```solidity
uint256 DERAFL_FEE_PERCENTAGE
```

_DeRafl protocol fee (3%)_

### DERAFL_CHAINLINK_FEE

```solidity
uint256 DERAFL_CHAINLINK_FEE
```

_DeRafl Chainlink Fee_

### TICKET_PRICE

```solidity
uint256 TICKET_PRICE
```

_Price per ticket_

### subscriptionId

```solidity
uint64 subscriptionId
```

### vrfCoordinator

```solidity
address vrfCoordinator
```

### keyHash

```solidity
bytes32 keyHash
```

### callbackGasLimit

```solidity
uint32 callbackGasLimit
```

### requestConfirmations

```solidity
uint16 requestConfirmations
```

### numWords

```solidity
uint32 numWords
```

### COORDINATOR

```solidity
contract VRFCoordinatorV2Interface COORDINATOR
```

### RaffleOpened

```solidity
event RaffleOpened(uint256 raffleId, address nftAddress, uint256 tokenId, uint256 tickets, uint256 expires)
```

_Emitted when a raffle is created_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The id of the raffle created |
| nftAddress | address | The address of the NFT being raffled |
| tokenId | uint256 | The tokenId of the NFT being raffled |
| tickets | uint256 | Maximum amount of tickets to be sold |
| expires | uint256 | The timestamp when the raffle expires |

### RaffleClosed

```solidity
event RaffleClosed(uint256 raffleId)
```

_Emitted when a raffle is closed_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The id of the raffle being closed |

### RaffleDrawn

```solidity
event RaffleDrawn(uint256 raffleId, uint256 winningTicket)
```

_Emitted when a raffle is drawn and winning ticket determined_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The id of the raffle being drawn |
| winningTicket | uint256 | The winning ticket of the raffle being drawn |

### RaffleReleased

```solidity
event RaffleReleased(uint256 raffleId, address winner, uint256 royaltiesPaid, uint256 ethPaid)
```

_Emitted when a raffle is released_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The id of the raffle being released |
| winner | address | The address of the winning ticket holder |
| royaltiesPaid | uint256 | Collection royalties paid in wei |
| ethPaid | uint256 | Ethereum paid to the raffle owner in wei |

### RaffleRefunded

```solidity
event RaffleRefunded(uint256 raffleId)
```

_Emitted when a raffle has been changed to a refunded state_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The id of the raffle being refunded |

### TicketPurchased

```solidity
event TicketPurchased(uint256 raffleId, uint256 batchId, address purchaser, uint256 ticketFrom, uint256 ticketAmount)
```

_Emitted when tickets are purchased_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle id of the tickets being purchased |
| batchId | uint256 | The batch id of the ticket purchase |
| purchaser | address | The address of the account making the purchase |
| ticketFrom | uint256 | The first ticket of the ticket batch |
| ticketAmount | uint256 | The amount of tickets being purchased |

### TicketRefunded

```solidity
event TicketRefunded(uint256 raffleId, address refundee, uint256 ethAmount)
```

_Emitted when a refund has been placed_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle id of the raffle being refunded |
| refundee | address | The account being issued a refund |
| ethAmount | uint256 | The ethereum amount being refunded in wei |

### RaffleState

```solidity
enum RaffleState {
  NONE,
  ACTIVE,
  CLOSED,
  REFUNDED,
  PENDING_DRAW,
  DRAWN,
  RELEASED
}
```

### TicketOwner

```solidity
struct TicketOwner {
  uint256 ticketsOwned;
  bool isRefunded;
}
```

### TicketBatch

```solidity
struct TicketBatch {
  address owner;
  uint256 startTicket;
  uint256 endTicket;
}
```

### Raffle

```solidity
struct Raffle {
  uint256 raffleId;
  enum DeRafl.RaffleState raffleState;
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
```

### royaltyFeeRegistry

```solidity
contract IRoyaltyFeeRegistry royaltyFeeRegistry
```

_LooksRare royaltyFeeRegistry_

### raffles

```solidity
mapping(uint256 => struct DeRafl.Raffle) raffles
```

_mapping of raffleId => raffle_

### ticketOwners

```solidity
mapping(uint256 => mapping(address => struct DeRafl.TicketOwner)) ticketOwners
```

_maps a participants TOTAL tickets bought for a raffle_

### ticketBatches

```solidity
mapping(uint256 => mapping(uint256 => struct DeRafl.TicketBatch)) ticketBatches
```

_maps ticketBatches purchased for a raffle_

### chainlinkRequestIdMap

```solidity
mapping(uint256 => uint256) chainlinkRequestIdMap
```

_maps raffleId to a chainlink VRF request_

### raffleNonce

```solidity
uint256 raffleNonce
```

_incremented raffleId_

### deraflFeeCollector

```solidity
address payable deraflFeeCollector
```

_address to collect protocol fee_

### constructor

```solidity
constructor(uint64 _subscriptionId, address _vrfCoordinator, address royaltyFeeRegistryAddress, address feeCollector) public
```

### getRaffle

```solidity
function getRaffle(uint256 raffleId) external view returns (struct DeRafl.Raffle rafl)
```

DeRafl Returns information about a particular raffle

_Returns the Raffle struct of the specified Id_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | a parameter just like in doxygen (must be followed by parameter name) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| rafl | struct DeRafl.Raffle | the Raffle struct at the specified raffleId |

### getUserInfo

```solidity
function getUserInfo(uint256 raffleId, address ticketOwner) external view returns (struct DeRafl.TicketOwner)
```

DeRafl Returns an accounts particiaption for a raffle

_TicketOwner contains the total amount of tickets bought for a raffle (sum of all ticket batches)
and the refund status of a participant in the raffle_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle Id of the raffle being queried |
| ticketOwner | address | The address of the participant being queried |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct DeRafl.TicketOwner | TicketOwner |

### getBatchInfo

```solidity
function getBatchInfo(uint256 raffleId, uint256 batchId) external view returns (struct DeRafl.TicketBatch)
```

DeRafl Information about a specific TicketBatch for a raffle

_Finds the TicketBatch for a specific raffle via the ticketBatches mapping_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle Id of the TicketBatch being queried |
| batchId | uint256 | The batchId for the TicketBatch being queried |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct DeRafl.TicketBatch | TicketBatch |

### createRaffle

```solidity
function createRaffle(address nftAddress, uint256 tokenId, uint256 daysActive, uint256 ethInput) external
```

DeRafl Creates a new raffle

_Creates a new raffle and adds it to the raffles mapping_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| nftAddress | address | The address of the NFT being raffled |
| tokenId | uint256 | The token id of the NFT being raffled |
| daysActive | uint256 | How many days until the raffle expires |
| ethInput | uint256 | The maximum amount of Eth to be raised for the raffle |

### buyTickets

```solidity
function buyTickets(uint256 raffleId, uint256 ticketAmount) external payable
```

DeRafl Purchase tickets for a raffle

_Allows a user to purchase a ticket batch for a raffle.
Validates the raffle state.
Refunds extra Eth if overpayed, or if tickets remaining < tickets intended to purchase.
Creates a new ticketBatch and adds to ticketBatches mapping.
Increments ticketOwner in ticketOwners mapping.
Update state of Raffle with specified raffleId.
Emit TicketsPurchased event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The address of the NFT being raffled |
| ticketAmount | uint256 | The amount of tickets to purchase |

### drawRaffle

```solidity
function drawRaffle(uint256 raffleId) external
```

DeRafl starts the drawing process for a raffle

_Sends a request to chainlink VRF for a random number used to draw a winner.
Validates raffleState is closed (sold out), or raffle is expired.
Stores the chainlinkRequestId in chainlinkRequestIdMap against the raffleId.
emits raffle closed event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffleId of the raffle being drawn |

### release

```solidity
function release(uint256 raffleId, uint256 batchId) external
```

Completes a raffle, releases prize and accumulated Eth to relevant stake holders

_Validates that the batch referenced includes the winning ticket
Validates raffle state is drawn_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle Id of the raffle being released |
| batchId | uint256 | The batch Id of the batch including the winning ticket |

### refundRaffle

```solidity
function refundRaffle(uint256 raffleId) external
```

_Changes a raffles state to REFUNDED, allowing participants to be issued refunds.
A raffle can be refunded 2 days after it has expired, and is not in a RELEASED state_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle id of the raffle being refunded |

### refundTickets

```solidity
function refundTickets(uint256 raffleId) external
```

_Issues a refund to an individual participant for all tickets purchased (sum of all ticket batches)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle id of the raffle being refunded |

### claimRefundedNft

```solidity
function claimRefundedNft(uint256 raffleId) external
```

_Returns the NFT of a refunded raffle to the raffle owner_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| raffleId | uint256 | The raffle id of the raffle |

### getRoyaltyInfo

```solidity
function getRoyaltyInfo(address nftAddress) public view returns (address, uint256)
```

_Gets the royalty fee percentage of an nft. Returns a maximum of 10%_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| nftAddress | address | The address of the token being queried |

### requestRandomNumber

```solidity
function requestRandomNumber() internal returns (uint256)
```

_Requests a random number from chainlink VRF_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | chainlinkRequestId of the request |

### fulfillRandomWords

```solidity
function fulfillRandomWords(uint256 requestId, uint256[] randomWords) internal
```

DeRafl Callable by chainlink VRF to receive a random number

_Generates a winning ticket number between 0 - tickets sold for a raffle_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| requestId | uint256 | The chainlinkRequestId which maps to raffle id |
| randomWords | uint256[] | random words sent by chainlink |

### onERC721Received

```solidity
function onERC721Received(address, address, uint256, bytes) external pure returns (bytes4)
```

