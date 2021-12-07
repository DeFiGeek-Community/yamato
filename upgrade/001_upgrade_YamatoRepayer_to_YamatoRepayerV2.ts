import { upgradeProxy, upgradeLinkedProxy } from "../src/upgradeUtil";
import * as constants from "./000_upgradeConstants";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { getDeploymentAddressPathWithTag } from "../src/deployUtil";

// const IMPL_NAME = "YamatoV2";
const IMPL_NAME = "YamatoRepayerV2";

async function main() {
  // const inst = await upgradeLinkedProxy(constants.YamatoProxy, IMPL_NAME, [
  // const inst = await upgradeLinkedProxy(constants.YamatoRepayerProxy, IMPL_NAME, [
  const inst = await upgradeProxy(constants.YamatoRepayerProxy, IMPL_NAME);
  console.log(`${inst.address} is upgraded to ${IMPL_NAME}`);

  const implAddr = await (<any>inst).getImplementation();
  execSync(
    `npm run verify:rinkeby -- --contract contracts/${IMPL_NAME}.sol:${IMPL_NAME} ${implAddr}`
  );
  console.log(`Verified ${implAddr}`);
  writeFileSync(
    getDeploymentAddressPathWithTag(IMPL_NAME, "UUPSImpl"),
    implAddr
  );
}

main().catch((e) => console.log(e));
