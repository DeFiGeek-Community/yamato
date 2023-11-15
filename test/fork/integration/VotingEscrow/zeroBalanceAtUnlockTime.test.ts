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
  let votingEscrow: Contract;
  let token: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();

    const CRV = await ethers.getContractFactory("CRV");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");

    token = await CRV.deploy();
    await token.deployed();

    votingEscrow = await VotingEscrow.deploy(
      token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
    );
    await votingEscrow.deployed();

    await token
      .connect(accounts[0])
      .approve(votingEscrow.address, ethers.utils.parseEther("1"));
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
      await votingEscrow
        .connect(accounts[0])
        .createLock(ethers.utils.parseEther("1"), expectedUnlock);

      const actualUnlock = (await votingEscrow.locked(accounts[0].address))[1];

      await time.increase(actualUnlock - (await time.latest()) - 5);

      expect(
        await votingEscrow["balanceOf(address)"](accounts[0].address)
      ).to.not.equal(0);

      await time.increase(10);

      expect(
        await votingEscrow["balanceOf(address)"](accounts[0].address)
      ).to.equal(0);
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
        await votingEscrow
          .connect(accounts[0])
          .createLock(
            ethers.utils.parseEther("1"),
            (await time.latest()) + st_initial
          );

        const initialUnlock = (
          await votingEscrow.locked(accounts[0].address)
        )[1].toNumber();
        const extendedExpectedUnlock = initialUnlock + st_extend;

        await votingEscrow.increaseUnlockTime(extendedExpectedUnlock);

        const extendedActualUnlock = (
          await votingEscrow.locked(accounts[0].address)
        )[1];

        await time.increase(extendedActualUnlock - (await time.latest()) - 5);

        expect(
          await votingEscrow["balanceOf(address)"](accounts[0].address)
        ).to.not.equal(0);

        await time.increase(10);

        expect(
          await votingEscrow["balanceOf(address)"](accounts[0].address)
        ).to.equal(0);
      });
    }
  }
});
