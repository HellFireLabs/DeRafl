//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import "@openzeppelin/contracts/token/common/ERC2981.sol";

contract NFTWithRoyalites is
    ERC721,
    ERC2981
{
    uint256 nextTokenId;
    address royaltyFeeReceiver;

    constructor(string memory name_, string memory symbol_, address royaltyFeeReceiver_)
        ERC721(name_, symbol_)
    {
        royaltyFeeReceiver = royaltyFeeReceiver_;
        _setDefaultRoyalty(royaltyFeeReceiver, 100);
    }

    /// @inheritdoc	ERC165
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _feeDenominator() internal pure virtual override returns (uint96) {
        return 1000;
    }

    /// @notice Mint one token to `to`
    /// @param to the recipient of the token
    function mint(address to) external {
        uint256 tokenId = nextTokenId;
        _safeMint(to, tokenId, '');

        nextTokenId = tokenId + 1;
    }

    /// @notice Mint several tokens at once
    /// @param recipients an array of recipients for each token
    function mintBatch(address[] memory recipients) external {
        uint256 tokenId = nextTokenId;
        for (uint256 i; i < recipients.length; i++) {
            _safeMint(recipients[i], tokenId, '');
            tokenId++;
        }

        nextTokenId = tokenId;
    }
}
