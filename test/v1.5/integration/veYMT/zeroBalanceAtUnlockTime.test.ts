import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YmtVesting,
  YMT,
  YmtVesting__factory,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";
import Constants from "../../Constants";

const week = Constants.week;
const ten_to_the_18 = Constants.ten_to_the_18;

describe("veYMT", function () {
  let accounts: SignerWithAddress[];
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let snapshot: SnapshotRestorer;

  before(async () => {
    accounts = await ethers.getSigners();

    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(YmtVesting.address);

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    await YMT.connect(accounts[0]).approve(veYMT.address, ten_to_the_18);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  // 様々な期間でロックを作成し、バランスがゼロになることを確認するテスト
  for (
    let st_initial = week * 2;
    st_initial <= week * 52;
    st_initial += week * 2
  ) {
    it(`create lock with zero balance: Lock ${Math.floor(
      st_initial / week
    )} Week`, async () => {
      const expectedUnlock = (await time.latest()) + st_initial;
      await veYMT
        .connect(accounts[0])
        .createLock(ten_to_the_18, expectedUnlock);

      const actualUnlock = (await veYMT.locked(accounts[0].address))[1];

      await time.increase(Number(actualUnlock) - (await time.latest()) - 5);

      expect(
        await veYMT["balanceOf(address)"](accounts[0].address)
      ).to.not.equal(0);

      await time.increase(10);

      expect(await veYMT["balanceOf(address)"](accounts[0].address)).to.equal(
        0
      );
    });
  }

  // 様々な期間でロックを延長し、バランスがゼロになることを確認するテスト
  for (
    let st_initial = week * 2;
    st_initial <= week * 52;
    st_initial += week * 2
  ) {
    for (let st_extend = week; st_extend <= week * 2; st_extend += week) {
      it(`increase unlock with zero balance: Lock ${Math.floor(
        st_initial / week
      )} Week, extend: ${Math.floor(st_extend / week)} Week`, async () => {
        await veYMT
          .connect(accounts[0])
          .createLock(ten_to_the_18, (await time.latest()) + st_initial);

        const initialUnlock = (
          await veYMT.locked(accounts[0].address)
        )[1].toNumber();
        const extendedExpectedUnlock = initialUnlock + st_extend;

        await veYMT.increaseUnlockTime(extendedExpectedUnlock);

        const extendedActualUnlock = (
          await veYMT.locked(accounts[0].address)
        )[1];

        await time.increase(
          Number(extendedActualUnlock) - (await time.latest()) - 5
        );

        expect(
          await veYMT["balanceOf(address)"](accounts[0].address)
        ).to.not.equal(0);

        await time.increase(10);

        expect(await veYMT["balanceOf(address)"](accounts[0].address)).to.equal(
          0
        );
      });
    }
  }
});
