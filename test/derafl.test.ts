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

enum RaffleState {
  NONE,
  ACTIVE,
  CLOSED,
  REFUNDED,
  PENDING_DRAW,
  DRAWN,
  RELEASED,
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
      '0x12405dB79325D06a973aD913D6e9BdA1343cD526', //goerli
      FEE_COLLECTOR
    );
    await hardhatVrfCoordinatorV2Mock.addConsumer("1", derafl.address);

    const NFTMock: NFTMock__factory = (await ethers.getContractFactory(
      "NFTMock"
    )) as NFTMock__factory;
    const nftMock = await NFTMock.deploy();
    const signers = await ethers.getSigners();
    return { hardhatVrfCoordinatorV2Mock, derafl, nftMock, signers };
  }

  async function createContractsAndRaffleFixture() {
    const { hardhatVrfCoordinatorV2Mock, derafl, nftMock } =
      await createContractsFixture();
    const [owner, raffleCreator, address1, address2, address3] =
      await ethers.getSigners();
    await nftMock.safeMint(raffleCreator.address);
    const nftMockAsCreator = await nftMock.connect(raffleCreator);
    // await nftMockAsCreator.approve(derafl.address, "0");
    await nftMockAsCreator.setApprovalForAll(derafl.address, true)

    console.log("APPROVED")
    const deraflAsRaffleCreator = await derafl.connect(raffleCreator);
    const ownerOfToken = await nftMock.ownerOf('1')
    const isApproved = await nftMock.isApprovedForAll(raffleCreator.address, derafl.address)
    console.log("IS APPROVED, ", isApproved)

    console.log("CREATE BEFORE: ", ownerOfToken)
    console.log("CREATOR: ", raffleCreator.address)

    await deraflAsRaffleCreator.createRaffle(
      nftMock.address,
      "1",
      1,
      parseEther("10")
    );
    console.log("CREATE AFTER")

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
        ).to.be.revertedWith("Insufficient msg.value");
      });

      it("Buyer cannot buy 0 tickets", async function () {
        await expect(
          deraflAsAddress1.buyTickets("1", "0", {
            value: parseEther("0.001").mul("999"),
          })
        ).to.be.revertedWith("Cannot purchase 0 tickets");
      });

      it("Cannot purchase on invalid raffle id", async function () {
        await expect(
          deraflAsAddress1.buyTickets("2", "1000", {
            value: parseEther("0.001").mul("1000"),
          })
        ).to.be.revertedWith("Invalid Raffle State");
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

      it("Sells remaining tickets if desired ticket amount is too high, and refunds remaining eth", async function () {
        // 1000 tickets remain, try to buy 2000
        const buyerEthBalanceBefore = await ethers.provider.getBalance(
          address3.address
        );
        const tx = await deraflAsAddress3.buyTickets("1", "2000", {
          value: parseEther("0.001").mul("2000"),
        });

        const { gasUsed, effectiveGasPrice } = await tx.wait();
        const buyerEthBalanceAfter = await ethers.provider.getBalance(
          address3.address
        );
        const expectedEthBalanceAfter = buyerEthBalanceBefore
          .sub(parseEther("0.001").mul("1000"))
          .sub(gasUsed.mul(effectiveGasPrice));
        expect(expectedEthBalanceAfter).to.equal(buyerEthBalanceAfter);

        console.log("GAS USED: ", gasUsed.toBigInt())

        const userInfo = await derafl.getUserInfo("1", address3.address);
        expect(userInfo.ticketsOwned).to.equal("1000");
        expect(userInfo.isRefunded).to.be.false;
      });

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
        ).to.be.revertedWith("Invalid Raffle State");
      });

      it("A raffle can be closed when sold out", async function () {
        const subDeets = await hardhatVrfCoordinatorV2Mock.getSubscription("1");
        await expect(deraflAsRaffleCreator.drawRaffle("1")).to.not.be.reverted;
      });

      it("Reverts when trying to close a closed raffle", async function () {
        await expect(deraflAsRaffleCreator.drawRaffle("1")).to.be.revertedWith(
          "Raffle is already closed"
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

        await derafl.release("1", "1");
        const newOwner = await nftMock.ownerOf("1");
        expect(address2.address).to.equal(newOwner);

        const feeCollectorBalanceAfter = await ethers.provider.getBalance(FEE_COLLECTOR)
        const ethRaised = BigNumber.from('10000').mul(parseEther('0.001'))
        const deraflFee = ethRaised.mul('5').div('100').add(parseEther('0.005'))
        const expectedBalance = feeCollectorBalanceBefore.add(deraflFee)
        expect(feeCollectorBalanceAfter).to.equal(expectedBalance)
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
        await deraflAsRaffleCreator.createRaffle(
          nftMock.address,
          tokenId,
          "1",
          parseEther("1")
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
        await expect(deraflAsRaffleCreator.refundRaffle(raffleId)).to.be.revertedWith(
          "Raffle must be closed for at least 2 days before being refunded"
        );
      })

      it("Raffle can be refunded > 2 days after expiry", async function () {
        const raffleInfo = await derafl.getRaffle(raffleId)
        const expiryTimestamp = raffleInfo.expiryTimestamp
        const oneSecondBeforeRefundAvailable = expiryTimestamp.add(60 * 60 * 24 * 2 - 1)
        const oneSecondAfterRefundAvailable = oneSecondBeforeRefundAvailable.add(2)
        time.setNextBlockTimestamp(oneSecondBeforeRefundAvailable)
        await network.provider.send("evm_mine")
        await expect(deraflAsRaffleCreator.refundRaffle(raffleId)).to.be.revertedWith(
          "Raffle must be closed for at least 2 days before being refunded"
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
        await expect(derafl.refundRaffle(raffleId)).to.be.revertedWith(
          "Invalid raffle state"
        );
      });

      it("Reverts if attempting to refund again", async function () {
        await expect(deraflAsAddress1.refundTickets(raffleId)).to.be.revertedWith(
          "Tickets are already refunded"
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
  });
});