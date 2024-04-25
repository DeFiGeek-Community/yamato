import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YmtVesting,
  YMT,
  VeYMT,
  ScoreWeightControllerV2,
  ScoreRegistry,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
  ScoreWeightControllerV2__factory,
} from "../../../../typechain";
import { upgradeProxy } from "../../../../src/upgradeUtil";
import { getFakeProxy, getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";

describe("scoreWeightController", function () {
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let scoreRegistrys: any[];
  let scoreWeightController: ScoreWeightControllerV2;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  const day = Constants.day;
  const year = Constants.year;
  const ten_to_the_24 = Constants.ten_to_the_24;

  before(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    scoreRegistrys = [];

    for (let i = 0; i < 3; i++) {
      const mockScoreRegistryInstance = await getFakeProxy<ScoreRegistry>(
        contractVersion["ScoreRegistry"]
      );
      scoreRegistrys.push(mockScoreRegistryInstance);
    }
    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address
    );

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    scoreWeightController = await getProxy<
      ScoreWeightControllerV2,
      ScoreWeightControllerV2__factory
    >("ScoreWeightController", [YMT.address, veYMT.address]);
    scoreWeightController = await upgradeProxy(
      scoreWeightController.address,
      "ScoreWeightControllerV2",
      undefined,
      {
        call: { fn: "initializeV2" },
      }
    );

    await YMT.approve(veYMT.address, ten_to_the_24);
    await veYMT.createLock(
      ten_to_the_24,
      (await ethers.provider.getBlock("latest")).timestamp + year
    );

    await scoreWeightController.addScore(scoreRegistrys[0].address, 0);
    await scoreWeightController.addScore(scoreRegistrys[1].address, 0);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("scoreWeightController vote", function () {
    it("test_vote", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        10000
      );
      expect(
        await scoreWeightController.voteUserPower(accounts[0].address)
      ).to.equal(10000);
    });

    it("test_vote_partial", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[1].address,
        1234
      );
      expect(
        await scoreWeightController.voteUserPower(accounts[0].address)
      ).to.equal(1234);
    });

    it("test_vote_change", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[1].address,
        1234
      );

      await expect(
        scoreWeightController.voteForScoreWeights(scoreRegistrys[1].address, 42)
      ).to.be.revertedWith("Cannot vote so often");

      await ethers.provider.send("evm_increaseTime", [day * 10]);
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[1].address,
        42
      );

      expect(
        await scoreWeightController.voteUserPower(accounts[0].address)
      ).to.equal(42);
    });

    it("test_vote_remove", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[1].address,
        10000
      );

      await expect(
        scoreWeightController.voteForScoreWeights(scoreRegistrys[1].address, 0)
      ).to.be.revertedWith("Cannot vote so often");

      await ethers.provider.send("evm_increaseTime", [day * 10]);

      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[1].address,
        0
      );

      expect(
        await scoreWeightController.voteUserPower(accounts[0].address)
      ).to.equal(0);
    });

    it("test_vote_multiple", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        4000
      );
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[1].address,
        6000
      );

      expect(
        await scoreWeightController.voteUserPower(accounts[0].address)
      ).to.equal(10000);
    });

    it("test_vote_no_balance", async function () {
      await expect(
        scoreWeightController
          .connect(accounts[1])
          .voteForScoreWeights(scoreRegistrys[0].address, 10000)
      ).to.be.revertedWith("Your token lock expires too soon");
    });

    it("test_vote_expired", async function () {
      await ethers.provider.send("evm_increaseTime", [year * 2]);

      await expect(
        scoreWeightController.voteForScoreWeights(
          scoreRegistrys[0].address,
          10000
        )
      ).to.be.revertedWith("Your token lock expires too soon");
    });

    it("test_invalid_gauge_id", async function () {
      await expect(
        scoreWeightController.voteForScoreWeights(
          scoreRegistrys[2].address,
          10000
        )
      ).to.be.revertedWith("Score not added");
    });

    it("test_over_user_weight", async function () {
      await expect(
        scoreWeightController.voteForScoreWeights(
          scoreRegistrys[0].address,
          10001
        )
      ).to.be.revertedWith("You used all your voting power");
    });

    it("test_over_weight_multiple", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        8000
      );

      await expect(
        scoreWeightController.voteForScoreWeights(
          scoreRegistrys[1].address,
          4000
        )
      ).to.be.revertedWith("Used too much power");
    });

    it("test_over_weight_adjust_existing", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        6000
      );
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[1].address,
        3000
      );

      await ethers.provider.send("evm_increaseTime", [day * 10]);

      await expect(
        scoreWeightController.voteForScoreWeights(
          scoreRegistrys[0].address,
          8000
        )
      ).to.be.revertedWith("Used too much power");
    });
  });
});
