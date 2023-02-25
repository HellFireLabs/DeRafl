// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

contract StructCreationTest {
    enum RaffleState {
        NONE,
        ACTIVE,
        CLOSED,
        REFUNDED,
        PENDING_DRAW,
        DRAWN,
        RELEASED
    }

    struct Raffle {
        address royaltyRecipient;
        uint96 winningTicket;
        address nftAddress;
        uint96 ticketsAvailable;
        address payable raffleOwner;
        uint96 ticketsSold;
        address winner;
        uint96 batchIndex;
        uint256 chainlinkRequestId;
        uint256 tokenId;
        uint64 royaltyPercentage;
        uint64 raffleId;
        RaffleState raffleState;
        uint64 expiryTimestamp;
    }

    mapping(uint64 => Raffle) raffles;

    constructor() {}

    function createRaffleStandardInitializer(
        address nftAddress,
        uint256 tokenId,
        uint64 expiryTimestamp,
        uint96 ethInput
    ) external {
        address royaltyRecipient = address(0);
        uint64 royaltyPercentage = 10;
        uint64 raffleNonce = 1;
        Raffle storage raffle = raffles[raffleNonce];
        raffle.raffleState = RaffleState.ACTIVE;
        raffle.raffleId = raffleNonce;
        raffle.raffleOwner = payable(msg.sender);
        raffle.nftAddress = nftAddress;
        raffle.tokenId = tokenId;
        raffle.ticketsAvailable = ethInput / 0.001 ether;
        raffle.expiryTimestamp = expiryTimestamp;
        raffle.royaltyPercentage = royaltyPercentage;
        raffle.royaltyRecipient = royaltyRecipient;
    }

    function createRaffleFunctionInitializer(
        address nftAddress,
        uint256 tokenId,
        uint64 expiryTimestamp,
        uint96 ethInput
    ) external {
        address royaltyRecipient = address(0);
        uint64 royaltyPercentage = 10;
        uint64 raffleNonce = 2;

        raffles[raffleNonce] = Raffle(
            royaltyRecipient,
            0,
            nftAddress,
            ethInput / 0.001 ether,
            payable(msg.sender),
            0,
            address(0),
            0,
            0,
            tokenId,
            royaltyPercentage,
            raffleNonce,
            RaffleState.ACTIVE,
            expiryTimestamp
        );
    }

    function createRaffleKeyValueInitializer(
        address nftAddress,
        uint256 tokenId,
        uint64 expiryTimestamp,
        uint96 ethInput
    ) external {
        address royaltyRecipient = address(0);
        uint64 royaltyPercentage = 10;
        uint64 raffleNonce = 3;
        raffles[raffleNonce] = Raffle({
            royaltyRecipient: royaltyRecipient,
            winningTicket: 0,
            nftAddress: nftAddress,
            ticketsAvailable: ethInput / 0.001 ether,
            raffleOwner: payable(msg.sender),
            ticketsSold: 0,
            winner: address(0),
            batchIndex: 0,
            chainlinkRequestId: 0,
            tokenId: tokenId,
            royaltyPercentage: royaltyPercentage,
            raffleId: raffleNonce,
            raffleState: RaffleState.ACTIVE,
            expiryTimestamp: expiryTimestamp
        });
    }
}
