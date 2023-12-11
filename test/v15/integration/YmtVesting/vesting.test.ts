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

const year = Constants.year;
const ten_to_the_18 = Constants.ten_to_the_18;

describe("YmtVesting Integration Tests", function () {
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

  it("should claim all tokens and empty the contract balance", async function () {
    const initialBalance = await YMT.balanceOf(YmtVesting.address);
    expect(initialBalance).to.equal(
      BigNumber.from("250000000").mul(ten_to_the_18)
    );
    await time.increase(year);
    for (let i = 2; i <= 6; i++) {
      await YmtVesting.connect(accounts[1]).setClaimAmount(
        accounts[i].address,
        BigNumber.from("10000000").mul(ten_to_the_18)
      );
      await YmtVesting.connect(accounts[i]).claimV1RetroactiveRewards();
      expect(await YMT.balanceOf(accounts[i].address)).to.equal(
        BigNumber.from("10000000").mul(ten_to_the_18)
      );
    }

    await time.increase(year * 2);
    await YmtVesting.connect(accounts[1]).claimTwoYearVestingTokens();
    expect(await YMT.balanceOf(accounts[1].address)).to.equal(
      BigNumber.from("100000000").mul(ten_to_the_18)
    );

    await time.increase(3 * year);
    await YmtVesting.connect(accounts[1]).claimFiveYearVestingTokens();
    expect(await YMT.balanceOf(accounts[1].address)).to.equal(
      BigNumber.from("200000000").mul(ten_to_the_18)
    );

    // Check final balance of YMT in the contract
    const finalContractBalance = await YMT.balanceOf(YmtVesting.address);
    expect(finalContractBalance).to.equal(
      BigNumber.from(0)
    );
  });
});
