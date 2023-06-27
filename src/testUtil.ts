import { ethers, upgrades, artifacts } from "hardhat";
import { BaseContract, ContractFactory, BigNumber } from "ethers";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { getDeploymentAddressPath, getCurrentNetwork } from "./deployUtil";
import { genABI } from "./genABI";
import {
  getLatestContractName,
  upgradeLinkedProxy,
  upgradeProxy,
} from "./upgradeUtil";
import chalk from "chalk";
import {
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "./deployUtil";
import { PriorityRegistryV6 } from "../typechain";

// @dev UUPS
export async function getFakeProxy<T extends BaseContract>(
  contractName: string
): Promise<FakeContract<T>> {
  let mock = await smock.fake<T>(contractName);
  if (typeof mock.upgradeTo !== "function")
    throw new Error(
      `${contractName} has to inherit UUPSUpgradeable to have upgradeTo().`
    );
  const proxy = await (
    await ethers.getContractFactory("ERC1967Proxy")
  ).deploy(mock.address, BigNumber.from(0)); // from @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol
  mock.attach(proxy.address);
  return mock;
}

export async function getProxy<
  T extends BaseContract,
  S extends ContractFactory
>(
  contractName: string,
  args: any,
  versionSpecification?: number | undefined
): Promise<T> {
  let contractFactory: S;
  let defaultInst: T;

  // TODO: V2 Flag
  let implName;
  if (versionSpecification) {
    contractFactory = <S>(
      await ethers.getContractFactory(`${contractName}V${versionSpecification}`)
    );
    implName = "";
  } else {
    contractFactory = <S>await ethers.getContractFactory(contractName);
    implName = getLatestContractName(contractName);
  }

  defaultInst = <T>(
    await upgrades.deployProxy(contractFactory, args, { kind: "uups" })
  );

  if (implName.length == 0) {
    return defaultInst;
  } else {
    // console.log(`${implName} is going to be deployed to ERC1967Proxy...`);

    const inst: T = <T>await upgradeProxy(defaultInst.address, implName);
    console.log(
      chalk.gray(
        `        [success] ${implName}=${inst.address} is upgraded to ERC1967Proxy`
      )
    );
    return inst;
  }
}

export async function getLinkedProxy<
  T extends BaseContract,
  S extends ContractFactory
>(
  contractName: string,
  args: Array<any>,
  libralies: string[],
  versionSpecification?: number | undefined
): Promise<T> {
  // console.log(`getLinkedProxy: deploying libs...`);
  let Libraries = {};
  for (var i = 0; i < libralies.length; i++) {
    let libraryName = libralies[i];
    Libraries[libraryName] = (await deployLibrary(libraryName)).address;
  }

  let contractFactory: S = <S>(
    await getLinkedContractFactory(contractName, Libraries)
  );
  const defaultInst: T = <T>await upgrades.deployProxy(contractFactory, args, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });

  let implName;
  if (versionSpecification) {
    implName = `${contractName}V${versionSpecification}`;
  } else {
    implName = getLatestContractName(contractName);
  }

  if (implName.length == 0) {
    return defaultInst;
  } else {
    // console.log(`${implName} is going to be deployed to ERC1967Proxy...`);

    const inst: T = <T>(
      await upgradeLinkedProxy(defaultInst.address, implName, libralies)
    );
    console.log(
      chalk.gray(
        `        [success] ${implName}=${inst.address} is upgraded to ERC1967Proxy`
      )
    );
    return inst;
  }
}

export async function deployLibrary(libraryName) {
  const filepath = getDeploymentAddressPath(libraryName);
  let _LibAddr;
  try {
    _LibAddr = readFileSync(filepath).toString();
  } catch (e) {
    // console.log("Non-cacheable environment. Skip cache.");
  }

  if (
    (getCurrentNetwork() == "goerli" || getCurrentNetwork() == "localnet") &&
    existsSync(filepath) &&
    _LibAddr
  ) {
    // console.log(`${libraryName} is already deployed and use ${_LibAddr}`);
    return new ethers.Contract(_LibAddr, genABI("PledgeLib", true));
  }
  const Library = await ethers.getContractFactory(libraryName);
  const library = await Library.deploy();

  try {
    writeFileSync(filepath, library.address);
  } catch (e) {
    let tmp = filepath.split("/");
    tmp.pop();
    mkdirSync(tmp.join("/"));
    writeFileSync(filepath, library.address);
  }

  await library.deployed();
  // console.log(`libs deployed.`);
  return library;
}

export async function getLinkedContractFactory(contractName, libraries) {
  const cArtifact = await artifacts.readArtifact(contractName);
  const linkedBytecode = linkBytecode(cArtifact, libraries);
  const ContractFactory = await ethers.getContractFactory(
    cArtifact.abi,
    linkedBytecode
  );
  return ContractFactory;
}

