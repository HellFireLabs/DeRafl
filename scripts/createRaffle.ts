import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

const raffleAddress = '0xFC121e4642c886C00d90512494CEd77245fFd13A'
const nftMockAddress = '0x01e5aD71D713056d9a676D7a25023CBa73433146'

async function main() {
  const derafl = await ethers.getContractAt('DeRafl', raffleAddress)
  const nftMock = await ethers.getContractAt('NFTMock', nftMockAddress)

  const isApproved = await nftMock.isApprovedForAll('0x75d01dcD61ee6Ff207B5b5861a8B06a069415b15', '0xFC121e4642c886C00d90512494CEd77245fFd13A')

  console.log("APPR: ", isApproved)
  await nftMock.setApprovalForAll(raffleAddress, true)

  await derafl.createRaffle(
    nftMockAddress,
    "1",
    1,
    parseEther("0.1")
  );

  console.log("RAFFLE CREATED")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
