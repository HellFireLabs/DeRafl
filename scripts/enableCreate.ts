import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

const raffleAddress = '0x7ae04C915d7Ac028ae30062fa16Cc486c6ad0718'

async function main() {
  const derafl = await ethers.getContractAt('DeRafl', raffleAddress)

  await derafl.toggleCreateEnabled();

  console.log("RAFFLE CREATED")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
