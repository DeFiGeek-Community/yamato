import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const WEEK = 86400 * 7;

describe("Voting Escrow tests", function () {
  let accounts: SignerWithAddress[];
  let veYMT: Contract;
  let token: Contract;
  let snapshot: SnapshotRestorer;

  before(async () => {
    accounts = await ethers.getSigners();

    const YMT = await ethers.getContractFactory("YMT");
    const VeYMT = await ethers.getContractFactory("veYMT");

    token = await YMT.deploy();
    await token.deployed();

    veYMT = await VeYMT.deploy(token.address);
    await veYMT.deployed();

    await token
      .connect(accounts[0])
      .approve(veYMT.address, ethers.utils.parseEther("1"));
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  for (
    let st_initial = WEEK * 2;
    st_initial <= WEEK * 52;
    st_initial += WEEK * 2
  ) {
    it(`create lock with zero balance: Lock ${Math.floor(
      st_initial / WEEK
    )} Week`, async () => {
      const expectedUnlock = (await time.latest()) + st_initial;
      await veYMT
        .connect(accounts[0])
        .createLock(ethers.utils.parseEther("1"), expectedUnlock);

      const actualUnlock = (await veYMT.locked(accounts[0].address))[1];

      await time.increase(actualUnlock - (await time.latest()) - 5);

      expect(
        await veYMT["balanceOf(address)"](accounts[0].address)
      ).to.not.equal(0);

      await time.increase(10);

      expect(await veYMT["balanceOf(address)"](accounts[0].address)).to.equal(
        0
      );
    });
  }

  for (
    let st_initial = WEEK * 2;
    st_initial <= WEEK * 52;
    st_initial += WEEK * 2
  ) {
    for (let st_extend = WEEK; st_extend <= WEEK * 2; st_extend += WEEK) {
      it(`increase unlock with zero balance: Lock ${Math.floor(
        st_initial / WEEK
      )} Week, extend: ${Math.floor(st_extend / WEEK)} Week`, async () => {
        await veYMT
          .connect(accounts[0])
          .createLock(
            ethers.utils.parseEther("1"),
            (await time.latest()) + st_initial
          );

        const initialUnlock = (
          await veYMT.locked(accounts[0].address)
        )[1].toNumber();
        const extendedExpectedUnlock = initialUnlock + st_extend;

        await veYMT.increaseUnlockTime(extendedExpectedUnlock);

        const extendedActualUnlock = (
          await veYMT.locked(accounts[0].address)
        )[1];

        await time.increase(extendedActualUnlock - (await time.latest()) - 5);

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
