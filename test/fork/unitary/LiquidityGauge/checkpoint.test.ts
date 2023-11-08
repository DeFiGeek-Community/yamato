import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, TestSetup } from "../../helper";


const YEAR = 86400 * 365;

describe("LiquidityGauge checkpoint", function () {
  let setup: TestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
    setup = new TestSetup();
    await setup.setup();
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  it("test_user_checkpoint", async function () {
    // Assuming `userCheckpoint` is a function on your contract
    await setup.lg.connect(setup.alice).userCheckpoint(setup.aliceAddress);
  });

  it("test_user_checkpoint_new_period", async function () {
    await setup.lg.connect(setup.alice).userCheckpoint(setup.aliceAddress);
    
    // Increase the time on the blockchain
    await ethers.provider.send('evm_increaseTime', [(YEAR * 1.1)]);
    await ethers.provider.send('evm_mine'); // this one will actually mine a new block

    await setup.lg.connect(setup.alice).userCheckpoint(setup.aliceAddress);
  });

  it("test_user_checkpoint_wrong_account", async function () {
    // Expect the transaction to be reverted with the specified error message
    await expect(
      setup.lg.connect(setup.alice).userCheckpoint(setup.bobAddress)
    ).to.be.revertedWith("dev: unauthorized");
  });
});
