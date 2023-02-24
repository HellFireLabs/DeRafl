import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

const raffleAddress = '0xd084BBA05Df5FB177696fEFF02856ff7f8B782CA'

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
