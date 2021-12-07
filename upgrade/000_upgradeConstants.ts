/*

    Check "./deployments/rinkeby/*"

*/


import {
    setNetwork,
    getDeploymentAddressPathWithTag,
  } from "../src/deployUtil";
import { readFileSync, existsSync } from "fs";

setNetwork("rinkeby");




const filepath1 = getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy");
if (!existsSync(filepath1)) throw new Error(`${filepath1} is not exist`);
export const YamatoProxy: string = readFileSync(filepath1).toString();


const filepath2 = getDeploymentAddressPathWithTag("YamatoRepayer", "ERC1967Proxy");
if (!existsSync(filepath2)) throw new Error(`${filepath2} is not exist`);
export const YamatoRepayerProxy: string = readFileSync(filepath2).toString();
