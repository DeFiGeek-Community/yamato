import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import {
  CjpyOS,
  PledgeLib__factory,
  PriceFeed,
  Yamato,
  Yamato__factory,
} from "../../typechain";

chai.use(smock.matchers);
chai.use(solidity);

describe("contract PriorityRegistry", function () {
  let mockYamato: FakeContract<Yamato>;
  let mockCjpyOS: FakeContract<CjpyOS>;
  let mockFeed: FakeContract<PriceFeed>;
  let yamato;
  let priorityRegistryWithYamatoMock;
  let priorityRegistry;
  let accounts: Signer[];
  let address0: string;
  const PRICE = BigNumber.from(300000).mul(1e18+"");

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    address0 = await accounts[0].getAddress();

    mockFeed = await smock.fake<PriceFeed>("PriceFeed");
    mockCjpyOS = await smock.fake<CjpyOS>("CjpyOS");
    const PledgeLib = (
      await (<PledgeLib__factory>(
        await ethers.getContractFactory("PledgeLib")
      )).deploy()
    ).address;
    const yamatoContractFactory = <Yamato__factory>(
      await ethers.getContractFactory("Yamato", {
        libraries: { PledgeLib },
      })
    );
    /* BEGIN DIRTY-FIX
    !!TODO!!
    The code that this block contains is
    for avoiding bugs of smock, hardhat-ethers or ethers
    (I think ethers is suspicious.)
    and must be as following if there is no bug:
    ```
    mockYamato = await smock.fake<Yamato>(yamatoContractFactory);
    ```

    The bugs are that some of the hardhat-ethers methods, like getContractFactory,
    return wrong ethers objects, and the smock library can not handle that wrong object and raises an error.
    That reproduces when using library linking.

    The smock library falls in error when it runs the code following [this line](
    https://github.com/defi-wonderland/smock/blob/v2.0.7/src/factories/ethers-interface.ts#L22).
    This patch allows the function to return from [this line](
    https://github.com/defi-wonderland/smock/blob/v2.0.7/src/factories/ethers-interface.ts#L16)
    before falling error.

    */
    const yamatoContract = await yamatoContractFactory.deploy(
      mockCjpyOS.address
    );
    await yamatoContract.deployed();
    mockYamato = await smock.fake<Yamato>("Yamato");
    /* END DIRTY-FIX */

    mockFeed.fetchPrice.returns(PRICE);
    mockCjpyOS.feed.returns(mockFeed.address);
    mockYamato.feed.returns(mockFeed.address);

    /*
        For unit tests
      */
    priorityRegistryWithYamatoMock = await (
      await ethers.getContractFactory("PriorityRegistry", {
        libraries: { PledgeLib },
      })
    ).deploy(mockYamato.address);

    /*
        For onlyYamato tests
      */
    yamato = await yamatoContractFactory.deploy(mockCjpyOS.address);
    priorityRegistry = await (
      await ethers.getContractFactory("PriorityRegistry", {
        libraries: { PledgeLib },
      })
    ).deploy(yamato.address);
    await (await yamato.setPriorityRegistry(priorityRegistry.address)).wait();
  });

  describe("upsert()", function () {
    it(`fails due to the call from EOA.`, async function () {
      /*
                  struct Pledge {
                      uint coll;
                      uint debt;
                      bool isCreated;
                      address owner;
                      uint lastUpsertedTimeICRpertenk;
                  }
              */
      const _pledge = [
        BigNumber.from("100000000000000000"),
        BigNumber.from("30000100000000000000000"),
        true,
        address0,
        0,
      ];

      await expect(
        priorityRegistryWithYamatoMock.connect(accounts[1]).upsert(_pledge)
      ).to.be.revertedWith("You are not Yamato contract.");
    });

    it(`fails to upsert logless \(coll=0 debt=0 lastUpsertedTimeICRpertenk=0\) pledge`, async function () {
      const _pledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        address0,
        0,
      ];
      await expect(yamato.bypassUpsert(_pledge)).to.be.revertedWith(
        "Arithmetic Error: Yamato doesn't define the ICR of coll=0 debt=0 pledge."
      );
    });

    it(`fails to upsert logful \(coll=0 debt=0 lastUpsertedTimeICRpertenk/=0\) pledge because such full-withdrawn pledge has to be removed`, async function () {
      // Note: deposit->noBorrow->withdrawal scenario
      const _pledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        address0,
        BigNumber.from(
          "115792089237316195423570985008687907853269984665640564039457584007913129639935"
        ),
      ];
      await expect(yamato.bypassUpsert(_pledge)).to.be.revertedWith(
        "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
      );
    });

    it(`succeeds to be called from Yamato.`, async function () {
      const pledgeLengthBefore = await priorityRegistry.pledgeLength();

      const _pledge = [
        BigNumber.from("100000000000000000"),
        BigNumber.from("30000100000000000000000"),
        true,
        address0,
        0,
      ];
      await (await yamato.bypassUpsert(_pledge)).wait();

      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.add(1));
    });

    it(`succeeds to replace an existing item with ICR=0.`, async function () {
      const pledgeLengthBefore = await priorityRegistry.pledgeLength();

      const _collBefore = BigNumber.from("100000000000000000");
      const _debtBefore = BigNumber.from("30000100000000000000000");
      const _ICRDefault = BigNumber.from("0");
      const _ICRBefore = _collBefore.mul(PRICE).mul(10000).div(_debtBefore).div(1e18+"");
      expect(_ICRBefore).to.eq("9999");
      const _pledgeBefore = [
        _collBefore,
        _debtBefore,
        true,
        address0,
        _ICRDefault,
      ];
      await (await yamato.bypassUpsert(_pledgeBefore)).wait();

      const _collAfter = BigNumber.from("0");
      const _debtAfter = _debtBefore;
      const _pledgeAfter = [_collAfter, _debtAfter, true, address0, _ICRBefore]; // Note: Have the very last ICR here
      await (await yamato.bypassUpsert(_pledgeAfter)).wait();

      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.add(1));
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
      await (await yamato.bypassUpsert(_pledge)).wait();

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
      await (await yamato.bypassUpsert(_pledge)).wait();

      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.add(1));
    });
    it(`succeeds to update currentLICR`, async function () {
      // TODO
    });
    it(`succeeds to back-scan the very next currentLICR`, async function () {
      // TODO
    });
  });

  describe("remove()", function () {
    it(`fails to remove non-zero pledge`, async function () {
      const _collBefore = BigNumber.from("0");
      const _debtBefore = BigNumber.from("300001000000000000000000");
      const _owner = address0;

      // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
      const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 3000];
      await (await yamato.bypassUpsert(_sludgePledge)).wait();

      // Note: Sludge pledge is not swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
      const _nonSweptPledge = [
        _collBefore,
        BigNumber.from("0"),
        true,
        _owner,
        1,
      ];

      await expect(yamato.bypassRemove(_nonSweptPledge)).to.be.revertedWith(
        "Unintentional lastUpsertedTimeICRpertenk is given to the remove function."
      );
    });

    it(`succeeds to remove zero a.k.a. sludge pledge`, async function () {
      const _collBefore = BigNumber.from("0");
      const _debtBefore = BigNumber.from("300001000000000000000000");
      const _owner = address0;

      // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
      const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 3000];
      await (await yamato.bypassUpsert(_sludgePledge)).wait();

      // Note: Sludge pledge is swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
      const _sweptPledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        _owner,
        0,
      ];

      const pledgeLengthBefore = await priorityRegistry.pledgeLength();
      await (await yamato.bypassRemove(_sweptPledge)).wait();
      const pledgeLengthAfter = await priorityRegistry.pledgeLength();

      expect(pledgeLengthAfter).to.eq(pledgeLengthBefore.sub(1));
    });

    it(`succeeds to remove maxint a.k.a. full-withdrawal pledge`, async function () {
      const _collBefore = BigNumber.from("1000000000000000000");
      const _debtBefore = BigNumber.from("0");
      const _owner = address0;

      // Note: newly deposited
      const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 0];
      await (await yamato.bypassUpsert(_sludgePledge)).wait();

      // Note: A deposited pledge has just been withdrawn and lastUpsertedTimeICRpertenk is maxint.
      const _withdrawnPledge = [
        BigNumber.from("0"),
        BigNumber.from("0"),
        true,
        _owner,
        BigNumber.from(2).pow(256).sub(1),
      ];

      const pledgeLengthBefore = await priorityRegistry.pledgeLength();
      await (await yamato.bypassRemove(_withdrawnPledge)).wait();
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
      await expect(yamato.bypassPopRedeemable()).to.be.revertedWith(
        "pledgeLength=0 :: Need to upsert at least once."
      );
    });
    it(`fails to pop the zero pledge because it isn't redeemable.`, async function () {
      const _owner1 = address0;
      const _coll1 = BigNumber.from("0");
      const _debt1 = BigNumber.from("300001000000000000000000");
      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
      await (await yamato.bypassUpsert(_inputPledge1)).wait();

      expect(await priorityRegistry.pledgeLength()).to.eq(1);

      await expect( yamato.bypassPopRedeemable() ).to.be.revertedWith("licr=0 :: Need to upsert at least once.")
    });

    it(`succeeds to fetch even by account 3`, async function () {
      const _owner1 = await accounts[3].getAddress();
      const _coll1 = BigNumber.from("1000000000000000000");
      const _debt1 = BigNumber.from("300001000000000000000000");
      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];

      await (await yamato.bypassUpsert(_inputPledge1)).wait();

      const nextRedeemableBefore = await priorityRegistry.nextRedeemable();
      await (await yamato.bypassPopRedeemable()).wait();

      expect(nextRedeemableBefore.coll).to.eq(_coll1);
      expect(nextRedeemableBefore.debt).to.eq(_debt1);
      expect(nextRedeemableBefore.owner).to.eq(_owner1);
    });

    describe("Context of lastUpsertedTimeICRpertenk", function () {
      it(`succeeds to get the lowest pledge with lastUpsertedTimeICRpertenk=0`, async function () {
        const _owner1 = address0;
        const _coll1 = BigNumber.from("1000000000000000000");
        const _debt1 = BigNumber.from("300001000000000000000000");
        const _owner2 = await accounts[1].getAddress();
        const _coll2 = BigNumber.from("2000000000000000000");
        const _debt2 = BigNumber.from("300001000000000000000000");
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
        const _inputPledge2 = [_coll2, _debt2, true, _owner2, 0];

        await (await yamato.bypassUpsert(_inputPledge1)).wait();
        await (await yamato.bypassUpsert(_inputPledge2)).wait();

        const nextRedeemableBefore = await priorityRegistry.nextRedeemable();
        await (await yamato.bypassPopRedeemable()).wait();
        const nextRedeemableAfter = await priorityRegistry.nextRedeemable();

        expect(nextRedeemableBefore.coll).to.eq(_coll1);
        expect(nextRedeemableBefore.debt).to.eq(_debt1);
        expect(nextRedeemableBefore.owner).to.eq(_owner1);
        expect(
          nextRedeemableAfter.coll
            .mul(PRICE)
            .mul(100)
            .div(nextRedeemableAfter.debt)
        ).to.gte(await yamato.MCR());
      });
      it(`succeeds to get the lowest pledge with lastUpsertedTimeICRpertenk\>0`, async function () {
        const _owner1 = address0;
        const _coll1 = BigNumber.from("1000000000000000000");
        const _debt1 = BigNumber.from("300001000000000000000000");
        const _owner2 = await accounts[1].getAddress();
        const _coll2 = BigNumber.from("2000000000000000000");
        const _debt2 = BigNumber.from("300001000000000000000000");
        const _debt3 = _debt1.add("30001000000000000000000");
        const _debt4 = _debt2.add("30002000000000000000000");
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
        const _inputPledge2 = [_coll2, _debt2, true, _owner2, 0];
        const _inputPledge3 = [_coll1, _debt3, true, _owner1, 9999];
        const _inputPledge4 = [_coll2, _debt4, true, _owner2, 19999];

        await (await yamato.bypassUpsert(_inputPledge1)).wait();
        await (await yamato.bypassUpsert(_inputPledge2)).wait();
        await (await yamato.bypassUpsert(_inputPledge3)).wait();
        await (await yamato.bypassUpsert(_inputPledge4)).wait();

        const nextRedeemableBefore = await priorityRegistry.nextRedeemable();
        await (await yamato.bypassPopRedeemable()).wait();
        const nextRedeemableAfter = await priorityRegistry.nextRedeemable();

        expect(nextRedeemableBefore.coll).to.eq(_coll1);
        expect(nextRedeemableBefore.debt).to.eq(_debt3);
        expect(nextRedeemableBefore.owner).to.eq(_owner1);
        expect(nextRedeemableAfter.coll).to.eq(0);
        expect(nextRedeemableAfter.debt).to.eq(0);
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
      await expect(yamato.bypassPopSweepable()).to.be.revertedWith(
        "There're no sweepable pledges."
      );
    });

    it(`fails to fetch the zero pledge`, async function () {
      const _owner1 = address0;
      const _coll1 = BigNumber.from("0");
      const _debt1 = BigNumber.from("300001000000000000000000");
      const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0];
      await (await yamato.bypassUpsert(_inputPledge1)).wait();

      const nextSweepableBefore = await priorityRegistry.nextSweepable();
      await (await yamato.bypassPopSweepable()).wait();
      const nextSweepableAfter = await priorityRegistry.nextSweepable();

      expect(nextSweepableBefore.coll).to.eq(_coll1);
      expect(nextSweepableBefore.debt).to.eq(_debt1);
      expect(nextSweepableBefore.owner).to.eq(_owner1);
      expect(nextSweepableAfter.coll).to.eq(0);
      expect(nextSweepableAfter.debt).to.eq(0);
      expect(nextSweepableAfter.isCreated).to.eq(false);
    });
  });
});
