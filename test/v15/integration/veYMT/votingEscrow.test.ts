import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YMT,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";
import Constants from "../../Constants";

type Stage = {
  blockNumber: number;
  timestamp: number;
  bias?: string;
};

const hour = Constants.hour;
const day = Constants.day;
const week = Constants.week;
const MAXTIME = Constants.year * 4; // 126144000
const SCALE = 1e20;
const TOL = (120 / week) * SCALE;

describe("veYMT", function () {
  // Test voting power in the following scenario.
  // Alice:
  // ~~~~~~~
  // ^
  // | *       *
  // | | \     |  \
  // | |  \    |    \
  // +-+---+---+------+---> t

  // Bob:
  // ~~~~~~~
  // ^
  // |         *
  // |         | \
  // |         |  \
  // +-+---+---+---+--+---> t

  // Alice has 100% of voting power in the first period.
  // She has 2/3 power at the start of 2nd period, with Bob having 1/2 power
  // (due to smaller locktime).
  // Alice's power grows to 100% by Bob's unlock.

  // Checking that totalSupply is appropriate.

  // After the test is done, check all over again with balanceOfAt / totalSupplyAt
  let alice, bob: SignerWithAddress;
  let veYMT: VeYMT;
  let YMT: YMT;
  let t0: number;
  let wTotal, wAlice, wBob: BigNumber;
  let snapshot: SnapshotRestorer;

  before(async function () {
    [alice, bob] = await ethers.getSigners();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  // AliceとBobの投票権の変化をテストし、期待通りの動作を確認する
  it("test voting powers", async function () {
    const amount: BigNumber = ethers.utils.parseEther("1000");
    await YMT.connect(alice).transfer(bob.address, amount);
    const stages: { [key: string]: Stage | Stage[] } = {};

    await YMT.connect(alice).approve(veYMT.address, amount.mul(10));
    await YMT.connect(bob).approve(veYMT.address, amount.mul(10));

    expect(await veYMT["totalSupply()"]()).to.equal(0);
    expect(await veYMT["balanceOf(address)"](alice.address)).to.equal(0);
    expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);

    const timeToNextWeek =
      (Math.floor((await time.latest()) / week) + 1) * week -
      (await time.latest());

    // Move to timing which is good for testing - beginning of a UTC week
    await time.increase(timeToNextWeek);

    await time.increase(hour);

    stages["before_deposits"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };

    await veYMT.connect(alice).createLock(amount, (await time.latest()) + week);

    stages["alice_deposit"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };

    // console.log("alice_deposit", stages["alice_deposit"]);

    await time.increase(hour);

    const totalSupply = await veYMT["totalSupply()"]();
    const aliceBalance = await veYMT["balanceOf(address)"](alice.address);

    expect(approx(totalSupply, amount.div(MAXTIME).mul(week - 2 * hour), TOL)).to
      .be.true;
    expect(approx(aliceBalance, amount.div(MAXTIME).mul(week - 2 * hour), TOL)).to
      .be.true;
    expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);

    t0 = await time.latest();

    stages["alice_in_0"] = [];
    stages["alice_in_0"].push({
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    });

    // console.log("alice_in_0", stages["alice_in_0"]);

    // Simulating the passage of time with 7 days and 24 hours per day
    for (let i = 0; i < 7; i++) {
      for (let _ = 0; _ < 24; _++) {
        await time.increase(hour);
      }

      const dt = (await time.latest()) - t0;
      const totalSupply = await veYMT["totalSupply()"]();
      const aliceBalance = await veYMT["balanceOf(address)"](alice.address);

      expect(
        approx(
          totalSupply,
          amount.div(MAXTIME).mul(Math.max(week - 2 * hour - dt, 0)),
          TOL
        )
      ).to.be.true;
      expect(
        approx(
          aliceBalance,
          amount.div(MAXTIME).mul(Math.max(week - 2 * hour - dt, 0)),
          TOL
        )
      ).to.be.true;
      expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);

      stages["alice_in_0"].push({
        blockNumber: await time.latestBlock(),
        timestamp: await time.latest(),
        bias: aliceBalance.toString(),
      });
    }
    // console.log("alice_in_0", stages["alice_in_0"]);
    await time.increase(hour);

    expect(await veYMT["balanceOf(address)"](alice.address)).to.equal(0);
    await veYMT.connect(alice).withdraw();
    stages["alice_withdraw"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };

    // console.log("alice_withdraw", stages["alice_withdraw"]);

    expect(await veYMT["totalSupply()"]()).to.equal(0);
    expect(await veYMT["balanceOf(address)"](alice.address)).to.equal(0);
    expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);

    await time.increase(hour);

    // Calculate the next week for round counting
    const nextWeek =
      (Math.floor((await time.latest()) / week) + 1) * week -
      (await time.latest());

    await time.increase(nextWeek);

    await veYMT
      .connect(alice)
      .createLock(amount, (await time.latest()) + 2 * week);

    stages["alice_deposit_2"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };

    // console.log("alice_deposit_2", stages["alice_deposit_2"]);

    expect(
      approx(
        await veYMT["totalSupply()"](),
        amount.div(MAXTIME).mul(2 * week),
        TOL
      )
    ).to.be.true;
    expect(
      approx(
        await veYMT["balanceOf(address)"](alice.address),
        amount.div(MAXTIME).mul(2 * week),
        TOL
      )
    ).to.be.true;
    expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);

    await veYMT.connect(bob).createLock(amount, (await time.latest()) + week);

    stages["bob_deposit_2"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };

    // console.log("bob_deposit_2", stages["bob_deposit_2"]);

    expect(
      approx(
        await veYMT["totalSupply()"](),
        amount.div(MAXTIME).mul(3 * week),
        TOL
      )
    ).to.be.true;
    expect(
      approx(
        await veYMT["balanceOf(address)"](alice.address),
        amount.div(MAXTIME).mul(2 * week),
        TOL
      )
    ).to.be.true;
    expect(
      approx(
        await veYMT["balanceOf(address)"](bob.address),
        amount.div(MAXTIME).mul(week),
        TOL
      )
    ).to.be.true;

    t0 = await time.latest();
    await time.increase(hour);

    stages["alice_bob_in_2"] = [];
    // Beginning of week: weight 3
    // End of week: weight 1
    for (let i = 0; i < 7; i++) {
      for (let _ = 0; _ < 24; _++) {
        await time.increase(hour);
      }
      const dt = (await time.latest()) - t0;
      wTotal = await veYMT["totalSupply()"]();
      wAlice = await veYMT["balanceOf(address)"](alice.address);
      wBob = await veYMT["balanceOf(address)"](bob.address);
      expect(wTotal).to.equal(wAlice.add(wBob));
      expect(
        approx(wAlice, amount.div(MAXTIME).mul(Math.max(2 * week - dt, 0)), TOL)
      ).to.be.true;
      expect(approx(wBob, amount.div(MAXTIME).mul(Math.max(week - dt, 0)), TOL))
        .to.be.true;

      stages["alice_bob_in_2"].push({
        blockNumber: await time.latestBlock(),
        timestamp: await time.latest(),
        bias: `${wAlice.toString()}, ${wBob.toString()}`,
      });
    }
    // console.log("alice_bob_in_2", stages["alice_bob_in_2"]);

    await time.increase(hour);

    await veYMT.connect(bob).withdraw();
    t0 = await time.latest();
    stages["bob_withdraw_1"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };
    const wTotal1 = await veYMT["totalSupply()"]();
    const wAlice1 = await veYMT["balanceOf(address)"](alice.address);
    expect(wAlice1).to.equal(wTotal1);
    expect(approx(wTotal1, amount.div(MAXTIME).mul(week - 2 * hour), TOL)).to.be
      .true;
    expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);

    await time.increase(hour);

    stages["alice_in_2"] = [];
    for (let i = 0; i < 7; i++) {
      for (let _ = 0; _ < 24; _++) {
        await time.increase(hour);
      }
      const dt = (await time.latest()) - t0;
      wTotal = await veYMT["totalSupply()"]();
      wAlice = await veYMT["balanceOf(address)"](alice.address);
      expect(wTotal).to.equal(wAlice);
      expect(
        approx(
          wTotal,
          amount.div(MAXTIME).mul(Math.max(week - dt - 2 * hour, 0)),
          TOL
        )
      ).to.be.true;
      expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);
      stages["alice_in_2"].push({
        blockNumber: await time.latestBlock(),
        timestamp: await time.latest(),
      });
    }
    // console.log("alice_in_2", stages["alice_in_2"]);

    await veYMT.connect(alice).withdraw();
    stages["alice_withdraw_2"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };

    await time.increase(hour);

    await veYMT.connect(bob).withdraw();
    stages["bob_withdraw_2"] = {
      blockNumber: await time.latestBlock(),
      timestamp: await time.latest(),
    };
    // console.log("bob_withdraw_2", stages["bob_withdraw_2"]);

    expect(await veYMT["totalSupply()"]()).to.equal(0);
    expect(await veYMT["balanceOf(address)"](alice.address)).to.equal(0);
    expect(await veYMT["balanceOf(address)"](bob.address)).to.equal(0);

    // Now test historical balanceOfAt and others
    expect(
      await veYMT.balanceOfAt(
        alice.address,
        stages["before_deposits"].blockNumber
      )
    ).to.equal(0);
    expect(
      await veYMT.balanceOfAt(
        bob.address,
        stages["before_deposits"].blockNumber
      )
    ).to.equal(0);
    expect(
      await veYMT.totalSupplyAt(stages["before_deposits"].blockNumber)
    ).to.equal(0);

    wAlice = await veYMT.balanceOfAt(
      alice.address,
      stages["alice_deposit"].blockNumber
    );

    expect(approx(wAlice, amount.div(MAXTIME).mul(week - hour), TOL)).to.be.true;
    expect(
      await veYMT.balanceOfAt(bob.address, stages["alice_deposit"].blockNumber)
    ).to.equal(0);
    wTotal = await veYMT.totalSupplyAt(stages["alice_deposit"].blockNumber);
    expect(wAlice).to.equal(wTotal);

    for (let i = 0; i < stages["alice_in_0"].length; i++) {
      const block = stages["alice_in_0"][i].blockNumber;
      wAlice = await veYMT.balanceOfAt(alice.address, block);
      wBob = await veYMT.balanceOfAt(bob.address, block);
      wTotal = await veYMT.totalSupplyAt(block);
      expect(wBob).to.equal(0);
      expect(wAlice).to.equal(wTotal);
      const timeLeft = Math.floor((week * (7 - i)) / 7) - 2 * hour;
      const error1h = (hour / timeLeft) * SCALE; // Rounding error of 1 block is possible, and we have 1h blocks
      expect(approx(wAlice, amount.div(MAXTIME).mul(timeLeft), error1h)).to.be
        .true;
    }

    wTotal = await veYMT.totalSupplyAt(stages["alice_withdraw"].blockNumber);
    wAlice = await veYMT.balanceOfAt(
      alice.address,
      stages["alice_withdraw"].blockNumber
    );
    wBob = await veYMT.balanceOfAt(
      bob.address,
      stages["alice_withdraw"].blockNumber
    );
    expect(wAlice).to.equal(wBob);
    expect(wAlice).to.equal(wTotal);
    expect(wTotal).to.equal(0);

    wTotal = await veYMT.totalSupplyAt(stages["alice_deposit_2"].blockNumber);
    wAlice = await veYMT.balanceOfAt(
      alice.address,
      stages["alice_deposit_2"].blockNumber
    );
    expect(approx(wTotal, amount.div(MAXTIME).mul(2 * week), TOL)).to.be.true;
    expect(wTotal).to.equal(wAlice);
    expect(
      await veYMT.balanceOfAt(
        bob.address,
        stages["alice_deposit_2"].blockNumber
      )
    ).to.equal(0);

    wTotal = await veYMT.totalSupplyAt(stages["bob_deposit_2"].blockNumber);
    wAlice = await veYMT.balanceOfAt(
      alice.address,
      stages["bob_deposit_2"].blockNumber
    );
    wBob = await veYMT.balanceOfAt(
      bob.address,
      stages["bob_deposit_2"].blockNumber
    );
    expect(wTotal).to.equal(wAlice.add(wBob));
    expect(approx(wTotal, amount.div(MAXTIME).mul(3 * week), TOL)).to.be.true;
    expect(approx(wAlice, amount.div(MAXTIME).mul(2 * week), TOL)).to.be.true;

    t0 = stages["bob_deposit_2"].timestamp;
    for (let i = 0; i < stages["alice_bob_in_2"].length; i++) {
      const block = stages["alice_bob_in_2"][i].blockNumber;
      wAlice = await veYMT.balanceOfAt(alice.address, block);
      wBob = await veYMT.balanceOfAt(bob.address, block);
      wTotal = await veYMT.totalSupplyAt(block);
      expect(wTotal).to.equal(wAlice.add(wBob));
      const dt = stages["alice_bob_in_2"][i].timestamp - t0;
      const error1h = (hour / (2 * week - i * day)) * SCALE; // Rounding error of 1 block is possible, and we have 1h blocks
      expect(
        approx(
          wAlice,
          amount.div(MAXTIME).mul(Math.max(2 * week - dt, 0)),
          error1h
        )
      ).to.be.true;
      expect(
        approx(wBob, amount.div(MAXTIME).mul(Math.max(week - dt, 0)), error1h)
      ).to.be.true;
    }

    wTotal = await veYMT.totalSupplyAt(stages["bob_withdraw_1"].blockNumber);
    wAlice = await veYMT.balanceOfAt(
      alice.address,
      stages["bob_withdraw_1"].blockNumber
    );
    wBob = await veYMT.balanceOfAt(
      bob.address,
      stages["bob_withdraw_1"].blockNumber
    );
    expect(wTotal).to.equal(wAlice);
    expect(approx(wTotal, amount.div(MAXTIME).mul(week - 2 * hour), TOL)).to.be
      .true;
    expect(wBob).to.equal(0);

    t0 = stages["bob_withdraw_1"].timestamp;
    for (let i = 0; i < stages["alice_in_2"].length; i++) {
      const block = stages["alice_in_2"][i].blockNumber;
      wAlice = await veYMT.balanceOfAt(alice.address, block);
      const wBob = await veYMT.balanceOfAt(bob.address, block);
      wTotal = await veYMT.totalSupplyAt(block);
      expect(wTotal).to.equal(wAlice);
      expect(wBob).to.equal(0);
      const dt = stages["alice_in_2"][i].timestamp - t0;
      const error1h = (hour / (week - i * day + day)) * SCALE; // Rounding error of 1 block is possible, and we have 1h blocks

      expect(
        approx(
          wTotal,
          amount.div(MAXTIME).mul(Math.max(week - dt - 2 * hour, 0)),
          error1h
        )
      ).to.be.true;
    }

    wTotal = await veYMT.totalSupplyAt(stages["bob_withdraw_2"].blockNumber);
    wAlice = await veYMT.balanceOfAt(
      alice.address,
      stages["bob_withdraw_2"].blockNumber
    );
    const wBob4 = await veYMT.balanceOfAt(
      bob.address,
      stages["bob_withdraw_2"].blockNumber
    );
    expect(wTotal).to.equal(0);
    expect(wAlice).to.equal(0);
    expect(wBob4).to.equal(0);

    await showStats();
  });

  function approx(value: BigNumber, target: BigNumber, tol: number) {
    if (value.isZero() && target.isZero()) {
      return true;
    }

    const diff = value.sub(target).abs();
    const sum = value.add(target);
    const ratio = diff.mul(2).mul(BigNumber.from(SCALE.toString())).div(sum);

    return ratio.lte(BigNumber.from(tol.toString()));
  }

  async function showStats() {
    const initialBlock = (await veYMT.pointHistory(0)).blk.toNumber();
    const latestBlock = await time.latestBlock();
    for (let i = initialBlock; i < latestBlock; i++) {
      let a = await veYMT.balanceOfAt(alice.address, `${i}`);
      let b = await veYMT.balanceOfAt(bob.address, `${i}`);
      console.log(`Block ${i}: a: ${a.toString()} b: ${b.toString()}`);
    }
    const epoch = (await veYMT.epoch()).toNumber();
    const aliceEpoch = (await veYMT.userPointEpoch(alice.address)).toNumber();
    const bobEpoch = (await veYMT.userPointEpoch(bob.address)).toNumber();
    for (let i = 0; i <= epoch; i++) {
      let p = await veYMT.pointHistory(i);
      console.log(
        `epoch: ${i}: bias: ${p.bias.toString()} slope: ${p.slope.toString()} ts: ${p.ts.toString()} blk: ${p.blk.toString()}`
      );
    }
    for (let i = 0; i <= aliceEpoch; i++) {
      let p = await veYMT.userPointHistory(alice.address, i);
      let balanceAt = p.blk.isZero()
        ? 0
        : await veYMT.balanceOfAt(alice.address, p.blk.toNumber());
      console.log(
        `alice epoch: ${i}: balanceAt: ${balanceAt.toString()} bias: ${p.bias.toString()} slope: ${p.slope.toString()} ts: ${p.ts.toString()} blk: ${p.blk.toString()}`
      );
    }
    for (let i = 0; i < bobEpoch; i++) {
      let p = await veYMT.userPointHistory(bob.address, i);
      let balanceAt = p.blk.isZero()
        ? 0
        : await veYMT.balanceOfAt(bob.address, p.blk.toNumber());
      console.log(
        `bob epoch: ${i}: balanceAt: ${balanceAt.toString()} bias: ${p.bias.toString()} slope: ${p.slope.toString()} ts: ${p.ts.toString()} blk: ${p.blk.toString()}`
      );
    }
  }
});