// linkBytecode: performs linking by replacing placeholders with deployed addresses
// Recommended workaround from Hardhat team until linking feature is implemented
// https://github.com/nomiclabs/hardhat/issues/611#issuecomment-638891597
function linkBytecode(artifact, libraries) {
  let bytecode = artifact.bytecode;
  for (const [, fileReferences] of Object.entries(artifact.linkReferences)) {
    for (const [libName, fixups] of Object.entries(fileReferences)) {
      const addr = libraries[libName];
      if (addr === undefined) {
        continue;
      }
      for (const fixup of fixups) {
        bytecode =
          bytecode.substr(0, 2 + fixup.start * 2) +
          addr.substr(2) +
          bytecode.substr(2 + (fixup.start + fixup.length) * 2);
      }
    }
  }
  return bytecode;
}

export function getTCR(
  totalColl: BigNumber,
  totalDebt: BigNumber,
  price: BigNumber
): BigNumber {
  let denominatedPrice = price.div(BigNumber.from(1e14 + ""));
  if (totalDebt.isZero()) {
    return BigNumber.from(
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
    );
  } else if (totalColl.isZero() && totalDebt.isZero()) {
    return BigNumber.from("0");
  } else {
    return totalColl.mul(denominatedPrice).div(totalDebt);
  }
}

export async function assertPoolIntegrity(Pool, CJPY) {
  let poolBalance = await CJPY.balanceOf(Pool.address);
  let redemptionReserve = await Pool.redemptionReserve();
  let sweepReserve = await Pool.sweepReserve();

  let msg = "";
  if (poolBalance.eq(redemptionReserve.add(sweepReserve)) === false) {
    msg += ` / Pool inconsistent (poolBalance, redemptionReserve, sweepReserve) = (${poolBalance}, ${redemptionReserve}, ${sweepReserve})`;
  }

  if (msg.length === 0) {
    return true;
  } else {
    console.error(msg);
    return false;
  }
}

export async function assertCollIntegrity(Pool, Yamato) {
  let provider = await setProvider();
  let balance = await Pool.provider.getBalance(Pool.address);

  let states = await Yamato.getStates();
  let totalColl = states[0];

  let msg = "";

  if (balance.eq(totalColl) === false) {
    msg += ` / Balance-TotalColl inconsistent (${balance}, ${totalColl})`;
  }

  if (msg.length === 0) {
    return true;
  } else {
    console.error(msg);
    return false;
  }
}

/// @dev selfdestruct(address) can send ETH to pool, Take account it.
export async function assertCollIntegrityWithSelfDestruct(Pool, Yamato) {
  let provider = await setProvider();
  let balance = await Pool.provider.getBalance(Pool.address);

  let states = await Yamato.getStates();
  let totalColl = states[0];

  let msg = "";

  if (balance.gte(totalColl) === false) {
    msg += ` / Balance-TotalColl inconsistent (${balance}, ${totalColl})`;
  }

  if (msg.length === 0) {
    return true;
  } else {
    console.error(msg);
    return false;
  }
}

export async function getPledges(Yamato) {
  let filter = Yamato.filters.Deposited(null, null);
  let logs = await Yamato.queryFilter(filter);

  let pledgeOwners = logs
    .map((log) => log.args.sender)
    .filter((value, index, self) => self.indexOf(value) === index);
  let pledges: any = await Promise.all(
    pledgeOwners.map(async (owner) => await Yamato.getPledge(owner))
  );
  pledges = pledges.filter((p) => p.isCreated);
  return pledges;
}

export async function assertDebtIntegrity(Yamato, CJPY) {
  await setProvider();

  /*
    1. Get all users and the pool
  */
  let pledges: any = await getPledges(Yamato);

  /*
    2. Sum up all coll, debt, and CJPY balance 
  */
  let acmTotalColl = BigNumber.from(0);
  let acmTotalDebt = BigNumber.from(0);
  for (var i = 0; i < pledges.length; i++) {
    acmTotalColl = acmTotalColl.add(pledges[i].coll);
    acmTotalDebt = acmTotalDebt.add(pledges[i].debt);
  }

  /*
    3. Compare pledgeSum, totalSum, and tokenSum
  */
  let states = await Yamato.getStates();
  let totalColl = states[0];
  let totalDebt = states[1];
  let totalSupply = await CJPY.totalSupply();

  let msg = "";
  if (totalColl.eq(acmTotalColl) === false) {
    msg += ` / Coll inconsistent (${totalColl}, ${acmTotalColl})`;
  }
  if (totalDebt.eq(acmTotalDebt) === false) {
    msg += ` / Debt inconsistent (${totalDebt}, ${acmTotalDebt})`;
  }
  if (totalSupply.eq(totalDebt) === false) {
    msg += ` / Supply inconsistent (${totalSupply}, ${totalDebt})`;
  }

  if (msg.length === 0) {
    return true;
  } else {
    console.error(msg);
    return false;
  }
}
