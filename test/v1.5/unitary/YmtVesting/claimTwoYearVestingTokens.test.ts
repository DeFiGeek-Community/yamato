import { ethers } from "hardhat";
import { expect } from "chai";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YmtVesting,
  YMT,
  YmtVesting__factory,
  YMT__factory,
} from "../../../../typechain";
import Constants from "../../Constants";

const YEAR = Constants.YEAR;
const twoYears = YEAR.mul(2);
const TOTAL_LINEAR_DISTRIBUTION = BigNumber.from(100000000).mul(
  Constants.ten_to_the_18
);

describe("YmtVesting", function () {
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
    await YmtVesting.setYmtToken(YMT.address);
    await YmtVesting.setAdmin(accounts[1].address);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YmtVesting claimTwoYearVestingTokens Tests", function () {
    // 2年後にadminが全トークンをクレームできることを確認。
    it("should allow admin to claim all tokens after two years", async function () {
      await time.increase(twoYears);

      // Admin claims the tokens
      await YmtVesting.connect(accounts[1]).claimTwoYearVestingTokens();
      const balance = await YMT.balanceOf(accounts[1].address);

      // Assert that the admin received the total distribution amount
      expect(balance).to.equal(TOTAL_LINEAR_DISTRIBUTION);
    });

    // 2年間の期間が終了する前にトークンをクレームしようとすると失敗することを確認。
    it("should fail to claim tokens if period has not ended", async function () {
      await time.increase(YEAR.mul("1")); // Less than two years

      // Attempt to claim tokens before period ends
      await expect(
        YmtVesting.connect(accounts[1]).claimTwoYearVestingTokens()
      ).to.be.revertedWith("Distribution period has ended");
    });

    // 一度トークンをクレームした後、再度クレームしようとすると失敗することを確認。
    it("should fail to claim tokens again after claiming once", async function () {
      await time.increase(twoYears);
      await YmtVesting.connect(accounts[1]).claimTwoYearVestingTokens();

      // Attempt to claim tokens again
      await expect(
        YmtVesting.connect(accounts[1]).claimTwoYearVestingTokens()
      ).to.be.revertedWith("All tokens have already been claimed");
    });

    // admin以外がトークンをクレームしようとすると失敗することを確認。
    it("should fail to claim tokens by a non-admin", async function () {
      await time.increase(twoYears);

      // Non-admin attempts to claim the tokens
      await expect(
        YmtVesting.connect(accounts[2]).claimTwoYearVestingTokens()
      ).to.be.revertedWith("Caller is not the admin");
    });
  });
});
