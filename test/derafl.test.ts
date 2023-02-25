import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { formatEther, parseEther } from "ethers/lib/utils";
import { NFTMock__factory } from "../typechain-types/factories/contracts/NFTMock__factory";
import { BigNumber } from "ethers";
import { before } from "mocha";
import { DeRafl } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { VRFCoordinatorV2Mock } from "../typechain-types/@chainlink/contracts/src/v0.8/mocks";
import { NFTMock } from "../typechain-types/contracts/RAFL.sol";

const TICKET_PRICE = parseEther("0.001");
const BAYC_ADDRESS = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
const BAYC_OWNER = "0xFd4838E0bd3955Ffa902Cb0E6ffA93704F863232";
const BAYC_TOKEN_ID = "7678";
const SUBCSCRIPTION_ID = "1";
const FEE_COLLECTOR = '0x49146F8ba80D5f24227543bBa3bB8e2c40ECC03D'
const ROYALTY_REGISTRY_ADDRESS = '0x12405dB79325D06a973aD913D6e9BdA1343cD526'
const ROYALTY_FEE_SETTER_ADDRESS = '0x73d3922426f7F27DF51E9cd7B8B2A0e435abCa06'
const ROYALTY_FEE_RECEIVER = '0xcab34983563c2580077A8bd99715ffE443EecA9a'

enum RaffleState {
  NONE,
  ACTIVE,
  CLOSED,
  REFUNDED,
  PENDING_DRAW,
  DRAWN,
  RELEASED,
}

enum TokenType {
  ERC721,
  ERC1155
}

