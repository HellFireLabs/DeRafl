import { ethers } from "hardhat";

async function main() {
  const DeRafl = await ethers.getContractFactory("DeRafl");

  // const DRFL = await ethers.getContractFactory("DRFL");
  // const drfl = await DRFL.deploy();

  const derafl = await DeRafl.deploy(
    '6698',
    '0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D',
    '0x12405dB79325D06a973aD913D6e9BdA1343cD526',
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
