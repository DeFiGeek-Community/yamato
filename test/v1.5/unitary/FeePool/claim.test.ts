import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  FeePoolV2,
  FeePoolV2__factory,
  YmtVesting__factory,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";
import { getProxy } from "../../../../src/testUtil";
import { upgradeProxy } from "../../../../src/upgradeUtil";
import Constants from "../../Constants";
import { gasCostOf } from "../../testHelpers";

const week = Constants.week;
const year = Constants.year;
const ten_to_the_18 = Constants.ten_to_the_18;

describe("FeePoolV2", () => {
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let feePool: FeePoolV2;
  let snapshot: SnapshotRestorer;

  before(async function () {
    [alice, bob] = await ethers.getSigners();

    // Deploy and setup contracts as in the original setup
    const YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();
    const YMT = await (<YMT__factory>(
      await ethers.getContractFactory("YMT")
    )).deploy(YmtVesting.address, alice.address);
    const veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    feePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
    await alice.sendTransaction({
      to: feePool.address,
      value: ten_to_the_18,
    });
    feePool = await upgradeProxy(feePool.address, "FeePoolV2", undefined, {
      call: { fn: "initializeV2", args: [await time.latest()] },
    });
    await feePool.setVeYMT(veYMT.address);
    await feePool.toggleAllowCheckpointToken();

    const amount = ethers.utils.parseEther("100");
    await YMT.connect(alice).approve(veYMT.address, amount.mul(10));
    await YMT.connect(alice).transfer(alice.address, amount);
    await veYMT
      .connect(alice)
      .createLock(amount, (await time.latest()) + 4 * year);
    await YMT.connect(bob).approve(veYMT.address, amount.mul(10));
    await YMT.connect(alice).transfer(bob.address, amount);
    await veYMT
      .connect(bob)
      .createLock(amount, (await time.latest()) + 4 * year);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("test_claim", () => {
    it("should increase account balance after claiming rewards", async function () {
      const balanceBeforeAlice = await ethers.provider.getBalance(
        alice.address
      );
      const balanceBeforeBob = await ethers.provider.getBalance(bob.address);

      await time.increase(week * 2);

      const tx1 = await feePool.connect(alice)["claim()"]();
      const tx2 = await feePool.connect(bob)["claim()"]();

      const balanceAfterAlice = await ethers.provider.getBalance(alice.address);
      const balanceAfterBob = await ethers.provider.getBalance(bob.address);

      expect(balanceAfterAlice).to.be.gt(
        balanceBeforeAlice.sub(await gasCostOf(tx1))
      );
      expect(balanceAfterBob).to.be.gt(
        balanceBeforeBob.sub(await gasCostOf(tx2))
      );
    });
  });
});
