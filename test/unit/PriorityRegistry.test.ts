import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import {
  CurrencyOS,
  FeePool,
  PledgeLib__factory,
  PriceFeed,
  Yamato,
  YamatoDummy,
  YamatoDummy__factory,
  PriorityRegistry,
  PriorityRegistryV4,
  PriorityRegistry__factory,
  PriorityRegistryV4__factory,
  CJPY,
} from "../../typechain";
import { getFakeProxy, getLinkedProxy } from "../../src/testUtil";
import { describe } from "mocha";

chai.use(smock.matchers);
chai.use(solidity);

describe("contract PriorityRegistry", function () {
  let mockYamato: FakeContract<Yamato>;
  let mockCurrencyOS: FakeContract<CurrencyOS>;
  let mockFeePool: FakeContract<FeePool>;
  let mockFeed: FakeContract<PriceFeed>;
  let mockCJPY: FakeContract<CJPY>;
  let yamatoDummy: YamatoDummy;
  let priorityRegistryWithYamatoMock: PriorityRegistryV4;
  let priorityRegistry: PriorityRegistryV4;
  let accounts: Signer[];
  let address0: string;
  const PRICE = BigNumber.from(410000).mul(1e18 + "");

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    address0 = await accounts[0].getAddress();

    mockFeed = await getFakeProxy<PriceFeed>("PriceFeed");
    mockFeePool = await getFakeProxy<FeePool>("FeePool");
    mockCurrencyOS = await getFakeProxy<CurrencyOS>("CurrencyOS");
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
    mockFeed.lastGoodPrice.returns(PRICE);
    mockCurrencyOS.feed.returns(mockFeed.address);
    mockCurrencyOS.feePool.returns(mockFeePool.address);
    mockCurrencyOS.currency.returns(mockCJPY.address);
    mockYamato.feed.returns(mockFeed.address);

    /*
        For unit tests
      */
    priorityRegistryWithYamatoMock = await getLinkedProxy<
      PriorityRegistryV4,
      PriorityRegistryV4__factory
    >("PriorityRegistry", [mockYamato.address], ["PledgeLib"]);

    /*
        For onlyYamato tests
      */
    yamatoDummy = await yamatoDummyContractFactory.deploy(
      mockCurrencyOS.address
    );

    priorityRegistry = await getLinkedProxy<
      PriorityRegistryV4,
      PriorityRegistryV4__factory
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
      const pledgeLengthBefore = await priorityRegistry.pledgeLength();

      const _pledge = [
        BigNumber.from("100000000000000000"),
        BigNumber.from("0"),
        true,
        address0,
        0,
      ];
      await (await yamatoDummy.bypassUpsert(toTyped(_pledge))).wait();

      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

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
      const pledgeLength1 = await priorityRegistry.pledgeLength();
      await (await yamatoDummy.bypassUpsert(toTyped(_pledgeBefore))).wait();
      const pledgeLength2 = await priorityRegistry.pledgeLength();
      expect(pledgeLength2).to.eq(pledgeLength1.add(1));

      const _collAfter = BigNumber.from("0");
      const _debtAfter = _debtBefore;
      const _pledgeAfter = [_collAfter, _debtAfter, true, address0, _ICRBefore]; // Note: Have the very last ICR here
      await (await yamatoDummy.bypassUpsert(toTyped(_pledgeAfter))).wait();

      const replacingPledge = await priorityRegistry.getRankedQueue(
        _ICRBefore,
        0
      );
      expect(replacingPledge.owner).to.eq(ethers.constants.AddressZero);

      const pledgeLength3 = await priorityRegistry.pledgeLength();
      expect(pledgeLength3).to.equal(pledgeLength2);
    });
    it(`succeeds to upsert coll=0 debt/=0 pledge`, async function () {
      const pledgeLengthBefore = await priorityRegistry.pledgeLength();

      const _pledge = [
        BigNumber.from("0"),
        BigNumber.from("1"),
        true,
        address0,
        0,
      ];
      await (await yamatoDummy.bypassUpsert(toTyped(_pledge))).wait();

      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.add(1));
    });
    it(`succeeds to upsert coll/=0 debt=0 pledge`, async function () {
      const pledgeLengthBefore = await priorityRegistry.pledgeLength();

      const _pledge = [
        BigNumber.from("1"),
        BigNumber.from("0"),
        true,
        address0,
        0,
      ];
      await (await yamatoDummy.bypassUpsert(toTyped(_pledge))).wait();

      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

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

      const pledgeLengthBefore = await priorityRegistry.pledgeLength();
      await (await yamatoDummy.bypassRemove(toTyped(_sweptPledge))).wait();
      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

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

      const pledgeLengthBefore = await priorityRegistry.pledgeLength();
      await (await yamatoDummy.bypassRemove(toTyped(_withdrawnPledge))).wait();
      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

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

      const pledgeLengthBefore = await priorityRegistry.pledgeLength();
      await (await yamatoDummy.bypassRemove(toTyped(_withdrawnPledge))).wait();
      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.sub(1));
    });
  });

  describe("popRedeemable()", function () {
    it(`fails to call it from EOA`, async function () {
      await expect(priorityRegistry.popRedeemable()).to.be.revertedWith(
        "You are not Yamato contract."
      );
    });
    it(`fails to run in the all-sludge state`, async function () {
      await expect(yamatoDummy.bypassPopRedeemable()).to.be.revertedWith(
        "pledgeLength=0 :: Need to upsert at least once."
      );
    });
    it(`fails to pop the zero pledge because it isn't redeemable.`, async function () {
      const _owner1 = address0;
      const _coll1 = BigNumber.from("0");
      const _debt1 = BigNumber.from("410001000000000000000000");
      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
      await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge1))).wait();

      expect(await priorityRegistry.pledgeLength()).to.eq(1);

      await expect(yamatoDummy.bypassPopRedeemable()).to.be.revertedWith(
        "licr=0 :: Need to upsert at least once."
      );
    });

    it(`succeeds to fetch even by account 3 of hardhat`, async function () {
      const _owner1 = await accounts[3].getAddress();
      const _coll1 = BigNumber.from("1000000000000000000");
      const _debt1 = BigNumber.from("410001000000000000000000");
      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 1];

      await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge1))).wait();

      const licr1 = await priorityRegistry.LICR();
      const pledge1 = await priorityRegistry.getRankedQueue(licr1, 0);

      await (await yamatoDummy.bypassPopRedeemable()).wait();

      const licr2 = await priorityRegistry.LICR();
      const pledge2 = await priorityRegistry.getRankedQueue(licr2, 0);

      expect(pledge1.owner).to.eq(_owner1);
      expect(pledge2.owner).to.eq(ethers.constants.AddressZero);
      expect(licr2).to.eq(99); // Note: No traversal by popRedeemable. It must be done by upsert.
    });

    describe("Context of priority", function () {
      it(`succeeds to get the lowest pledge with coll>0 debt>0 priority=0`, async function () {
        const _owner1 = address0;
        const _coll1 = BigNumber.from("1000000000000000000");
        const _debt1 = BigNumber.from("410001000000000000000000");
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];

        await expect(yamatoDummy.bypassUpsert(toTyped(_inputPledge1))).to.be.not
          .reverted;
      });

      it(`fails to get the lowest but MAX_INT pledge \(=new pledge / coll>0 debt=0 priority=0\)`, async function () {
        const _owner1 = address0;
        const _coll1 = BigNumber.from("1000000000000000000");
        const _debt1 = BigNumber.from("0");
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];

        await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge1))).wait();

        await expect(yamatoDummy.bypassPopRedeemable()).to.be.revertedWith(
          "You can't redeem if redeemable candidate is more than MCR."
        );
      });

      it(`fails to get the lowest but MCR pledge`, async function () {
        const _owner1 = address0;
        const _coll1 = BigNumber.from("1000000000000000000");
        const _debt1 = _coll1
          .mul(PRICE)
          .mul(10)
          .div(13)
          .div(1e18 + "");
        console.log(`_debt1:${_debt1}`);
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 13000];

        await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge1))).wait();

        await expect(yamatoDummy.bypassPopRedeemable()).to.be.revertedWith(
          "You can't redeem if redeemable candidate is more than MCR."
        );
      });

      it.only(`succeeds to get the lowest pledge with priority\>0`, async function () {
        const _owner1 = address0;
        const _coll1 = BigNumber.from("1000000000000000000");
        const _debt1 = BigNumber.from("410001000000000000000000");
        const _owner2 = await accounts[1].getAddress();
        const _coll2 = BigNumber.from("2000000000000000000");
        const _debt2 = BigNumber.from("410001000000000000000000");
        const _owner3 = await accounts[2].getAddress();
        const _debt3 = _debt1.add("41001000000000000000000");
        const _owner4 = await accounts[3].getAddress();
        const _debt4 = _debt2.add("41002000000000000000000");
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 1];
        const _inputPledge2 = [_coll2, _debt2, true, _owner2, 1];
        const _inputPledge3 = [_coll1, _debt3, true, _owner3, 99];
        const _inputPledge4 = [_coll2, _debt4, true, _owner4, 199];

        await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge1))).wait();
        await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge2))).wait();
        await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge3))).wait();
        await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge4))).wait();

        console.log(_owner1, _owner2, _owner3, _owner4);
        const licr1 = await priorityRegistry.LICR();
        const pledge1 = await priorityRegistry.getRankedQueue(licr1, 0);
        console.log(licr1, pledge1.owner, pledge1.priority+"");

        await (await yamatoDummy.bypassPopRedeemable()).wait();

        const licr2 = await priorityRegistry.LICR();
        const pledge2 = await priorityRegistry.getRankedQueue(licr2, 0);
        console.log(licr2, pledge2.owner, pledge2.priority+"");

        expect(pledge1.owner).to.eq(_owner3);
        expect(pledge2.owner).to.eq(ethers.constants.AddressZero);
      });
    });
  });

  describe("popSweepable()", function () {
    it(`fails to call it from EOA`, async function () {
      await expect(priorityRegistry.popSweepable()).to.be.revertedWith(
        "You are not Yamato contract."
      );
    });

    it(`fails to run if there're no sludge pledge`, async function () {
      await expect(yamatoDummy.bypassPopSweepable()).to.be.revertedWith(
        "Pop must not be done for empty queue"
      );
    });

    it(`fails to fetch the zero pledge`, async function () {
      const _owner1 = address0;
      const _coll1 = BigNumber.from("0");
      const _debt1 = BigNumber.from("410001000000000000000000");
      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
      await (await yamatoDummy.bypassUpsert(toTyped(_inputPledge1))).wait();

      const nextSweepableBefore = await priorityRegistry.getRankedQueue(
        0,
        await priorityRegistry.rankedQueueNextout(0)
      );
      await (await yamatoDummy.bypassPopSweepable()).wait();
      const nextSweepableAfter = await priorityRegistry.getRankedQueue(
        0,
        await priorityRegistry.rankedQueueNextout(0)
      );

      expect(nextSweepableBefore.coll).to.eq(_coll1);
      expect(nextSweepableBefore.debt).to.eq(_debt1);
      expect(nextSweepableBefore.owner).to.eq(_owner1);
      expect(nextSweepableAfter.coll).to.eq(0);
      expect(nextSweepableAfter.debt).to.eq(0);
      expect(nextSweepableAfter.isCreated).to.eq(false);
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
        const _debt1 = BigNumber.from(PRICE).mul(1e18 + "");
        const _icr1 = _coll1
          .mul(PRICE)
          .mul(10000)
          .div(_debt1)
          .div(1e18 + "");
        _index = _icr1.div(100);
        _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
      });
      it("push1 pop1 pop? = fail", async function () {
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        await yamatoDummy.bypassRankedQueuePop(_index);
        await expect(
          yamatoDummy.bypassRankedQueuePop(_index)
        ).to.be.revertedWith("Pop must not be done for empty queue");
      });
      it("push1 pop1 destroy1 = fail", async function () {
        await yamatoDummy.bypassRankedQueuePush(_index, toTyped(_inputPledge1));
        await yamatoDummy.bypassRankedQueuePop(_index);
        await expect(
          yamatoDummy.bypassRankedQueueSearchAndDestroy(
            _index,
            await priorityRegistry.rankedQueueNextout(_index)
          )
        ).to.be.revertedWith("Searched queue must have at least an item");
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
      const _coll1 = BigNumber.from(101).mul(1e16 + "");
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

      expect(cap).to.equal("3566999999999999999999997");
    });

    it(`should return some value with rank 99`, async function () {
      const _coll1 = BigNumber.from(99).mul(1e16 + "");
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

      expect(cap).to.equal("3653100000000000000000000");
    });

    it(`should return some value with destroyed queue`, async function () {
      const _coll1 = BigNumber.from(100).mul(1e16 + "");
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

      expect(cap).to.equal("3280000000000000000000000");
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
