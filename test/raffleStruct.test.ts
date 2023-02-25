import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { before } from "mocha";

describe("Test create struct", async function () {
    it("Calculate gas", async function () {
        const TestContract = await ethers.getContractFactory(
            "StructCreationTest"
        );
        const testContract = await TestContract.deploy()
        const blockTime = await time.latest()
        const expiry = blockTime + (60 * 60 * 24 * 1)    

        await testContract.createRaffleStandardInitializer('0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', '1', expiry, parseEther('1'))
        await testContract.createRaffleFunctionInitializer('0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', '1', expiry, parseEther('1'))
        await testContract.createRaffleKeyValueInitializer('0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', '1', expiry, parseEther('1'))
    })
})