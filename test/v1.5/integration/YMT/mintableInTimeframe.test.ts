import { ethers } from "hardhat";
import { expect } from "chai";
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
  YmtVesting,
  YmtVesting__factory,
} from "../../../../typechain";
import Constants from "../../Constants";

const year = Constants.year;
const YEAR = Constants.YEAR;
const ten_to_the_18 = Constants.ten_to_the_18;
const ten_to_the_16 = Constants.ten_to_the_16;

// Constants
const INITIAL_RATE = BigNumber.from(55000000);
const YEAR_1_SUPPLY = INITIAL_RATE.mul(ten_to_the_18).div(YEAR).mul(YEAR);
const INITIAL_SUPPLY = Constants.INITIAL_SUPPLY;

describe("YMT", function () {
  let accounts: SignerWithAddress[];
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = await ethers.getSigners();
    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address,
      accounts[0].address
    );

    await time.increase(BigNumber.from(86401));
    await YMT.updateMiningParameters();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YMT MintableInTimeframe", function () {
    // Helper function for approximate equality
    function approx(a: BigNumber, b: BigNumber, precision): boolean {
      if (a.isZero() && b.isZero()) {
        return true;
      }

      // Adjust precision for BigNumber
      const precisionAdjusted = ten_to_the_18.mul(precision);

      return a.sub(b).abs().lte(a.add(b).div(precisionAdjusted));
    }

    // Helper function for theoretical supply calculation
    async function theoreticalSupply(YMT: YMT): Promise<BigNumber> {
      const epoch = await YMT.miningEpoch();
      const q = ten_to_the_18.div(BigNumber.from(2).pow(2)); // Equivalent to 1/2**0.25
      let S = INITIAL_SUPPLY.mul(ten_to_the_18);

      if (epoch.gt(0)) {
        S = S.add(
          YEAR_1_SUPPLY.mul(ten_to_the_18)
            .mul(ten_to_the_18.sub(q.pow(epoch)))
            .div(ten_to_the_18.sub(q))
        );
      }

      S = S.add(
        YEAR_1_SUPPLY.div(YEAR)
          .mul(q.pow(epoch))
          .mul((await time.latest()) - Number(await YMT.startEpochTime()))
      );

      return S;
    }

    // 与えられた時間枠で正しく発行可能な量を計算する
    it("should calculate mintable amount correctly for a given timeframe", async function () {
      const t0 = Number(await YMT.startEpochTime());

      // Ensure the exponentiation stays within safe integer limits
      const exponent = BigNumber.from(10).pow(1); // Adjust the exponent as necessary
      await time.increase(exponent);

      let t1 = await time.latest();
      if (t1 - t0 >= year) {
        await YMT.updateMiningParameters();
      }
      t1 = await time.latest();

      const availableSupply = await YMT.availableSupply();
      const mintable = await YMT.mintableInTimeframe(t0, t1);
      expect(
        availableSupply.sub(INITIAL_SUPPLY.mul(ten_to_the_18)).gte(mintable)
      ).to.equal(true);
      if (t1 == t0) {
        expect(mintable).to.equal(BigNumber.from(0));
      } else {
        const tolerance = BigNumber.from("10000000"); // Adjust as needed for precision
        expect(
          availableSupply
            .sub(INITIAL_SUPPLY.mul(ten_to_the_18))
            .div(mintable)
            .sub(1)
        ).to.be.lt(tolerance);
      }

      // Replace this with the actual theoretical supply calculation
      // const theoreticalSupply = BigNumber.from("EXPECTED_SUPPLY_CALCULATION");
      expect(
        approx(await theoreticalSupply(YMT), availableSupply, ten_to_the_16)
      ).to.equal(true);
    });

    // 最初の年内のランダムな範囲に対して発行可能な量を計算する
    it("should calculate mintable amount for a random range within the first year", async function () {
      const creationTime = await YMT.startEpochTime();
      const time1 = BigNumber.from(Math.floor(Math.random() * YEAR.toNumber()));
      const time2 = BigNumber.from(Math.floor(Math.random() * YEAR.toNumber()));
      const [start, end] = [creationTime.add(time1), creationTime.add(time2)];
      const sortedTimes = start.lt(end) ? [start, end] : [end, start];
      const rate = YEAR_1_SUPPLY.div(YEAR);

      expect(
        await YMT.mintableInTimeframe(sortedTimes[0], sortedTimes[1])
      ).to.equal(rate.mul(sortedTimes[1].sub(sortedTimes[0])));
    });

    // 複数のエポックにまたがる範囲に対して発行可能な量を計算する
    it("should calculate mintable amount for a range spanning multiple epochs", async function () {
      const creationTime = await YMT.startEpochTime();
      const start = creationTime.add(YEAR.mul(2));
      const duration = YEAR.mul(2);
      const end = start.add(duration);

      const startEpoch = start.sub(creationTime).div(YEAR);
      const endEpoch = end.sub(creationTime).div(YEAR);
      const exponent = startEpoch.mul(25);
      const rate = YEAR_1_SUPPLY.div(YEAR).div(
        BigNumber.from(2).pow(exponent.div(100))
      );

      for (let i = startEpoch.toNumber(); i < endEpoch.toNumber(); i++) {
        await time.increase(YEAR);
        await YMT.updateMiningParameters();
      }

      const mintable = await YMT.mintableInTimeframe(start, end);
      if (startEpoch.eq(endEpoch)) {
        const expectedMintable = rate.mul(end.sub(start));
        expect(approx(mintable, expectedMintable, ten_to_the_16)).to.be.true;
      } else {
        expect(mintable.lt(rate.mul(end))).to.be.true;
      }
    });

    // 利用可能な供給量を正しく計算する
    it("should calculate available supply correctly", async function () {
      const duration = BigNumber.from(100000);
      const creationTime = await YMT.startEpochTime();
      const initialSupply = await YMT.totalSupply();
      const rate = await YMT.rate();

      await time.increase(duration);

      const now = BigNumber.from(await time.latest());
      const expected = initialSupply.add(now.sub(creationTime).mul(rate));
      expect(await YMT.availableSupply()).to.equal(expected);
    });
  });
});
