interface IRoyaltyFeeSetter {
        function updateRoyaltyInfoForCollectionIfOwner(
        address collection,
        address setter,
        address receiver,
        uint256 fee
    ) external;
}