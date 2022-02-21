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
import chalk from 'chalk';

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
  let contractFactory: S = <S>await ethers.getContractFactory(contractName);
  const defaultInst: T = <T>(
    await upgrades.deployProxy(contractFactory, args, { kind: "uups" })
  );

  // TODO: V2 Flag
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

    const inst: T = <T>await upgradeProxy(defaultInst.address, implName);
    console.log(chalk.gray(`        [success] ${implName}=${inst.address} is upgraded to ERC1967Proxy`));
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
    console.log(chalk.gray(`        [success] ${implName}=${inst.address} is upgraded to ERC1967Proxy`));
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
    (getCurrentNetwork() == "rinkeby" || getCurrentNetwork() == "localnet") &&
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
