import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { FakeContract } from "@defi-wonderland/smock";
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
  let scoreRegistrys: FakeContract<ScoreRegistry>[];
  let scoreWeightController: ScoreWeightControllerV2;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  const WEEK = Constants.WEEK;
  const YEAR = Constants.YEAR;
  const WEIGHTS = Constants.WEIGHTS;

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
      YmtVesting.address,
      accounts[0].address
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
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("scoreWeightController GaugesWeights", function () {
    it("test_add_gauges", async function () {
      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        WEIGHTS[0]
      );
      await scoreWeightController.addScore(
        scoreRegistrys[1].address,
        WEIGHTS[1]
      );

      expect(
        await scoreWeightController.scores(scoreRegistrys[0].address)
      ).to.equal(BigNumber.from(1));
      expect(
        await scoreWeightController.scores(scoreRegistrys[1].address)
      ).to.equal(BigNumber.from(2));
    });

    it("test_n_gauges", async function () {
      expect(await scoreWeightController.nScores()).to.equal(BigNumber.from(0));

      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        WEIGHTS[0]
      );
      await scoreWeightController.addScore(
        scoreRegistrys[1].address,
        WEIGHTS[1]
      );

      expect(await scoreWeightController.nScores()).to.equal(BigNumber.from(2));
    });

    it("test_n_gauges_same_gauge", async function () {
      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        WEIGHTS[0]
      );
      await expect(
        scoreWeightController.addScore(scoreRegistrys[0].address, WEIGHTS[0])
      ).to.be.revertedWith("cannot add the same gauge twice");
    });

    it("test_gauge_weight", async function () {
      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        WEIGHTS[0]
      );

      expect(
        await scoreWeightController.getScoreWeight(scoreRegistrys[0].address)
      ).to.equal(WEIGHTS[0]);
    });

    it("test_gauge_weight_as_zero", async function () {
      await scoreWeightController.addScore(scoreRegistrys[0].address, 0);

      expect(
        await scoreWeightController.getScoreWeight(scoreRegistrys[0].address)
      ).to.equal(0);
    });

    it("test_set_gauge_weight", async function () {
      await scoreWeightController.addScore(scoreRegistrys[0].address, 0);
      await scoreWeightController.changeScoreWeight(
        scoreRegistrys[0].address,
        WEIGHTS[0]
      );
      await ethers.provider.send("evm_increaseTime", [WEEK.toNumber()]);

      expect(
        await scoreWeightController.getScoreWeight(scoreRegistrys[0].address)
      ).to.equal(WEIGHTS[0]);
    });

    it("test_relative_weight_write", async function () {
      // ゲージを追加する際には、type IDを指定せずに追加します。
      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        WEIGHTS[0]
      );
      await scoreWeightController.addScore(
        scoreRegistrys[1].address,
        WEIGHTS[1]
      );
      await scoreWeightController.addScore(
        scoreRegistrys[2].address,
        WEIGHTS[2]
      );
      await ethers.provider.send("evm_increaseTime", [YEAR.toNumber()]);

      // 期待される総重量は、すべてのゲージの重量の合計です。
      const expectedWeight = WEIGHTS.reduce(
        (acc, weight) => acc.add(weight),
        ethers.BigNumber.from(0)
      );

      for (let i = 0; i < scoreRegistrys.length; i++) {
        const relativeWeight = await scoreWeightController.scoreRelativeWeight(
          scoreRegistrys[i].address,
          0
        );
        // 各ゲージの相対重量は、そのゲージの重量を総重量で割ったものです。
        expect(relativeWeight).to.equal(WEIGHTS[i].div(expectedWeight));
      }
    });
  });
});
