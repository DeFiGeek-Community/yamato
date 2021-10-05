import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { setProvider, getDeploymentAddressPath } from '../src/deployUtil';
import { readFileSync } from 'fs';
import { genABI } from '../src/genABI';
import { Contract } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();

  const _cjpyosAddr = readFileSync(getDeploymentAddressPath('CjpyOS')).toString()
  const CjpyOS = new Contract(_cjpyosAddr, genABI("CjpyOS"), p);

  // const _ymtOSProxyAddr = readFileSync(getDeploymentAddressPath('YmtOSProxy')).toString()
  // const _ymtAddr = readFileSync(getDeploymentAddressPath('YMT')).toString()
  // const _veymtAddr = readFileSync(getDeploymentAddressPath('veYMT')).toString()
  // await ( await CjpyOS.setYmtOSProxy(_ymtOSProxyAddr) ).wait();
  // await ( await CjpyOS.setGovernanceTokens(_ymtAddr, _veymtAddr) ).wait();

  // console.log(`log: CjpyOS.setYmtOSProxy() executed.`);
  // console.log(`log: CjpyOS.setGovernanceTokens() executed.`);

};
export default func;
func.tags = [''];
