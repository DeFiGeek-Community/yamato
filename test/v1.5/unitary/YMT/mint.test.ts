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

const week = Constants.week;
const ZERO_ADDRESS = Constants.ZERO_ADDRESS;

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
      YmtVesting.address
    );
    await time.increase(86401);
    await YMT.updateMiningParameters();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YMT Mint Tests", function () {
    // 現在の供給量と期待される供給量が一致するかテストする
    it("should match the available supply with expected supply", async function () {
      const creationTime = await YMT.startEpochTime();
      const initialSupply = await YMT.totalSupply();
      const rate = await YMT.rate();

      await time.increase(week);

      const currentBlock = BigNumber.from(await time.latest());
      const expected = initialSupply.add(
        currentBlock.sub(creationTime).mul(rate)
      );
      expect(await YMT.availableSupply()).to.equal(expected);
    });

    // ユーザーに正しい量をミントするかテストする
    it("should mint the correct amount to a user", async function () {
      await YMT.setMinter(accounts[0].address);
      const creationTime = await YMT.startEpochTime();
      const initialSupply = await YMT.totalSupply();
      const rate = await YMT.rate();

      await time.increase(week);

      const currentTime = BigNumber.from(await time.latest());
      const amount = currentTime.sub(creationTime).mul(rate);
      await YMT.mint(accounts[1].address, amount);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(amount);
      expect(await YMT.totalSupply()).to.equal(initialSupply.add(amount));
    });

    // 限度を超えたミントはリバートされるかテストする
    it("should revert minting when amount exceeds limit", async function () {
      await YMT.setMinter(accounts[0].address);
      const creationTime = await YMT.startEpochTime();
      const rate = await YMT.rate();

      await time.increase(week);

      const currentTime = BigNumber.from(await time.latest());
      const amount = currentTime.sub(creationTime).add(2).mul(rate);
      await expect(YMT.mint(accounts[1].address, amount)).to.be.revertedWith(
        "dev: exceeds allowable mint amount"
      );
    });

    // ymtMinterからのみミントが許可されるかテストする
    it("should only allow minting from ymtMinter", async function () {
      await YMT.setMinter(accounts[0].address);
      await expect(
        YMT.connect(accounts[1]).mint(accounts[1].address, 0)
      ).to.be.revertedWith("dev: ymtMinter only");
    });

    // ゼロアドレスへのミントがリバートされるかテストする
    it("should revert minting to a zero address", async function () {
      await YMT.setMinter(accounts[0].address);
      await expect(YMT.mint(ZERO_ADDRESS, 0)).to.be.revertedWith(
        "dev: zero address"
      );
    });
  });
});
