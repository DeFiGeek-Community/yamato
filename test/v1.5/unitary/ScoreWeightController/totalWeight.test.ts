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

  const WEIGHTS = Constants.WEIGHTS;
  const ten_to_the_18 = Constants.ten_to_the_18;

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
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("scoreWeightController TotalWeight", function () {
    it("test_total_weight", async function () {
      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        WEIGHTS[0]
      );

      expect(await scoreWeightController.getTotalWeight()).to.equal(WEIGHTS[0]);
    });

    it("test_change_gauge_weight", async function () {
      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        ten_to_the_18
      );
      await scoreWeightController.changeScoreWeight(
        scoreRegistrys[0].address,
        31337
      );

      expect(await scoreWeightController.getTotalWeight()).to.equal(31337);
    });

    it("test_multiple", async function () {
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

      const expectedTotalWeight = WEIGHTS[0].add(WEIGHTS[1]).add(WEIGHTS[2]);

      expect(await scoreWeightController.getTotalWeight()).to.equal(
        expectedTotalWeight
      );
    });
  });
});