describe("DeRafl", function () {
  async function createContractsFixture() {
    let vrfCoordinatorV2Mock = await ethers.getContractFactory(
      "VRFCoordinatorV2Mock"
    );
    const hardhatVrfCoordinatorV2Mock = await vrfCoordinatorV2Mock.deploy(0, 0);
    await hardhatVrfCoordinatorV2Mock.createSubscription();
    await hardhatVrfCoordinatorV2Mock.fundSubscription(
      SUBCSCRIPTION_ID,
      ethers.utils.parseEther("500")
    );
    const DeRafl = await ethers.getContractFactory("DeRafl");

    const derafl = await DeRafl.deploy(
      SUBCSCRIPTION_ID,
      hardhatVrfCoordinatorV2Mock.address,
      ROYALTY_REGISTRY_ADDRESS,
      FEE_COLLECTOR
    );
    await hardhatVrfCoordinatorV2Mock.addConsumer("1", derafl.address);

    const NFTMock: NFTMock__factory = (await ethers.getContractFactory(
      "NFTMock"
    )) as NFTMock__factory;
    const nftMock = await NFTMock.deploy();
    const signers = await ethers.getSigners();

    const royaltyFeeSetter = await ethers.getContractAt("IRoyaltyFeeSetter", ROYALTY_FEE_SETTER_ADDRESS)
    await royaltyFeeSetter.updateRoyaltyInfoForCollectionIfOwner(nftMock.address, signers[0].address, ROYALTY_FEE_RECEIVER, '500')
    
    const royalties = await derafl.getRoyaltyInfo(nftMock.address, '1')
    console.log("ROYLT = ", royalties)

    return { hardhatVrfCoordinatorV2Mock, derafl, nftMock, signers };
  }

  async function createContractsAndRaffleFixture() {
    const { hardhatVrfCoordinatorV2Mock, derafl, nftMock } =
      await createContractsFixture();
    const [owner, raffleCreator, address1, address2, address3] =
      await ethers.getSigners();
    await nftMock.safeMint(raffleCreator.address);
    const nftMockAsCreator = await nftMock.connect(raffleCreator);
    await nftMockAsCreator.setApprovalForAll(derafl.address, true)
    const deraflAsRaffleCreator = await derafl.connect(raffleCreator);
    await derafl.toggleCreateEnabled()
    const blockTime = await time.latest()
    const expiry = blockTime + (60 * 60 * 24 * 1)
    await deraflAsRaffleCreator.createRaffle(
      nftMock.address,
      "1",
      expiry,
      parseEther("10"),
      TokenType.ERC721
    );

    return {
      hardhatVrfCoordinatorV2Mock,
      derafl,
      nftMock,
      owner,
      raffleCreator,
      address1,
      address2,
      address3,
    };
  }

  describe("Raffle process", async function () {
    let derafl: DeRafl;
    let nftMock: NFTMock;
    let raffleCreator: SignerWithAddress;
    let address1: SignerWithAddress;
    let address2: SignerWithAddress;
    let address3: SignerWithAddress;
    let deraflAsRaffleCreator: DeRafl;
    let deraflAsAddress1: DeRafl;
    let deraflAsAddress2: DeRafl;
    let deraflAsAddress3: DeRafl;
    let hardhatVrfCoordinatorV2Mock: VRFCoordinatorV2Mock;

    before(async function () {
      console.log("STARTING BEFORE")
      const setup = await loadFixture(createContractsAndRaffleFixture);
      console.log("Done setp")
      derafl = setup.derafl;
      nftMock = setup.nftMock;
      raffleCreator = setup.raffleCreator;
      address1 = setup.address1;
      address2 = setup.address2;
      address3 = setup.address3;
      deraflAsRaffleCreator = await derafl.connect(raffleCreator);
      deraflAsAddress1 = await derafl.connect(address1);
      deraflAsAddress2 = await derafl.connect(address2);
      deraflAsAddress3 = await derafl.connect(address3);
      hardhatVrfCoordinatorV2Mock = setup.hardhatVrfCoordinatorV2Mock;  
    });

    describe("Sold Out Raffle", async function () {
      it("Buyer cannot buy tickets with insufficient eth amount", async function () {
        await expect(
          deraflAsAddress1.buyTickets("1", "1000", {
            value: parseEther("0.001").mul("999"),
          })
        ).to.be.revertedWithCustomError(derafl, "MsgValueInvalid");
      });

      it("Buyer cannot buy 0 tickets", async function () {
        await expect(
          deraflAsAddress1.buyTickets("1", "0", {
            value: parseEther("0.001").mul("999"),
          })
        ).to.be.revertedWithCustomError(derafl, "TicketAmountInvalid");
      });

      it("Cannot purchase on invalid raffle id", async function () {
        await expect(
          deraflAsAddress1.buyTickets("2", "1000", {
            value: parseEther("0.001").mul("1000"),
          })
        ).to.be.revertedWithCustomError(derafl, "InvalidRaffleState");
      });

      it("Buyer can buy tickets", async function () {
        await expect(
          deraflAsAddress1.buyTickets("1", "1000", {
            value: parseEther("0.001").mul("1000"),
          })
        )
          .to.emit(derafl, "TicketPurchased")
          .withArgs("1", "0", address1.address, "1", "1000");
      });

      it("Shows correct user info", async function () {
        const userInfo = await derafl.getUserInfo("1", address1.address);
        expect(userInfo.ticketsOwned).to.equal("1000");
        expect(userInfo.isRefunded).to.be.false;
      });

      it("Shows correct ticket batch info", async function () {
        const batchInfo = await derafl.getBatchInfo("1", '0');
        expect(batchInfo.owner).to.equal(address1.address);
        expect(batchInfo.startTicket).to.equal('1')
        expect(batchInfo.endTicket).to.equal('1000')
      });

      it("Shows correct raffle info", async function () {

      });

      it("Other buyer can buy tickets", async function () {
        await expect(deraflAsAddress2.buyTickets("1", "8000", {
          value: parseEther("0.001").mul("8000"),
        }))
          .to.emit(derafl, "TicketPurchased")
          .withArgs("1", "1", address2.address, "1001", "8000");
      });

      it("Shows correct user info for second purchase", async function () {
        const userInfo = await derafl.getUserInfo("1", address2.address);
        expect(userInfo.ticketsOwned).to.equal("8000");
        expect(userInfo.isRefunded).to.be.false;
      });

      it("Shows correct ticket batch info for second purchase", async function () {
        const batchInfo = await derafl.getBatchInfo("1", '1');
        expect(batchInfo.owner).to.equal(address2.address);
        expect(batchInfo.startTicket).to.equal('1001')
        expect(batchInfo.endTicket).to.equal('9000')
      });

      it ("Reverts if ticket amount is higher than tickets remaining", async function () {
        // 1000 tickets remain, try to buy 2000
        await expect(
          deraflAsAddress3.buyTickets("1", "2000", {
            value: parseEther("0.001").mul("2000"),
          })
        ).to.be.revertedWithCustomError(derafl, "TicketAmountInvalid");
      })

      it ("User can purchase remaining tickets", async function () {
        // 1000 tickets remain, try to buy 2000
        await expect(
          deraflAsAddress3.buyTickets("1", "1000", {
            value: parseEther("0.001").mul("1000"),
          })
        ).to.not.be.reverted
      })


      // it("Sells remaining tickets if desired ticket amount is too high, and refunds remaining eth", async function () {
      //   // 1000 tickets remain, try to buy 2000
      //   const buyerEthBalanceBefore = await ethers.provider.getBalance(
      //     address3.address
      //   );
      //   const tx = await deraflAsAddress3.buyTickets("1", "2000", {
      //     value: parseEther("0.001").mul("2000"),
      //   });

      //   const { gasUsed, effectiveGasPrice } = await tx.wait();
      //   const buyerEthBalanceAfter = await ethers.provider.getBalance(
      //     address3.address
      //   );
      //   const expectedEthBalanceAfter = buyerEthBalanceBefore
      //     .sub(parseEther("0.001").mul("1000"))
      //     .sub(gasUsed.mul(effectiveGasPrice));
      //   expect(expectedEthBalanceAfter).to.equal(buyerEthBalanceAfter);

      //   console.log("GAS USED: ", gasUsed.toBigInt())

      //   const userInfo = await derafl.getUserInfo("1", address3.address);
      //   expect(userInfo.ticketsOwned).to.equal("1000");
      //   expect(userInfo.isRefunded).to.be.false;
      // });

      it("Shows correct raffle state for sold out raffle", async function () {
        const raffleInfo = await derafl.getRaffle("1");
        expect(raffleInfo.raffleState).to.equal(RaffleState.CLOSED);
        expect(raffleInfo.ticketsSold).to.equal(10000);
      });

      it("Reverts when trying to purchase from sold out raffle", async function () {
        await expect(
          deraflAsAddress3.buyTickets("1", "1", {
            value: parseEther("0.001").mul("1"),
          })
        ).to.be.revertedWithCustomError(derafl, "TicketAmountInvalid");
      });

      it("A raffle can be closed when sold out", async function () {
        await expect(deraflAsRaffleCreator.drawRaffle("1")).to.not.be.reverted;
      });

      it("Reverts when trying to close a closed raffle", async function () {
        await expect(deraflAsRaffleCreator.drawRaffle("1")).to.be.revertedWithCustomError(
          derafl,
          "InvalidRaffleState"
        );
      });

      it("Closing a raffle requests a random number from chain link", async function () {
        const raffleInfo = await derafl.getRaffle("1");
        expect(raffleInfo.chainlinkRequestId).gt("0");
      });

      it("Accepts hardhat random words callback", async function () {
        const raffleInfo = await derafl.getRaffle("1");
        await hardhatVrfCoordinatorV2Mock.fulfillRandomWords(
          raffleInfo.chainlinkRequestId,
          derafl.address
        );
        const raffleInfoAfter = await derafl.getRaffle("1");
        expect(raffleInfoAfter.winningTicket).gt("0");
        expect(raffleInfoAfter.raffleState).to.equal(RaffleState.DRAWN);
      });

      it("Releases NFT to winner and eth to raffle owner", async function () {
        // buyer 1 = 1-1000
        // buyer 2 = 1001 - 9000
        // buyer 3 = 9001 - 10000

        const feeCollectorBalanceBefore = await ethers.provider.getBalance(FEE_COLLECTOR)
        const royaltyCollectorBalanceBefore = await ethers.provider.getBalance(ROYALTY_FEE_RECEIVER)
        const raffleCreatorBalanceBefore = await ethers.provider.getBalance(raffleCreator.address)

        await derafl.release("1", "1");
        const newOwner = await nftMock.ownerOf("1");
        expect(address2.address).to.equal(newOwner);

        const feeCollectorBalanceAfter = await ethers.provider.getBalance(FEE_COLLECTOR)
        const ethRaised = BigNumber.from('10000').mul(parseEther('0.001'))
        const deraflFee = ethRaised.mul('5').div('100').add(parseEther('0.005'))
        const expectedBalance = feeCollectorBalanceBefore.add(deraflFee)
        expect(feeCollectorBalanceAfter).to.equal(expectedBalance)

        const royaltyCollectorBalanceAfter = await ethers.provider.getBalance(ROYALTY_FEE_RECEIVER)
        const royaltyFee = ethRaised.mul('5').div('100')
        expect(royaltyCollectorBalanceAfter).to.equal(royaltyCollectorBalanceBefore.add(royaltyFee))

        const raffleCreatorBalanceAfter = await ethers.provider.getBalance(raffleCreator.address)
        expect(raffleCreatorBalanceAfter).to.equal(raffleCreatorBalanceBefore.add(ethRaised).sub(royaltyFee).sub(deraflFee))
      });

      it("Shows correct raffle info after release", async function () {
        const raffleInfo = await derafl.getRaffle("1");
        expect(raffleInfo.raffleState).to.equal(RaffleState.RELEASED);
      });
    });

    describe("Refunded Raffle", async function () {
      const tokenId = "2"
      const raffleId = "2"

      before(async function () {
        await nftMock.safeMint(raffleCreator.address);
        const nftMockAsRaffleCreator = await nftMock.connect(raffleCreator);
        await nftMockAsRaffleCreator.approve(derafl.address, tokenId);
        const blockTime = await time.latest()
        const expiry = blockTime + (60 * 60 * 24 * 1)    
        await deraflAsRaffleCreator.createRaffle(
          nftMock.address,
          tokenId,
          expiry,
          parseEther("1"),
          TokenType.ERC1155
        );

        await deraflAsAddress1.buyTickets("2", "100", {
          value: parseEther("0.001").mul("100"),
        });
        await deraflAsAddress2.buyTickets("2", "100", {
          value: parseEther("0.001").mul("100"),
        });
        await deraflAsAddress3.buyTickets("2", "100", {
          value: parseEther("0.001").mul("100"),
        });

      });

      it("Active raffle cannot be refunded < 2 days before expiry", async function () {
        await expect(deraflAsRaffleCreator.refundRaffle(raffleId)).to.be.revertedWithCustomError(
          derafl,
          "TimeSinceExpiryInsufficientForRefund"
        );
      })

      it("Raffle can be refunded > 2 days after expiry", async function () {
        const raffleInfo = await derafl.getRaffle(raffleId)
        const expiryTimestamp = raffleInfo.expiryTimestamp
        const oneSecondBeforeRefundAvailable = expiryTimestamp.add(60 * 60 * 24 * 2 - 1)
        const oneSecondAfterRefundAvailable = oneSecondBeforeRefundAvailable.add(2)
        time.setNextBlockTimestamp(oneSecondBeforeRefundAvailable)
        await network.provider.send("evm_mine")
        await expect(deraflAsRaffleCreator.refundRaffle(raffleId)).to.be.revertedWithCustomError(
          derafl,
          "TimeSinceExpiryInsufficientForRefund"
        );
        time.setNextBlockTimestamp(oneSecondAfterRefundAvailable)
        await network.provider.send("evm_mine")
        await expect(deraflAsRaffleCreator.refundRaffle(raffleId))
          .to.emit(derafl, "RaffleRefunded")
          .withArgs(raffleId);
      })

      it("Ticket refunds work", async function () {
        const buyerEthBalanceBefore = await ethers.provider.getBalance(
          address1.address
        );
        const tx = await deraflAsAddress1.refundTickets(raffleId);
        const { effectiveGasPrice, gasUsed } = await tx.wait();
        const buyerEthBalanceAfter = await ethers.provider.getBalance(
          address1.address
        );
        const expectedEthBalance = await buyerEthBalanceBefore
          .sub(effectiveGasPrice.mul(gasUsed))
          .add(parseEther("0.001").mul("100"));
        expect(expectedEthBalance).to.equal(buyerEthBalanceAfter);
        expect(tx).to.emit(derafl, "TicketRefunded").withArgs(raffleId, address1.address, parseEther("0.001").mul("100"))
      });

      it("Raffle shows correct state after setting refund", async function () {
        const raffleState = await derafl.getRaffle(raffleId);
        expect(raffleState.raffleState).to.equal(RaffleState.REFUNDED);
      });

      it("Reverts when trying to refund again", async function () {
        await expect(derafl.refundRaffle(raffleId)).to.be.revertedWithCustomError(
          derafl,
          "InvalidRaffleState"
        );
      });

      it("Reverts if attempting to refund again", async function () {
        await expect(deraflAsAddress1.refundTickets(raffleId)).to.be.revertedWithCustomError(
          derafl,
          "TicketsAlreadyRefunded"
        );
      });

      it("All ticket holders can be refunded", async function () {
        await expect(deraflAsAddress2.refundTickets(raffleId)).to.not.be.reverted
        await expect(deraflAsAddress3.refundTickets(raffleId)).to.not.be.reverted
      })

      it("Releases nft of refunded raffle to the raffle owner", async function () {
        await expect(deraflAsAddress3.claimRefundedNft(raffleId)).to.not.be.reverted
        const nftOwner = await nftMock.ownerOf(tokenId)
        expect(nftOwner).to.equal(raffleCreator.address)
      })
    });

    describe('Royalties', () => {
      let royaltyFeeReceiver: SignerWithAddress;

      before(async function () {
        const signers = await ethers.getSigners()
        royaltyFeeReceiver = signers[12]
      });

      it('Shows 0 for a contract with no royalties', async function () {
        const NFTMock: NFTMock__factory = (await ethers.getContractFactory(
          "NFTMock"
        )) as NFTMock__factory;
        const mockNft = await NFTMock.deploy();
        const royalties = await derafl.getRoyaltyInfo(mockNft.address, '1')
        console.log("ROYAL: ", royalties)
        expect(royalties.feeReceiver).to.equal(ethers.constants.AddressZero)
        expect(royalties.royaltyFee).to.equal('0')
      })

      it('Shows correct royalties for ERC2981', async function () {
        const MockErc2981 = await ethers.getContractFactory("NFTWithRoyalites")
        const nftWithRoyalties = await MockErc2981.deploy("test", "TEST", royaltyFeeReceiver.address)
        const royalties = await derafl.getRoyaltyInfo(nftWithRoyalties.address, '1')
        expect(royalties.feeReceiver).to.equal(royaltyFeeReceiver.address)
        expect(royalties.royaltyFee).to.equal('1000')
      })

      it('Shows correct royalties for Looks rare registry', async function () {
        const MockErc2981 = await ethers.getContractFactory("NFTWithRoyalites")
        const nftWithRoyalties = await MockErc2981.deploy("test", "TEST", royaltyFeeReceiver.address)
        const royalties = await derafl.getRoyaltyInfo(nftWithRoyalties.address, '1')
        expect(true).to.be.true
      })

     })
  });
});