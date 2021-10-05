import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { setProvider, getDeploymentAddressPath, getFoundation } from '../src/deployUtil';
import { readFileSync } from 'fs';
import { genABI } from '../src/genABI';
import { Contract } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();

  const _cjpyosAddr = readFileSync(getDeploymentAddressPath('CjpyOS')).toString()
  const CjpyOS = new Contract(_cjpyosAddr, genABI("CjpyOS"), p);

  const _yamatoAddr = readFileSync(getDeploymentAddressPath('Yamato')).toString()
  await (await CjpyOS.connect(getFoundation()).addYamato(_yamatoAddr)).wait()

  console.log(`log: CjpyOS.addYamato() executed.`);
};
export default func;
func.tags = [''];
