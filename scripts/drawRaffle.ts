import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

const raffleAddress = '0xFC121e4642c886C00d90512494CEd77245fFd13A'
const nftMockAddress = '0x01e5aD71D713056d9a676D7a25023CBa73433146'

async function main() {
  const derafl = await ethers.getContractAt('DeRafl', raffleAddress)
  const raffleInfo = await derafl.getRaffle('3')

  const winner = raffleInfo.winningTicket

  await derafl.release('4', '0')

  console.log("Raffle released")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
