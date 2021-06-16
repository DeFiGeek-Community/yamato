let ethers = require('ethers');

let c = new ethers.Contract("0x2EE46278E7AFbA775000Fd818c02705e84c18795", ["function templates(string) view returns (address)"], ethers.getDefaultProvider('rinkeby'));

(async function(){
    console.log(await c.templates("OwnableToken.0.sol"));
})().then();

