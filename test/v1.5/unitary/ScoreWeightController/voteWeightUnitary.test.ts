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
  const ten_to_the_18 = Constants.ten_to_the_18;
  const ten_to_the_24 = Constants.ten_to_the_24;

  before(async function () {
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
    await scoreWeightController.addScore(scoreRegistrys[0].address, 0);
    await scoreWeightController.addScore(scoreRegistrys[1].address, 0);

    await YMT.approve(veYMT.address, ten_to_the_24);
    await veYMT.createLock(
      ten_to_the_24,
      (await ethers.provider.getBlock("latest")).timestamp + year
    );
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("scoreWeightController voteWeightUnitary", function () {
    it("test_no_immediate_effect_on_weight", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        10000
      );
      const weight = await scoreWeightController.scoreRelativeWeight(
        scoreRegistrys[0].address,
        0
      );
      expect(weight).to.equal(0);
    });

    it("test_effect_on_following_period", async () => {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        10000
      );

      await ethers.provider.send("evm_increaseTime", [day * 7]);
      await scoreWeightController.checkpointScore(scoreRegistrys[0].address);
      expect(
        await scoreWeightController.scoreRelativeWeight(
          scoreRegistrys[0].address,
          BigNumber.from((await ethers.provider.getBlock("latest")).timestamp)
        )
      ).to.equal(ten_to_the_18);
    });

    it("test_remove_vote_no_immediate_effect", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        10000
      );

      await ethers.provider.send("evm_increaseTime", [day * 10]);

      await scoreWeightController.checkpointScore(scoreRegistrys[0].address);
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        0
      );

      expect(
        await scoreWeightController.scoreRelativeWeight(
          scoreRegistrys[0].address,
          0
        )
      ).to.equal(ten_to_the_18);
    });

    it("test_remove_vote_means_no_weight", async function () {
      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        10000
      );

      await ethers.provider.send("evm_increaseTime", [day * 10]);
      await ethers.provider.send("evm_mine", []);

      await scoreWeightController.checkpointScore(scoreRegistrys[0].address);
      expect(
        await scoreWeightController.scoreRelativeWeight(
          scoreRegistrys[0].address,
          0
        )
      ).to.equal(ethers.utils.parseUnits("1", 18));

      await scoreWeightController.voteForScoreWeights(
        scoreRegistrys[0].address,
        0
      );

      await ethers.provider.send("evm_increaseTime", [day * 7]);
      await ethers.provider.send("evm_mine", []);

      await scoreWeightController.checkpointScore(scoreRegistrys[0].address);
      expect(
        await scoreWeightController.scoreRelativeWeight(
          scoreRegistrys[0].address,
          0
        )
      ).to.equal(0);
    });
  });
});
