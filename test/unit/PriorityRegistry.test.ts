import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import {
  CurrencyOS,
  FeePool,
  PledgeLib__factory,
  PriceFeedV3,
  Yamato,
  YamatoDummy,
  YamatoDummy__factory,
  PriorityRegistryV6,
  PriorityRegistryV6__factory,
  CJPY,
} from "../../typechain";
import { getFakeProxy, getLinkedProxy } from "../../src/testUtil";
import { describe } from "mocha";

chai.use(smock.matchers);

describe("contract PriorityRegistry", function () {
  let mockYamato: FakeContract<Yamato>;
  let mockCurrencyOS: FakeContract<CurrencyOS>;
  let mockFeePool: FakeContract<FeePool>;
  let mockFeed: FakeContract<PriceFeedV3>;
  let mockCJPY: FakeContract<CJPY>;
  let yamatoDummy: YamatoDummy;
  let priorityRegistryWithYamatoMock: PriorityRegistryV6;
  let priorityRegistry: PriorityRegistryV6;
  let accounts: Signer[];
  let address0: string;
  const PRICE = BigNumber.from(410000).mul(1e18 + "");

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    address0 = await accounts[0].getAddress();

    mockFeed = await getFakeProxy<PriceFeedV3>("PriceFeedV3");
    mockFeePool = await getFakeProxy<FeePool>("FeePool");
    mockCurrencyOS = await getFakeProxy<CurrencyOS>("CurrencyOSV2");
    const PledgeLib = (
      await (<PledgeLib__factory>(
        await ethers.getContractFactory("PledgeLib")
      )).deploy()
    ).address;
    const yamatoDummyContractFactory = <YamatoDummy__factory>(
      await ethers.getContractFactory("YamatoDummy", {
        libraries: { PledgeLib },
      })
    );
    mockYamato = await getFakeProxy<Yamato>("Yamato");
    mockYamato.currencyOS.returns(mockCurrencyOS.address);

    mockCJPY = await smock.fake<CJPY>("CJPY");

    mockCJPY.balanceOf.returns(PRICE.mul(1).mul(100).div(130));
    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.getPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);
    mockCurrencyOS.priceFeed.returns(mockFeed.address);
    mockCurrencyOS.feePool.returns(mockFeePool.address);
    mockCurrencyOS.currency.returns(mockCJPY.address);
    mockYamato.priceFeed.returns(mockFeed.address);

    /*
        For unit tests
      */
    priorityRegistryWithYamatoMock = await getLinkedProxy<
      PriorityRegistryV6,
      PriorityRegistryV6__factory
    >("PriorityRegistry", [mockYamato.address], ["PledgeLib"]);

    /*
        For onlyYamato tests
      */
    yamatoDummy = await yamatoDummyContractFactory.deploy(
      mockCurrencyOS.address
    );

    priorityRegistry = await getLinkedProxy<
      PriorityRegistryV6,
      PriorityRegistryV6__factory
    >("PriorityRegistry", [yamatoDummy.address], ["PledgeLib"]);

    await (
      await yamatoDummy.setPriorityRegistry(priorityRegistry.address)
    ).wait();
  });

  describe("upsert()", function () {
    it(`fails due to the call from EOA.`, async function () {
      /*
                  struct Pledge {
                      uint coll;
                      uint debt;
                      bool isCreated;
                      address owner;
                      uint priority;
                  }
              */
      const _pledge = [
        BigNumber.from("100000000000000000"),
        BigNumber.from("41000100000000000000000"),
        true,
        address0,
        0,
      ];

      await expect(
        priorityRegistryWithYamatoMock
          .connect(accounts[1])
          .upsert(toTyped(_pledge))
      ).to.be.revertedWith("You are not Yamato contract.");
    });

    it(`succeeds to upsert logless \(coll=0 debt=0 priority=0\) pledge`, async function () {
      const _pledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        address0,
        0,
      ];
      await expect(yamatoDummy.bypassUpsert(toTyped(_pledge))).to.be.not
        .reverted;
    });

    it(`fails to upsert logful \(coll=0 debt=0 priority/=0\) pledge because such full-withdrawn pledge has to be removed`, async function () {
      // Note: deposit->noBorrow->withdrawal scenario
      const _pledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        address0,
        BigNumber.from(
          "1157920892373161954235709850086879078532699846656405640394575840079131296399"
        ),
      ];
      await expect(
        yamatoDummy.bypassUpsert(toTyped(_pledge))
      ).to.be.revertedWith(
        "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
      );
    });

    it(`succeeds to be called from Yamato.`, async function () {
      const pledgeLengthBefore = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );

      const _pledge = [
        BigNumber.from("100000000000000000"),
        BigNumber.from("0"),
        true,
        address0,
        0,
      ];
      await (await yamatoDummy.bypassUpsert(toTyped(_pledge))).wait();

      const pledgeLengthAfter = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.add(1));
    });

    it(`succeeds to replace an existing item with ICR=0.`, async function () {
      const _collBefore = BigNumber.from("100000000000000000");
      const _debtBefore = BigNumber.from("41000100000000000000000");
      const _ICRDefault = BigNumber.from("1");
      const _ICRBefore = _collBefore
        .mul(PRICE)
        .mul(10000)
        .div(_debtBefore)
        .div(1e18 + "");
      expect(_ICRBefore).to.eq("9999");
      const _pledgeBefore = [
        _collBefore,
        _debtBefore,
        true,
        address0,
        _ICRDefault,
      ];
      const pledgeLength1 = await priorityRegistry.rankedQueueLen(
        _ICRBefore.div(100)
      );
      await (await yamatoDummy.bypassUpsert(toTyped(_pledgeBefore))).wait();
      const pledgeLength2 = await priorityRegistry.rankedQueueLen(
        _ICRBefore.div(100)
      );
      expect(pledgeLength2).to.eq(pledgeLength1.add(1));

      const _collAfter = BigNumber.from("0");
      const _debtAfter = _debtBefore;
      const _ICRAfter = _collAfter
        .mul(PRICE)
        .mul(10000)
        .div(_debtAfter)
        .div(1e18 + "");

      const _pledgeAfter = [_collAfter, _debtAfter, true, address0, _ICRBefore]; // Note: Have the very last ICR here
      await (await yamatoDummy.bypassUpsert(toTyped(_pledgeAfter))).wait();

      const replacingPledgeAddr = await priorityRegistry.getRankedQueue(
        _ICRBefore,
        0
      );
      expect(replacingPledgeAddr).to.eq(ethers.constants.AddressZero);

      const pledgeLength2_After = await priorityRegistry.rankedQueueLen(
        _ICRBefore.div(100)
      );
      const pledgeLength3 = await priorityRegistry.rankedQueueLen(
        _ICRAfter.div(100)
      );
      expect(pledgeLength3).to.equal(1);
      expect(pledgeLength2_After).to.equal(pledgeLength2.sub(1));
    });
    it(`succeeds to upsert coll=0 debt/=0 pledge`, async function () {
      const pledgeLengthBefore = await priorityRegistry.rankedQueueLen(0);

      const _pledge = [
        BigNumber.from("0"),
        BigNumber.from("1"),
        true,
        address0,
        0,
      ];
      await (await yamatoDummy.bypassUpsert(toTyped(_pledge))).wait();

      const pledgeLengthAfter = await priorityRegistry.rankedQueueLen(0);

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.add(1));
    });
    it(`succeeds to upsert coll/=0 debt=0 pledge`, async function () {
      const pledgeLengthBefore = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );

      const _pledge = [
        BigNumber.from("1"),
        BigNumber.from("0"),
        true,
        address0,
        0,
      ];
      await (await yamatoDummy.bypassUpsert(toTyped(_pledge))).wait();

      const pledgeLengthAfter = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.add(1));
    });
  });

  describe("remove()", function () {
    it(`succeeds to remove non-zero pledge with less than 99 priority`, async function () {
      const _collBefore = BigNumber.from("0");
      const _debtBefore = BigNumber.from("410001000000000000000000");
      const _owner = address0;

      // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
      const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 3000];
      await (await yamatoDummy.bypassUpsert(toTyped(_sludgePledge))).wait();

      // Note: Sludge pledge is not swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
      const _nonSweptPledge = [
        _collBefore,
        BigNumber.from("0"),
        true,
        _owner,
        99,
      ];

      await expect(yamatoDummy.bypassRemove(toTyped(_nonSweptPledge))).to.be.not
        .reverted;
    });
    it(`fails to remove non-zero pledge with more than 100`, async function () {
      const _collBefore = BigNumber.from("0");
      const _debtBefore = BigNumber.from("410001000000000000000000");
      const _owner = address0;

      // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
      const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 3000];
      await (await yamatoDummy.bypassUpsert(toTyped(_sludgePledge))).wait();

      // Note: Sludge pledge is not swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
      const _nonSweptPledge = [
        _collBefore,
        BigNumber.from("0"),
        true,
        _owner,
        100,
      ];

      await expect(
        yamatoDummy.bypassRemove(toTyped(_nonSweptPledge))
      ).to.be.revertedWith(
        "Unintentional priority is given to the remove function."
      );
    });
    it(`succeeds to remove non-zero pledge with more than maxint-35`, async function () {
      const _collBefore = BigNumber.from("1000000000000000000");
      const _debtBefore = BigNumber.from("0");
      const _owner = address0;

      // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
      const _depositedPledge = [
        _collBefore,
        _debtBefore,
        true,
        _owner,
        BigNumber.from(2).pow(256).sub(1),
      ];
      await (await yamatoDummy.bypassUpsert(toTyped(_depositedPledge))).wait();

      // Note: Sludge pledge is not swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
      const _fullWithdrawPledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        _owner,
        BigNumber.from(2).pow(256).sub(1).sub(35),
      ];

      await expect(yamatoDummy.bypassRemove(toTyped(_fullWithdrawPledge))).to.be
        .not.reverted;
    });
    it(`fails to remove non-zero pledge with more than maxint-36`, async function () {
      const _collBefore = BigNumber.from("1000000000000000000");
      const _debtBefore = BigNumber.from("0");
      const _owner = address0;

      // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
      const _depositedPledge = [_collBefore, _debtBefore, true, _owner, 3000];
      await (await yamatoDummy.bypassUpsert(toTyped(_depositedPledge))).wait();

      // Note: Sludge pledge is not swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
      const _fullWithdrawPledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        _owner,
        BigNumber.from(2).pow(256).sub(1).sub(36),
      ];

      await expect(
        yamatoDummy.bypassRemove(toTyped(_fullWithdrawPledge))
      ).to.be.revertedWith(
        "Unintentional priority is given to the remove function."
      );
    });

    it(`succeeds to remove zero a.k.a. sludge pledge`, async function () {
      const _collBefore = BigNumber.from("0");
      const _debtBefore = BigNumber.from("410001000000000000000000");
      const _owner = address0;

      // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
      const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 30];
      await (await yamatoDummy.bypassUpsert(toTyped(_sludgePledge))).wait();

      // Note: Sludge pledge is swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
      const _sweptPledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        _owner,
        0,
      ];

      const pledgeLengthBefore = await priorityRegistry.rankedQueueLen(0);
      await (await yamatoDummy.bypassRemove(toTyped(_sweptPledge))).wait();
      const pledgeLengthAfter = await priorityRegistry.rankedQueueLen(0);

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.sub(1));
    });

    it(`succeeds to remove maxint a.k.a. an likely-impossible full-withdrawal pledge`, async function () {
      const _collBefore = BigNumber.from("1000000000000000000");
      const _debtBefore = BigNumber.from("0");
      const _owner = address0;

      // Note: newly deposited
      const _newPledge = [_collBefore, _debtBefore, true, _owner, 0];
      await (await yamatoDummy.bypassUpsert(toTyped(_newPledge))).wait();

      // Note: A deposited pledge has just been withdrawn and priority is maxint.
      const maxPriority = BigNumber.from(2).pow(256).sub(1).toString();

      // Note: This pledge is already compensated his coll to user.
      const _withdrawnPledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        _owner,
        maxPriority,
      ];

      const pledgeLengthBefore = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );
      await (await yamatoDummy.bypassRemove(toTyped(_withdrawnPledge))).wait();
      const pledgeLengthAfter = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.sub(1));
    });

    it(`succeeds to remove floor(maxint) a.k.a. a good full-withdrawal pledge`, async function () {
      const _collBefore = BigNumber.from("1000000000000000000");
      const _debtBefore = BigNumber.from("0");
      const _owner = address0;

      // Note: newly deposited
      const _newPledge = [_collBefore, _debtBefore, true, _owner, 0];
      await (await yamatoDummy.bypassUpsert(toTyped(_newPledge))).wait();

      // Note: A deposited pledge has just been withdrawn and priority is maxint.
      let maxPriority = BigNumber.from(2).pow(256).sub(1).toString();
      maxPriority = maxPriority.slice(0, maxPriority.length - 2) + "00";

      // Note: This pledge is already compensated his coll to user.
      const _withdrawnPledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        _owner,
        maxPriority,
      ];

      const pledgeLengthBefore = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );
      await (await yamatoDummy.bypassRemove(toTyped(_withdrawnPledge))).wait();
      const pledgeLengthAfter = await priorityRegistry.rankedQueueLen(
        BigNumber.from(2).pow(256).sub(1).div(100)
      );

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.sub(1));
    });
  });

  /*
    - rankedQueuePush
    - rankedQueuePop
    - rankedQueueSearchAndDestroy
    (- rankedQueueLen)
    (- rankedQueueTotalLen)
  */
  describe("rankedQueuePush()", function () {
    it(`increases length of queue`, async function () {
      const _owner1 = address0;
      const _coll1 = BigNumber.from(1e18 + "");
      const _debt1 = BigNumber.from(PRICE).mul(1e18 + "");
      const _icr1 = _coll1
        .mul(PRICE)
        .mul(10000)
        .div(_debt1)
        .div(1e18 + "");
      const _index = _icr1.div(100);

      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];

      let len1 = await priorityRegistry.rankedQueueLen(_index);
      let lenT1 = await priorityRegistry.rankedQueueTotalLen(_index);
      await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
      let len2 = await priorityRegistry.rankedQueueLen(_index);
      let lenT2 = await priorityRegistry.rankedQueueTotalLen(_index);
      expect(len1.add(1)).to.eq(len2);
      expect(lenT1.add(1)).to.eq(lenT2);
      expect(len2).to.eq(lenT2);
    });
  });
  describe("rankedQueuePop()", function () {
    let _index;
    let len1;
    let lenT1;
    let len2;
    let lenT2;
    let len3;
    let lenT3;
    beforeEach(async () => {
      const _owner1 = address0;
      const _coll1 = BigNumber.from(1e18 + "");
      const _debt1 = BigNumber.from(PRICE).mul(1e18 + "");
      const _icr1 = _coll1
        .mul(PRICE)
        .mul(10000)
        .div(_debt1)
        .div(1e18 + "");
      _index = _icr1.div(100);

      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];

      len1 = await priorityRegistry.rankedQueueLen(_index);
      lenT1 = await priorityRegistry.rankedQueueTotalLen(_index);
      await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
      len2 = await priorityRegistry.rankedQueueLen(_index);
      lenT2 = await priorityRegistry.rankedQueueTotalLen(_index);
    });
    it(`reduces length of queue`, async function () {
      await yamatoDummy.bypassRankedQueuePop(_index);

      len3 = await priorityRegistry.rankedQueueLen(_index);
      lenT3 = await priorityRegistry.rankedQueueTotalLen(_index);

      expect(len1.add(1)).to.eq(len2);
      expect(lenT1.add(1)).to.eq(lenT2);
      expect(len2).to.eq(lenT2);

      expect(len2.sub(1)).to.eq(len3);
      expect(lenT2).to.eq(lenT3); // delete sentence doesn't change array length
      expect(len3).to.eq(lenT3.sub(1)); // Total Length after pop will be bigger than real length
    });
    it.skip(
      "should skip an accidental 'effectiveICR is more than priority due to the price pump' pledge in the rank(priority)"
    );
  });
  describe("rankedQueueSearchAndDestroy()", function () {
    let _owner1;
    let _index;
    let _inputPledge1;
    let len1;
    let lenT1;
    let len2;
    let lenT2;
    let len3;
    let lenT3;
    beforeEach(async () => {
      _owner1 = address0;
      const _coll1 = BigNumber.from(1e18 + "");
      const _debt1 = BigNumber.from(PRICE).mul(1e18 + "");
      const _icr1 = _coll1
        .mul(PRICE)
        .mul(10000)
        .div(_debt1)
        .div(1e18 + "");
      _index = _icr1.div(100);

      _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
    });
    it(`reduces length of queue`, async function () {
      len1 = await priorityRegistry.rankedQueueLen(_index);
      lenT1 = await priorityRegistry.rankedQueueTotalLen(_index);
      await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
      len2 = await priorityRegistry.rankedQueueLen(_index);
      lenT2 = await priorityRegistry.rankedQueueTotalLen(_index);

      await yamatoDummy.bypassRankedQueueSearchAndDestroy(_index, 0);

      len3 = await priorityRegistry.rankedQueueLen(_index);
      lenT3 = await priorityRegistry.rankedQueueTotalLen(_index);

      expect(len1.add(1)).to.eq(len2);
      expect(lenT1.add(1)).to.eq(lenT2);
      expect(len2).to.eq(lenT2);

      expect(len2.sub(1)).to.eq(len3);
      expect(lenT2).to.eq(lenT3); // delete sentence doesn't change array length
      expect(len3).to.eq(lenT3.sub(1)); // Total Length after pop will be bigger than real length
    });

    describe("Context - scenario test", function () {
      beforeEach(async () => {
        _owner1 = address0;
        const _coll1 = BigNumber.from(1e18 + "");
        const _debt1 = BigNumber.from(PRICE.div(1e18 + "")).mul(1e18 + "");
        const _icr1 = _coll1
          .mul(PRICE.div(1e18 + ""))
          .mul(10000)
          .div(_debt1)
          .div(1e18 + "");
        _index = _icr1.div(100);
        _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
      });
      it("push1 pop1 pop? = fail", async function () {
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        let _nextout1 = await priorityRegistry.rankedQueueNextout(_index);
        await yamatoDummy.bypassRankedQueuePop(_index);
        let _nextout2 = await priorityRegistry.rankedQueueNextout(_index);
        await yamatoDummy.bypassRankedQueuePop(_index);
        let _nextout3 = await priorityRegistry.rankedQueueNextout(_index);
        expect(_nextout2).to.eq(_nextout1.add(1));
        expect(_nextout3).to.eq(_nextout2);
      });
      it("push1 pop1 destroy1 = fail", async function () {
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        await yamatoDummy.bypassRankedQueuePop(_index);

        let _deleteNextout = await priorityRegistry.rankedQueueNextout(_index);
        await expect(
          yamatoDummy.bypassRankedQueueSearchAndDestroy(_index, _deleteNextout)
        ).to.be.revertedWithPanic(0x32);
      });
      it("push1 push2 push3 pop1 push4 push5 destroy2 pop3 destroy4 pop5 push1 push2 destroy1 pop2 = success", async function () {
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));

        await yamatoDummy.bypassRankedQueuePop(_index);

        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));

        await yamatoDummy.bypassRankedQueueSearchAndDestroy(
          _index,
          await priorityRegistry.rankedQueueNextout(_index)
        );

        await yamatoDummy.bypassRankedQueuePop(_index);

        await yamatoDummy.bypassRankedQueueSearchAndDestroy(
          _index,
          await priorityRegistry.rankedQueueNextout(_index)
        );

        await yamatoDummy.bypassRankedQueuePop(_index);

        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));

        await yamatoDummy.bypassRankedQueueSearchAndDestroy(
          _index,
          await priorityRegistry.rankedQueueNextout(_index)
        );

        await yamatoDummy.bypassRankedQueuePop(_index);

        expect(await priorityRegistry.rankedQueueLen(_index)).to.eq(0);
      });
    });
  });

  describe("getRedeemablesCap()", function () {
    it(`should return some value with rank 101`, async function () {
      const targetRank = 101;
      const _coll1 = BigNumber.from(targetRank).mul(1e16 + "");
      const _debt1 = BigNumber.from(410000).mul(1e18 + ""); // PRICE=410000, ICR=100%
      const _prio1 = BigNumber.from(100 + "");
      for (var i = 0; i < 10; i++) {
        await (
          await yamatoDummy.bypassUpsert(
            toTyped([
              _coll1,
              _debt1,
              true,
              await accounts[i].getAddress(),
              _prio1,
            ])
          )
        ).wait();
      }
      for (var i = 10; i < 20; i++) {
        await (
          await yamatoDummy.bypassUpsert(
            toTyped([
              _coll1,
              _debt1.div(2),
              true,
              await accounts[i].getAddress(),
              _prio1,
            ])
          )
        ).wait();
      }

      const cap = await priorityRegistry.getRedeemablesCap();

      expect(cap).to.equal(
        _debt1.mul(BigNumber.from(130).sub(targetRank)).div(30).mul(10)
      ); // Note: 100-130 range logic
    });

    it(`should return some value with rank 99`, async function () {
      const targetRank = 99;
      const _coll1 = BigNumber.from(targetRank).mul(1e16 + "");
      const _debt1 = BigNumber.from(410000).mul(1e18 + ""); // PRICE=410000, ICR=100%
      const _prio1 = BigNumber.from(100 + "");
      for (var i = 0; i < 10; i++) {
        await (
          await yamatoDummy.bypassUpsert(
            toTyped([
              _coll1,
              _debt1,
              true,
              await accounts[i].getAddress(),
              _prio1,
            ])
          )
        ).wait();
      }
      for (var i = 10; i < 20; i++) {
        await (
          await yamatoDummy.bypassUpsert(
            toTyped([
              _coll1,
              _debt1.div(2),
              true,
              await accounts[i].getAddress(),
              _prio1,
            ])
          )
        ).wait();
      }

      const cap = await priorityRegistry.getRedeemablesCap();

      expect(cap).to.equal(_debt1.mul(targetRank).div(100).mul(10)); // Note: -100 range logic
    });

    it(`should return some value with destroyed queue`, async function () {
      const targetRank = 100;
      const _coll1 = BigNumber.from(targetRank).mul(1e16 + "");
      const _debt1 = BigNumber.from(410000).mul(1e18 + ""); // PRICE=410000, ICR=100%
      const _prio1 = BigNumber.from(100 + "");
      for (var i = 0; i < 10; i++) {
        await (
          await yamatoDummy.bypassUpsert(
            toTyped([
              _coll1,
              _debt1,
              true,
              await accounts[i].getAddress(),
              _prio1,
            ])
          )
        ).wait();
      }
      for (var i = 10; i < 20; i++) {
        await (
          await yamatoDummy.bypassUpsert(
            toTyped([
              _coll1,
              _debt1.div(2),
              true,
              await accounts[i].getAddress(),
              _prio1,
            ])
          )
        ).wait();
      }

      await (
        await yamatoDummy.bypassRankedQueueSearchAndDestroy(100, 5)
      ).wait();

      const cap = await priorityRegistry.getRedeemablesCap();

      expect(cap).to.equal(_debt1.mul(targetRank).div(100).mul(9)); // Note: -100 range logic AND a deleted pledge
    });
  });
  describe("getSweepablesCap()", function () {
    it.skip(`should return some value`, async function () {
      const _coll1 = BigNumber.from(0 + "");
      const _debt1 = BigNumber.from(410000).mul(1e18 + "");
      const _prio1 = BigNumber.from(0 + "");
      for (var i = 0; i < 10; i++) {
        await (
          await yamatoDummy.bypassUpsert(
            toTyped([
              _coll1,
              _debt1,
              true,
              await accounts[i].getAddress(),
              _prio1,
            ])
          )
        ).wait();
      }
      const cap = await priorityRegistry.getSweepablesCap();

      expect(cap).to.equal(_debt1.mul(10));
    });
  });
});

function toTyped(pledgeInput) {
  return {
    coll: pledgeInput[0],
    debt: pledgeInput[1],
    isCreated: pledgeInput[2],
    owner: pledgeInput[3],
    priority: pledgeInput[4],
  };
}
