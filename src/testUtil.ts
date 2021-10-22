import { ethers, upgrades } from "hardhat";
import { BaseContract,ContractFactory,BigNumber } from "ethers";
import { FakeContract, smock } from "@defi-wonderland/smock";


// @dev UUPS 
export async function getFakeProxy<T extends BaseContract>(contractName: string): Promise<FakeContract<T>> {
    let mock = await smock.fake<T>(contractName)
    if(typeof mock.upgradeTo !== 'function') throw new Error(`${contractName} has to inherit UUPSUpgradeable to have upgradeTo().`);
    const proxy = await (await ethers.getContractFactory("ERC1967Proxy")).deploy(mock.address, BigNumber.from(0)) // from @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol
    mock.attach(proxy.address)
    return mock;
}

export async function getProxy<T extends BaseContract, S extends ContractFactory>(contractName: string, args:any): Promise<T> {
    let contractFactory:S = <S>( await ethers.getContractFactory(contractName) )
    const instance:T = <T>(await upgrades.deployProxy(contractFactory, args))
    return instance;
}

