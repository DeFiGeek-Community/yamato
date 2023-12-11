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

const YEAR = Constants.YEAR;
const ten_to_the_18 = Constants.ten_to_the_18;

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

  describe("YmtVesting claimV1RetroactiveRewards Tests", function () {
    // 特定のアドレスが正しい量のトークンを請求できるかテスト
    it("should allow a user to claim the correct amount of tokens", async function () {
      const user = accounts[2].address;
      const claimAmount = BigNumber.from(5000000).mul(ten_to_the_18);

      // Set claim amount for user
      await YmtVesting.connect(accounts[1]).setClaimAmount(user, claimAmount);

      // Simulate time passage
      await time.increase(YEAR);

      // Claim tokens
      await YmtVesting.connect(accounts[2]).claimV1RetroactiveRewards();

      // Check user's balance
      const userBalance = await YMT.balanceOf(user);
      expect(userBalance).to.equal(claimAmount);
    });

    // 時間経過に伴い、正しい量のトークンが請求できるかテスト
    it("should allow claiming the correct amount of tokens over time", async function () {
      const user = accounts[2].address;
      const claimAmount = BigNumber.from(2000000).mul(ten_to_the_18);

      await YmtVesting.connect(accounts[1]).setClaimAmount(user, claimAmount);
      await time.increase(YEAR.div(2)); // Increase time by half a year

      await YmtVesting.connect(accounts[2]).claimV1RetroactiveRewards();

      const userBalance = await YMT.balanceOf(user);
      const expectedBalance = claimAmount.div(2);
      expect(approx(userBalance, expectedBalance, ten_to_the_18)).to.be.true;
    });

    // トークン請求量を超える請求は失敗するかテスト
    it("should fail to claim more than the allocated amount", async function () {
      const user = accounts[2].address;
      const claimAmount = BigNumber.from(1000000).mul(ten_to_the_18);

      await YmtVesting.connect(accounts[1]).setClaimAmount(user, claimAmount);
      await time.increase(YEAR); // Full year passes

      // First claim is successful
      await YmtVesting.connect(accounts[2]).claimV1RetroactiveRewards();

      // Second claim attempt should fail
      await expect(
        YmtVesting.connect(accounts[2]).claimV1RetroactiveRewards()
      ).to.be.revertedWith("No tokens available to claim");
    });

    // 請求可能なトークンがない場合に失敗するかテスト
    it("should fail to claim when there are no tokens to claim", async function () {
      // Attempt to claim tokens before the full year has passed
      await expect(
        YmtVesting.connect(accounts[1]).claimV1RetroactiveRewards()
      ).to.be.revertedWith("No tokens to claim");
    });
  });
});
