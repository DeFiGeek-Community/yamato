import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { setProvider, getDeploymentAddressPath, getFoundation } from '@src/deployUtil';
import { readFileSync } from 'fs';
import { genABI } from '@src/genABI';
import { Contract } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();

  const _cjpyOS = readFileSync(getDeploymentAddressPath('CjpyOS')).toString()
  const _CJPY = readFileSync(getDeploymentAddressPath('CJPY')).toString()
  const CJPY = new Contract(_CJPY, genABI("CJPY"), p);

  await (await CJPY.connect(getFoundation()).setCurrencyOS(_cjpyOS)).wait()
  console.log(`log: CJPY.setCurrencyOS() executed.`);
  await (await CJPY.connect(getFoundation()).rennounceGovernance()).wait()
  console.log(`log: CJPY.rennounceGovernance() executed.`);

};
export default func;
func.tags = [''];
