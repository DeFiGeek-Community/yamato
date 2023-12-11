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
  YMT,
  YMT__factory,
  YmtVesting,
  YmtVesting__factory,
} from "../../../../typechain";
import Constants from "../../Constants";
import { approx } from "../../testHelpers";

const year = Constants.year;
const YEAR = Constants.YEAR;
const zero = Constants.zero;
const ten_to_the_18 = Constants.ten_to_the_18;
const LINEAR_DISTRIBUTION_DURATION = YEAR.mul(5);
const TOTAL_LINEAR_DISTRIBUTION = BigNumber.from(100000000).mul(ten_to_the_18);
const LINEAR_DISTRIBUTION_RATE = TOTAL_LINEAR_DISTRIBUTION.div(
  LINEAR_DISTRIBUTION_DURATION
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
      YmtVesting.address
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

  describe("YmtVesting claimFiveYearVestingTokens Tests", function () {
    // 正しい量のトークンが一定時間経過後にミントされるかテスト
    it("should mint correct amount of tokens after a year", async function () {
      const startTime = await YMT.startTime();

      await ethers.provider.send("evm_setAutomine", [false]);
      await time.increaseTo(startTime.add(YEAR));
      await YmtVesting.connect(accounts[1]).claimFiveYearVestingTokens();
      const expectedMintAmount = TOTAL_LINEAR_DISTRIBUTION.div(5);

      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_setAutomine", [true]);
      const newTotalSupply = await YMT.balanceOf(accounts[1].address);

      expect(approx(newTotalSupply, expectedMintAmount, ten_to_the_18)).to.be
        .true;
    });

    // 5年間、毎年claimFiveYearVestingTokensを実行し、全トークンがミントされるかテスト
    it("should mint all tokens over five years", async function () {
      const initialBalance = zero;
      for (let i = 0; i < 5; i++) {
        await time.increase(year);
        await YmtVesting.connect(accounts[1]).claimFiveYearVestingTokens();
        expect(await YMT.balanceOf(accounts[1].address)).to.equal(
          initialBalance.add(await YmtVesting.totalLinearDistributionClaimed())
        );
      }
      const balance = await YMT.balanceOf(accounts[1].address);
      expect(balance).to.equal(initialBalance.add(TOTAL_LINEAR_DISTRIBUTION));
    });

    // 全トークンがミントされた後、claimFiveYearVestingTokensが失敗することをテスト
    it("should fail to mint using claimFiveYearVestingTokens after all tokens are minted", async function () {
      // 線形配布期間を超える時間を進める
      await time.increase(LINEAR_DISTRIBUTION_DURATION.add(1));
      await YmtVesting.connect(accounts[1]).claimFiveYearVestingTokens();
      await time.increase(year);
      // すべてのトークンがミントされた後にclaimFiveYearVestingTokensを実行すると失敗するはず
      await expect(
        YmtVesting.connect(accounts[1]).claimFiveYearVestingTokens()
      ).to.be.revertedWith("All tokens have already been claimed");
    });

    // 一定期間経過後にミントされるトークン量が期待通りかテスト
    it("should mint the expected amount of tokens at various time intervals", async function () {
      const intervals = [
        YEAR,
        YEAR.mul(2),
        YEAR.mul(3),
        YEAR.mul(4),
        LINEAR_DISTRIBUTION_DURATION,
      ];
      const initialTotalSupply = await YMT.balanceOf(accounts[1].address);

      for (let i = 0; i < intervals.length; i++) {
        const interval = intervals[i];
        await time.increase(YEAR);
        await YmtVesting.connect(accounts[1]).claimFiveYearVestingTokens();

        const expectedMintAmount = LINEAR_DISTRIBUTION_RATE.mul(interval);
        const newTotalSupply = await YMT.balanceOf(accounts[1].address);

        expect(
          approx(
            newTotalSupply,
            initialTotalSupply.add(expectedMintAmount),
            ten_to_the_18
          )
        ).to.be.true;
      }
    });

    // admin以外がトークンをクレームしようとすると失敗することを確認。
    it("should fail to claim tokens by a non-admin", async function () {
      await time.increase(LINEAR_DISTRIBUTION_DURATION);

      // Non-admin attempts to claim the tokens
      await expect(
        YmtVesting.connect(accounts[2]).claimFiveYearVestingTokens()
      ).to.be.revertedWith("Caller is not the admin");
    });
  });
});
