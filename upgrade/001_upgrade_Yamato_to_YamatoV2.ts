import { upgradeLinkedProxy } from "../src/upgradeUtil";
import * as constants from "./000_upgradeConstants";
import { execSync } from "child_process";

const IMPL_NAME = "YamatoV2";

async function main() {
  const inst = await upgradeLinkedProxy(constants.YamatoProxy, IMPL_NAME, [
    "PledgeLib",
  ]);
  console.log(`${inst.address} is upgraded to ${IMPL_NAME}`);

  const implAddr = await (<any>inst).getImplementation();
  execSync(
    `npm run verify:rinkeby -- --contract contracts/${IMPL_NAME}.sol:${IMPL_NAME} ${implAddr} 2> /dev/null`
  );
  console.log(`Verified ${implAddr}`);
}

main();
