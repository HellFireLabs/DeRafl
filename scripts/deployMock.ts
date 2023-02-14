import { ethers } from "hardhat";

async function main() {
    const NFTMock = await ethers.getContractFactory("NFTMock");
    const nftMock = await NFTMock.deploy()
    console.log("MOCK ADDR: ", nftMock.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
