import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  CJPY,
  CurrencyOSV3,
  Pool,
  FeePool,
  PriceFeedV3,
  PriorityRegistry,
  PriorityRegistry__factory,
  YamatoV4,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  YMT,
  VeYMT,
  ScoreWeightController,
  YmtMinter,
  ScoreRegistry,
  CJPY__factory,
  CurrencyOSV3__factory,
  YamatoV4__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  YMT__factory,
  VeYMT__factory,
  ScoreWeightController__factory,
  YmtMinter__factory,
  ScoreRegistry__factory,
  Pool__factory,
} from "../../../../typechain";
import {
  getFakeProxy,
  getProxy,
  getLinkedProxy,
} from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";

chai.use(smock.matchers);

describe("ScoreRegistry", function () {
  let mockFeePool: FakeContract<FeePool>;
  let mockFeed: FakeContract<PriceFeedV3>;
  let CJPY: CJPY;
  let currencyOS: CurrencyOSV3;
  let yamato: YamatoV4;
  let yamatoDepositor: YamatoDepositor;
  let yamatoBorrower: YamatoBorrower;
  let yamatoRepayer: YamatoRepayer;
  let yamatoWithdrawer: YamatoWithdrawer;
  let yamatoRedeemer: YamatoRedeemer;
  let yamatoSweeper: YamatoSweeper;
  let scoreRegistry: ScoreRegistry;
  let ymtMinter: YmtMinter;
  let veYMT: VeYMT;
  let YMT: YMT;
  let scoreWeightController: ScoreWeightController;
  let pool: Pool;
  let priorityRegistry: PriorityRegistry;
  let PRICE: BigNumber;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;
  const ten_to_the_18 = Constants.ten_to_the_18;
  const ten_to_the_20 = Constants.ten_to_the_20;
  const ten_to_the_21 = Constants.ten_to_the_21;
  const MAX_UINT256 = Constants.MAX_UINT256;
  const zero = Constants.zero;
  const week = Constants.week;
  const WEEK = Constants.WEEK;

  const DAY = 86400;
  const YEAR = DAY * 365;
  const MIN_AMOUNT = 10000;
  const SCALE = BigNumber.from((1e20).toString());

  beforeEach(async () => {
    accounts = await ethers.getSigners();

    mockFeePool = await getFakeProxy<FeePool>(contractVersion["FeePool"]);
    mockFeed = await getFakeProxy<PriceFeedV3>(contractVersion["PriceFeed"]);
    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();
    currencyOS = await getProxy<CurrencyOSV3, CurrencyOSV3__factory>(
      contractVersion["CurrencyOS"],
      [CJPY.address, mockFeed.address, mockFeePool.address]
    );

    yamato = await getLinkedProxy<YamatoV4, YamatoV4__factory>(
      contractVersion["Yamato"],
      [currencyOS.address],
      ["PledgeLib"]
    );

    await currencyOS.addYamato(yamato.address);
    await CJPY.setCurrencyOS(currencyOS.address);

    yamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >(contractVersion["YamatoDepositor"], [yamato.address], ["PledgeLib"]);

    yamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >(contractVersion["YamatoBorrower"], [yamato.address], ["PledgeLib"]);

    yamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      contractVersion["YamatoRepayer"],
      [yamato.address],
      ["PledgeLib"]
    );

    yamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >(contractVersion["YamatoWithdrawer"], [yamato.address], ["PledgeLib"]);

    yamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >(contractVersion["YamatoRedeemer"], [yamato.address], ["PledgeLib"]);

    yamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      contractVersion["YamatoSweeper"],
      [yamato.address],
      ["PledgeLib"]
    );

    priorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >(contractVersion["PriorityRegistry"], [yamato.address], ["PledgeLib"]);

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    scoreWeightController = await getProxy<
      ScoreWeightController,
      ScoreWeightController__factory
    >(contractVersion["ScoreWeightController"], [YMT.address, veYMT.address]);

    ymtMinter = await getProxy<YmtMinter, YmtMinter__factory>(
      contractVersion["YmtMinter"],
      [YMT.address, scoreWeightController.address]
    );

    scoreRegistry = await getLinkedProxy<ScoreRegistry, ScoreRegistry__factory>(
      contractVersion["ScoreRegistry"],
      [ymtMinter.address, yamato.address],
      ["PledgeLib"]
    );

    pool = await getProxy<Pool, Pool__factory>(contractVersion["Pool"], [
      yamato.address,
    ]);

    await (
      await yamato.setDeps(
        yamatoDepositor.address,
        yamatoBorrower.address,
        yamatoRepayer.address,
        yamatoWithdrawer.address,
        yamatoRedeemer.address,
        yamatoSweeper.address,
        pool.address,
        priorityRegistry.address
      )
    ).wait();
    await (await yamato.setScoreRegistry(scoreRegistry.address)).wait();

    await currencyOS.setYmtMinter(ymtMinter.address);
    await YMT.setMinter(ymtMinter.address);

    PRICE = BigNumber.from(260000).mul(1e18 + "");

    // CJPY.balanceOf.returns(PRICE.mul(1).mul(100).div(MCR));
    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.getPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);

    await scoreWeightController.addCurrency(
      scoreRegistry.address,
      ethers.utils.parseEther("10")
    );
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  function randomBigValue(min: number, max: number): BigNumber {
    return BigNumber.from(
      Math.floor(Math.random() * (max - min) + min).toString()
    );
  }

  function randomValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }

  function fee(amount : BigNumber): BigNumber {
    return amount.sub((amount.div(1000)))
  }

  function approx(value: BigNumber, target: BigNumber, tol: BigNumber) {
    if (value.isZero() && target.isZero()) {
      return true;
    }

    const diff = value.sub(target).abs();
    const sum = value.add(target);
    const ratio = diff.mul(2).mul(BigNumber.from(SCALE)).div(sum);

    // console.log(
    //   `Value: ${value.toString()}, Target: ${target.toString()}, Tol: ${tol.toString()}`
    // );
    // console.log(
    //   `Diff: ${diff.toString()}, Sum: ${sum.toString()}, Ratio: ${ratio.toString()}`
    // );

    return ratio.lte(tol);
  }

  describe("Gauge Integral Calculations", function () {
    /**
     * テスト: test_gauge_integral
     * 1. AliceとBobの保有量と積分の初期化を行う。
     * 2. 現在のブロックのタイムスタンプと初期レートを取得する。
     * 3. タイプを追加し、その重みを変更する。
     * 4. LPトークンをAliceとBobに均等に送信する。
     * 5. 積分の更新処理を行うための補助関数「update_integral」を定義する。
     * 6. Bobが預金または引き出しを繰り返し行い、Aliceがそれをランダムに行う10回のループを開始する。
     *    a. ランダムな時間を経過させるシミュレーションを行う。
     *    b. Bobがランダムに預金または引き出しを行う。
     *    c. 20%の確率でAliceも預金または引き出しを行う。
     *    d. 同じ秒数でのユーザーチェックポイントの更新が影響しないことを確認する。
     *    e. AliceとBobの保有量が正しいことを確認する。
     *    f. もう一度、ランダムな時間を経過させるシミュレーションを行う。
     *    g. Aliceのユーザーチェックポイントを更新し、積分を更新する。
     * 7. テストが終了する。
     */
    it("should correctly calculate user integrals over randomized actions", async () => {
      // AliceとBobの保有量と積分を初期化
      let alice_staked = BigNumber.from("0");
      let bob_staked = BigNumber.from("0");
      let integral = BigNumber.from("0");

      // 最新のブロックのタイムスタンプを取得
      let checkpoint = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      // 初期レートの取得
      let checkpoint_rate = await YMT.rate();
      let checkpoint_supply = BigNumber.from("0");
      let checkpoint_balance = BigNumber.from("0");

      await scoreWeightController.addCurrency(
        scoreRegistry.address,
        ten_to_the_18
      );

      // ETHをdeposit
      for (let i = 0; i < 3; i++) {
        await yamato
          .connect(accounts[i])
          .deposit({ value: ethers.utils.parseEther("10000") });
      }

      // 積分を更新する関数
      async function update_integral() {
        let t1 = BigNumber.from(await time.latest());
        let rate1 = await YMT.rate();
        let t_epoch = await YMT.startEpochTime();
        let rate_x_time = BigNumber.from("0");

        // checkpoint >= t_epoch
        if (checkpoint.gte(t_epoch)) {
          // t1 - checkpoint * rate1
          rate_x_time = t1.sub(checkpoint).mul(rate1);
        } else {
          // t_epoch - checkpoint * checkpoint_rate ( t1 - t_epoch * rate1)
          rate_x_time = t_epoch
            .sub(checkpoint)
            .mul(checkpoint_rate)
            .add(t1.sub(t_epoch).mul(rate1));
        }

        // checkpoint_supply > 0
        if (checkpoint_supply.gt(BigNumber.from("0"))) {
          // integral + rate_x_time * checkpoint_balance / checkpoint_supply
          integral = integral.add(
            rate_x_time.mul(checkpoint_balance).div(checkpoint_supply)
          );
        }

        checkpoint_rate = rate1;
        checkpoint = t1;
        checkpoint_supply = await CJPY.totalSupply();
        checkpoint_balance = await CJPY.balanceOf(accounts[1].address);
      }

      // Bobは常に預金または引き出しを行い、Aliceはそれをあまり行わない
      for (let i = 0; i < 40; i++) {
        let is_alice = Math.random() < 0.2;

        // ランダムな時間経過をシミュレート
        let dt = randomValue(1, Math.floor(YEAR / 5))
        await ethers.provider.send("evm_increaseTime", [dt]);

        // Bobの処理
        let is_withdraw = i > 0 && Math.random() < 0.5;
        const bob_balance = Number(await CJPY.balanceOf(accounts[2].address))
        if (is_withdraw) {
          // 引き出し処理
          let amount = randomBigValue(1, bob_balance + 1)
          await yamato.connect(accounts[2]).repay(amount);
          await update_integral();
          bob_staked = bob_staked.sub(amount);
        } else {
          // 預金処理
          let amount = randomBigValue(1 + MIN_AMOUNT, Math.floor(bob_balance / 10) + 1 + MIN_AMOUNT);
          await yamato
            .connect(accounts[2])
            .borrow(amount);
          await update_integral();

          bob_staked = bob_staked.add(fee(amount));
        }

        // Aliceの処理
        if (is_alice) {
          const alice_balance = Number(await CJPY.balanceOf(accounts[1].address))
          let is_withdraw_alice = alice_balance > 0 && Math.random() > 0.5;
          if (is_withdraw_alice) {
            // 引き出し処理
            let amount_alice = randomBigValue(1, Math.floor(alice_balance / 10) + 1)
            await yamato.connect(accounts[1]).repay(amount_alice);
            await update_integral();
            alice_staked = alice_staked.sub(amount_alice);
          } else {
            // 預金処理
            let amount_alice = randomBigValue(1 + MIN_AMOUNT, alice_balance + 1 + MIN_AMOUNT)
            await yamato
              .connect(accounts[1])
              .borrow(amount_alice);
            await update_integral();

            alice_staked = alice_staked.add(fee(amount_alice));
          }
        }

        // 同じ秒数でのチェックポイントの更新は影響しないことの確認
        if (Math.random() < 0.5) {
          await scoreRegistry
            .connect(accounts[1])
            .userCheckpoint(accounts[1].address);
        }
        if (Math.random() < 0.5) {
          await scoreRegistry
            .connect(accounts[2])
            .userCheckpoint(accounts[2].address);
        }

        // 保有量の確認
        expect(await CJPY.balanceOf(accounts[1].address)).to.equal(
          alice_staked
        );
        expect(await CJPY.balanceOf(accounts[2].address)).to.equal(
          bob_staked
        );

        // ランダムな時間経過をさらにシミュレート
        dt = randomValue(1, Math.floor(YEAR / 20))
        await ethers.provider.send("evm_increaseTime", [dt]);

        await scoreRegistry
          .connect(accounts[1])
          .userCheckpoint(accounts[1].address);
        await update_integral();
        const reward = await scoreRegistry.integrateFraction(accounts[1].address);
        expect(approx(reward, integral, Constants.ten_to_the_18)).to.be.true;
      }
    });
  });

  /**
   * test_mining_with_votelock の全体的な流れ:
   *
   * 1. 2週間と5秒の時間を進める。
   * 2. ゲージとコントローラーをセットアップし、適切なレートを設定する。
   * 3. AliceとBobにトークンを転送し、それぞれのアドレスに関連する承認を設定する。
   * 4. Aliceは投票のエスクローにトークンをロックすることで、BOOSTを取得する。
   * 5. AliceとBobはそれぞれ流動性をデポジットする。
   * 6. Aliceの投票ロックの存在とBobの投票ロックの不在を確認する。
   * 7. 時間をさらに進め、両方のユーザーのチェックポイントを更新する。
   * 8. 4週間後、AliceとBobの投票エスクローのバランスが0であることを確認する。
   * 9. Aliceが投票ロックでTokenを獲得したため、AliceはBobの2.5倍のリワードを獲得することを確認する。
   * 10. さらに時間を進め、両方のユーザーのチェックポイントを更新する。
   * 11. 最終的に、AliceとBobが同じ量のリワードを獲得していることを確認する。
   */
  describe("Mining with Vote Locking", function () {
    it("should distribute rewards according to vote lock status", async () => {
      // 2週間と5秒時間を進める
      await ethers.provider.send("evm_increaseTime", [
        week * 2 + 5,
      ]);

      // ゲージをコントローラーに接続して適切なレートなどを設定する
      await scoreWeightController.addCurrency(
        scoreRegistry.address,
        ten_to_the_18
      );

      // トークンの準備
      await YMT.transfer(accounts[1].address, ten_to_the_20);
      await YMT.transfer(accounts[2].address, ten_to_the_20);

      await YMT.connect(accounts[1]).approve(veYMT.address, MAX_UINT256);
      await YMT.connect(accounts[2]).approve(veYMT.address, MAX_UINT256);

      // Aliceがescrowにデポジットする。AliceはBOOSTを持っていることになる
      let t = await time.latest()

      await veYMT
        .connect(accounts[1])
        .createLock(ten_to_the_20, t + (week * 2));

      // ETHをdeposit
      for (let i = 0; i < 3; i++) {
        await yamato
          .connect(accounts[i])
          .deposit({ value: ethers.utils.parseEther("100") });
      }
      // AliceとBobが一部の流動性をデポジットする
      await ethers.provider.send("evm_setAutomine", [false]);
      await yamato.connect(accounts[1]).borrow(ten_to_the_21);
      await yamato.connect(accounts[2]).borrow(ten_to_the_21);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_setAutomine", [true]);
      let now = await time.latest()

      // 現在、Aliceは投票ロックを持っているが、Bobは持っていないことを確認する
      expect(
        await veYMT["balanceOf(address,uint256)"](accounts[1].address, now)
      ).to.not.equal(zero);
      expect(
        await veYMT["balanceOf(address,uint256)"](accounts[2].address, now)
      ).to.equal(zero);

      // 時間を進めてチェックポイントを更新する
      now = await time.latest();

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        now + week * 4,
      ]);

      // チェックポイント更新
      await ethers.provider.send("evm_setAutomine", [false]);
      await scoreRegistry.connect(accounts[2]).userCheckpoint(accounts[2].address);
      await scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[1].address);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_setAutomine", [true]);

      // 4週間後、balanceOfは0であるべき
      now = await time.latest();
      expect(
        await veYMT["balanceOf(address,uint256)"](accounts[1].address, now)
      ).to.equal(zero);
      expect(
        await veYMT["balanceOf(address,uint256)"](accounts[2].address, now)
      ).to.equal(zero);

      // AliceはTokenを投票ロックしたので、2.5倍のTokenを獲得
      let rewards_alice = await scoreRegistry.integrateFraction(
        accounts[1].address
      );
      let rewards_bob = await scoreRegistry.integrateFraction(accounts[2].address);

      expect(
        rewards_alice.mul(BigNumber.from("10000000000000000")).div(rewards_bob)
      ).to.equal(BigNumber.from("25000000000000000"));

      // 時間を進めてチェックポイントを更新: 今は誰もがTokenを投票ロックしていない
      now = await time.latest();

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        now + week * 4,
      ]);

      await ethers.provider.send("evm_setAutomine", [false]);
      await scoreRegistry.connect(accounts[2]).userCheckpoint(accounts[2].address);
      await scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[1].address);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_setAutomine", [true]);
      let old_rewards_alice = rewards_alice;
      let old_rewards_bob = rewards_bob;
      // 今、AliceはBobと同じ量を獲得した
      rewards_alice = await scoreRegistry.integrateFraction(accounts[1].address);
      rewards_bob = await scoreRegistry.integrateFraction(accounts[2].address);

      let d_alice = rewards_alice.sub(old_rewards_alice);
      let d_bob = rewards_bob.sub(old_rewards_bob);

      expect(d_alice.sub(d_bob)).to.equal(zero);
    });
  });

});
