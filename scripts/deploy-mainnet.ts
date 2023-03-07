import { ethers } from "hardhat";

async function main() {
  const DeRafl = await ethers.getContractFactory("DeRafl");

  // const DRFL = await ethers.getContractFactory("DRFL");
  // const drfl = await DRFL.deploy();

  const derafl = await DeRafl.deploy(
    '668',
    '0x271682DEB8C4E0901D1a1550aD2e64D568E69909',
    '0x55010472a93921a117aAD9b055c141060c8d8022',
    '0x49146F8ba80D5f24227543bBa3bB8e2c40ECC03D'
  );

  // console.log("DRFL: ", drfl.address)
  console.log("derafl: ", derafl.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
