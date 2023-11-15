import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { deployContracts } from "../../helper";
import Constants from "../../Constants";

describe("LiquidityGauge", function () {
  let accounts: any;
  let gaugeController: Contract;
  let token: Contract;
  let votingEscrow: Contract;
  let mockLpToken: Contract;
  let threeGauges: String[];
  let gauges: Contract[];

  let snapshot: SnapshotRestorer;
  const ten_to_the_18 = Constants.ten_to_the_18;
  const ten_to_the_20 = Constants.ten_to_the_20;
  const ten_to_the_21 = Constants.ten_to_the_21;
  const MAX_UINT256 = Constants.MAX_UINT256;
  const zero = Constants.zero;
  const WEEK = Constants.WEEK;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({
      gaugeController,
      threeGauges,
      gauges,
      votingEscrow,
      token,
      mockLpToken,
    } = await deployContracts());
    await gaugeController.addType("none", BigNumber.from("0"));
  });

  afterEach(async () => {
    await snapshot.restore();
  });

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
      let checkpoint_rate = await token.rate();
      let checkpoint_supply = BigNumber.from("0");
      let checkpoint_balance = BigNumber.from("0");

      // タイプの追加とその重みの変更
      await gaugeController.addType("Liquidity", BigNumber.from("0"));
      await gaugeController.changeTypeWeight(1, ten_to_the_18);
      await gaugeController.addGauge(threeGauges[0], 1, ten_to_the_18);

      // LPトークンを送信
      const creatorBalance = await mockLpToken.balanceOf(accounts[0].address);
      await mockLpToken.transfer(
        accounts[1].address,
        creatorBalance.div(BigNumber.from("2"))
      );
      await mockLpToken.transfer(
        accounts[2].address,
        creatorBalance.div(BigNumber.from("2"))
      );

      // 積分を更新する関数
      async function update_integral() {
        let t1 = BigNumber.from(
          (await ethers.provider.getBlock("latest")).timestamp
        );
        let rate1 = await token.rate();
        let t_epoch = await token.startEpochTime();
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
        checkpoint_supply = await gauges[0].totalSupply();
        checkpoint_balance = await gauges[0].balanceOf(accounts[1].address);
      }

      // Bobは常に預金または引き出しを行い、Aliceはそれをあまり行わない
      for (let i = 0; i < 10; i++) {
        let is_alice = Math.random() < 0.2;

        // ランダムな時間経過をシミュレート
        let dt = BigNumber.from(
          Math.floor(Math.random() * 86400 * 73).toString()
        ).add(BigNumber.from("1"));
        await ethers.provider.send("evm_increaseTime", [dt.toNumber()]);

        // Bobの処理
        let is_withdraw = i > 0 && Math.random() < 0.5;

        if (is_withdraw) {
          // 引き出し処理
          let amount = BigNumber.from(
            Math.floor(Math.random() * 10000).toString()
          )
            .mul(await gauges[0].balanceOf(accounts[2].address))
            .div(BigNumber.from("10000"));
          await gauges[0].connect(accounts[2]).withdraw(amount, false);
          await update_integral();
          bob_staked = bob_staked.sub(amount);
        } else {
          // 預金処理
          let amount = BigNumber.from(
            Math.floor(Math.random() * 10000).toString()
          )
            .mul(await mockLpToken.balanceOf(accounts[2].address))
            .div(BigNumber.from("10"))
            .div(BigNumber.from("10000"));
          await mockLpToken
            .connect(accounts[2])
            .approve(threeGauges[0], amount);
          await gauges[0]
            .connect(accounts[2])
            .deposit(amount, accounts[2].address, false);
          await update_integral();
          bob_staked = bob_staked.add(amount);
        }

        // Aliceの処理
        if (is_alice) {
          let is_withdraw_alice =
            (await gauges[0].balanceOf(accounts[1].address)) > 0 &&
            Math.random() > 0.5;
          if (is_withdraw_alice) {
            // 引き出し処理
            let amount_alice = BigNumber.from(
              Math.floor(Math.random() * 10000).toString()
            )
              .mul(await gauges[0].balanceOf(accounts[1].address))
              .div(BigNumber.from("10"))
              .div(BigNumber.from("10000"));
            await gauges[0].connect(accounts[1]).withdraw(amount_alice, false);
            await update_integral();
            alice_staked = alice_staked.sub(amount_alice);
          } else {
            // 預金処理
            let amount_alice = BigNumber.from(
              Math.floor(Math.random() * 10000).toString()
            )
              .mul(await mockLpToken.balanceOf(accounts[1].address))
              .div(BigNumber.from("10000"));
            await mockLpToken
              .connect(accounts[1])
              .approve(threeGauges[0], amount_alice);
            await gauges[0]
              .connect(accounts[1])
              .deposit(amount_alice, accounts[1].address, false);
            await update_integral();
            alice_staked = alice_staked.add(amount_alice);
          }
        }

        // 同じ秒数でのチェックポイントの更新は影響しないことの確認
        if (Math.random() < 0.5) {
          await gauges[0]
            .connect(accounts[1])
            .userCheckpoint(accounts[1].address);
        }
        if (Math.random() < 0.5) {
          await gauges[0]
            .connect(accounts[2])
            .userCheckpoint(accounts[2].address);
        }

        // 保有量の確認
        expect(await gauges[0].balanceOf(accounts[1].address)).to.equal(
          alice_staked
        );
        expect(await gauges[0].balanceOf(accounts[2].address)).to.equal(
          bob_staked
        );
        expect(await gauges[0].totalSupply()).to.equal(
          alice_staked.add(bob_staked)
        );

        // ランダムな時間経過をさらにシミュレート
        dt = BigNumber.from(
          Math.floor(Math.random() * 86400 * 19).toString()
        ).add(BigNumber.from("1"));
        await ethers.provider.send("evm_increaseTime", [dt.toNumber()]);

        await gauges[0]
          .connect(accounts[1])
          .userCheckpoint(accounts[1].address);
        await update_integral();
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
   * 9. Aliceが投票ロックでTokenを獲得したため、彼女はBobの2.5倍のリワードを獲得することを確認する。
   * 10. さらに時間を進め、両方のユーザーのチェックポイントを更新する。
   * 11. 最終的に、AliceとBobが同じ量のリワードを獲得していることを確認する。
   */
  describe("Mining with Vote Locking", function () {
    it("should distribute rewards according to vote lock status", async () => {
      // 2週間と5秒時間を進める
      await ethers.provider.send("evm_increaseTime", [
        WEEK.mul(BigNumber.from("2")).add(BigNumber.from("5")).toNumber(),
      ]);

      // ゲージをコントローラーに接続して適切なレートなどを設定する
      await gaugeController.addType("Liquidity", 0);
      await gaugeController.changeTypeWeight(1, ten_to_the_18);
      await gaugeController.addGauge(threeGauges[0], 1, ten_to_the_18);

      // トークンの準備
      await token.transfer(accounts[1].address, ten_to_the_20);
      await token.transfer(accounts[2].address, ten_to_the_20);

      await token
        .connect(accounts[1])
        .approve(votingEscrow.address, MAX_UINT256);
      await token
        .connect(accounts[2])
        .approve(votingEscrow.address, MAX_UINT256);
      const creatorBalance = await mockLpToken.balanceOf(accounts[0].address);
      await mockLpToken.transfer(
        accounts[1].address,
        creatorBalance.div(BigNumber.from("2"))
      );
      await mockLpToken.transfer(
        accounts[2].address,
        creatorBalance.div(BigNumber.from("2"))
      );

      await mockLpToken
        .connect(accounts[1])
        .approve(threeGauges[0], MAX_UINT256);
      await mockLpToken
        .connect(accounts[2])
        .approve(threeGauges[0], MAX_UINT256);

      // Aliceがescrowにデポジットする。AliceはBOOSTを持っていることになる
      let t = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );

      await votingEscrow
        .connect(accounts[1])
        .createLock(ten_to_the_20, t.add(WEEK.mul(BigNumber.from("2"))));

      // AliceとBobが一部の流動性をデポジットする
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_21, accounts[1].address, false);
      await gauges[0]
        .connect(accounts[2])
        .deposit(ten_to_the_21, accounts[2].address, false);
      let now = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );

      // 現在、Aliceは投票ロックを持っているが、Bobは持っていないことを確認する
      expect(
        await votingEscrow["balanceOf(address,uint256)"](
          accounts[1].address,
          now
        )
      ).to.not.equal(zero);
      expect(
        await votingEscrow["balanceOf(address,uint256)"](
          accounts[2].address,
          now
        )
      ).to.equal(zero);

      // 時間を進めてチェックポイントを更新する
      now = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        now.add(WEEK.mul(BigNumber.from("4"))).toNumber(),
      ]);

      // チェックポイント更新
      await ethers.provider.send("evm_setAutomine", [false]);
      await gauges[0].connect(accounts[2]).userCheckpoint(accounts[2].address);
      await gauges[0].connect(accounts[1]).userCheckpoint(accounts[1].address);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_setAutomine", [true]);

      // 4週間後、balanceOfは0であるべき
      now = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      expect(
        await votingEscrow["balanceOf(address,uint256)"](
          accounts[1].address,
          now
        )
      ).to.equal(zero);
      expect(
        await votingEscrow["balanceOf(address,uint256)"](
          accounts[2].address,
          now
        )
      ).to.equal(zero);

      // AliceはTokenを投票ロックしたので、2.5倍のTokenを獲得
      let rewards_alice = await gauges[0].integrateFraction(
        accounts[1].address
      );
      let rewards_bob = await gauges[0].integrateFraction(accounts[2].address);
      expect(
        rewards_alice.mul(BigNumber.from("10000000000000000")).div(rewards_bob)
      ).to.equal(BigNumber.from("25000000000000000"));

      // 時間を進めてチェックポイントを更新: 今は誰もがTokenを投票ロックしていない
      now = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        now.add(WEEK.mul(BigNumber.from("4"))).toNumber(),
      ]);

      await ethers.provider.send("evm_setAutomine", [false]);
      await gauges[0].connect(accounts[2]).userCheckpoint(accounts[2].address);
      await gauges[0].connect(accounts[1]).userCheckpoint(accounts[1].address);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_setAutomine", [true]);
      let old_rewards_alice = rewards_alice;
      let old_rewards_bob = rewards_bob;
      // 今、AliceはBobと同じ量を獲得した
      rewards_alice = await gauges[0].integrateFraction(accounts[1].address);
      rewards_bob = await gauges[0].integrateFraction(accounts[2].address);
      console.log(rewards_alice);
      console.log(rewards_bob);
      let d_alice = rewards_alice.sub(old_rewards_alice);
      let d_bob = rewards_bob.sub(old_rewards_bob);

      expect(d_alice.sub(d_bob)).to.equal(zero);
    });
  });
});
