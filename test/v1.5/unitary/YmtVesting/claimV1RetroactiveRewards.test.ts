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

  describe("YmtVesting setMultipleClaimAmounts Tests", function () {
    // 複数のユーザーに対してクレーム金額を設定できるかテスト
    it("should allow setting claim amounts for multiple users", async function () {
      const users = [accounts[2].address, accounts[3].address];
      const claimAmounts = [
        BigNumber.from(5000000).mul(ten_to_the_18),
        BigNumber.from(3000000).mul(ten_to_the_18),
      ];

      // Set claim amounts for multiple users
      await YmtVesting.connect(accounts[1]).setMultipleClaimAmounts(
        users,
        claimAmounts
      );

      // Check claim amounts for each user
      for (let i = 0; i < users.length; i++) {
        const userClaimAmount = await YmtVesting.vestingAmounts(users[i]);
        expect(userClaimAmount).to.equal(claimAmounts[i]);
      }
    });

    // ユーザーと金額の配列の長さが異なる場合に失敗するかテスト
    it("should fail if the arrays of users and amounts have different lengths", async function () {
      const users = [accounts[2].address, accounts[3].address];
      const claimAmounts = [BigNumber.from(5000000).mul(ten_to_the_18)]; // Intentionally only one amount

      // Attempt to set claim amounts with mismatched array lengths
      await expect(
        YmtVesting.connect(accounts[1]).setMultipleClaimAmounts(
          users,
          claimAmounts
        )
      ).to.be.revertedWith("Users and amounts length mismatch");
    });

    // 無効なユーザーアドレスが含まれている場合に失敗するかテスト
    it("should fail if an invalid user address is included", async function () {
      const users = [accounts[2].address, ethers.constants.AddressZero]; // Include an invalid address
      const claimAmounts = [
        BigNumber.from(5000000).mul(ten_to_the_18),
        BigNumber.from(3000000).mul(ten_to_the_18),
      ];

      // Attempt to set claim amounts with an invalid user address
      await expect(
        YmtVesting.connect(accounts[1]).setMultipleClaimAmounts(
          users,
          claimAmounts
        )
      ).to.be.revertedWith("Invalid user address");
    });
  });
});
