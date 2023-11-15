import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import Constants from "../../Constants";

async function increaseTime(duration: BigNumber) {
  await ethers.provider.send("evm_increaseTime", [duration.toNumber()]);
  await ethers.provider.send("evm_mine", []);
}

// Constants
const YEAR = Constants.YEAR;
const INITIAL_RATE = BigNumber.from(274815283);
const YEAR_1_SUPPLY = INITIAL_RATE.mul(BigNumber.from(10).pow(18))
  .div(YEAR)
  .mul(YEAR);
const INITIAL_SUPPLY = BigNumber.from(1303030303);

describe("ERC20CRV", function () {
  let accounts: SignerWithAddress[];
  let token: Contract;
  let snapshot: SnapshotRestorer;
  const year = Constants.year;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CRV");
    token = await Token.deploy();

    await increaseTime(BigNumber.from(86401));
    await token.updateMiningParameters();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("ERC20CRV MintableInTimeframe", function () {
    // Helper function for approximate equality
    function approx(a: BigNumber, b: BigNumber, precision): boolean {
      if (a.isZero() && b.isZero()) {
        return true;
      }

      // Adjust precision for BigNumber
      const precisionAdjusted = BigNumber.from(10).pow(18).mul(precision);

      return a.sub(b).abs().lte(a.add(b).div(precisionAdjusted));
    }

    // Helper function for theoretical supply calculation
    async function theoreticalSupply(token: Contract): Promise<BigNumber> {
      const epoch = await token.miningEpoch();
      const q = BigNumber.from(10).pow(18).div(BigNumber.from(2).pow(2)); // Equivalent to 1/2**0.25
      let S = INITIAL_SUPPLY.mul(BigNumber.from(10).pow(18));

      if (epoch.gt(0)) {
        S = S.add(
          YEAR_1_SUPPLY.mul(BigNumber.from(10).pow(18))
            .mul(BigNumber.from(10).pow(18).sub(q.pow(epoch)))
            .div(BigNumber.from(10).pow(18).sub(q))
        );
      }

      S = S.add(
        YEAR_1_SUPPLY.div(YEAR)
          .mul(q.pow(epoch))
          .mul(
            (await ethers.provider.getBlock("latest")).timestamp -
              (await token.startEpochTime())
          )
      );

      return S;
    }

    it("test_mintable_in_timeframe", async function () {
      const t0 = Number(await token.startEpochTime());

      // Ensure the exponentiation stays within safe integer limits
      const exponent = BigNumber.from(10).pow(1); // Adjust the exponent as necessary
      await increaseTime(exponent);

      let t1 = (await ethers.provider.getBlock("latest")).timestamp;
      if (t1 - t0 >= year) {
        await token.updateMiningParameters();
      }
      t1 = (await ethers.provider.getBlock("latest")).timestamp;

      const availableSupply = await token.availableSupply();
      const mintable = await token.mintableInTimeframe(t0, t1);
      expect(
        availableSupply
          .sub(INITIAL_SUPPLY.mul(Constants.ten_to_the_18))
          .gte(mintable)
      ).to.equal(true);
      if (t1 == t0) {
        expect(mintable).to.equal(BigNumber.from(0));
      } else {
        const tolerance = BigNumber.from("10000000"); // Adjust as needed for precision
        expect(
          availableSupply
            .sub(INITIAL_SUPPLY.mul(Constants.ten_to_the_18))
            .div(mintable)
            .sub(1)
        ).to.be.lt(tolerance);
      }

      // Replace this with the actual theoretical supply calculation
      // const theoreticalSupply = BigNumber.from("EXPECTED_SUPPLY_CALCULATION");
      expect(
        approx(
          await theoreticalSupply(token),
          availableSupply,
          Constants.ten_to_the_16
        )
      ).to.equal(true);
    });

    it("test_random_range_year_one", async function () {
      const creationTime = await token.startEpochTime();
      const time1 = BigNumber.from(Math.floor(Math.random() * YEAR.toNumber()));
      const time2 = BigNumber.from(Math.floor(Math.random() * YEAR.toNumber()));
      const [start, end] = [creationTime.add(time1), creationTime.add(time2)];
      const sortedTimes = start.lt(end) ? [start, end] : [end, start];
      const rate = YEAR_1_SUPPLY.div(YEAR);

      expect(
        await token.mintableInTimeframe(sortedTimes[0], sortedTimes[1])
      ).to.equal(rate.mul(sortedTimes[1].sub(sortedTimes[0])));
    });

    it("test_random_range_multiple_epochs", async function () {
      const creationTime = await token.startEpochTime();
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
        await increaseTime(YEAR);
        await token.updateMiningParameters();
      }

      const mintable = await token.mintableInTimeframe(start, end);
      if (startEpoch.eq(endEpoch)) {
        const expectedMintable = rate.mul(end.sub(start));
        expect(approx(mintable, expectedMintable, Constants.ten_to_the_16)).to
          .be.true;
      } else {
        expect(mintable.lt(rate.mul(end))).to.be.true;
      }
    });

    it("test_available_supply", async function () {
      const duration = BigNumber.from(100000);
      const creationTime = await token.startEpochTime();
      const initialSupply = await token.totalSupply();
      const rate = await token.rate();

      await increaseTime(duration);

      const now = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      const expected = initialSupply.add(now.sub(creationTime).mul(rate));
      expect(await token.availableSupply()).to.equal(expected);
    });
  });
});
