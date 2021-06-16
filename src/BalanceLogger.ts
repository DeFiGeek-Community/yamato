import { BigNumber, Contract, Signer } from 'ethers';
import { summon, create, getSharedProvider, getSharedSigners, 
  parseAddr, parseBool, parseInteger, getLogs,
  encode, decode, increaseTime,
  toERC20, toFloat, onChainNow } from "@test/param/helper";


export class BalanceLogger{
  TokensObj: any;
  signersObj: any;
  provider: any;
  list: Array<any>;
  nickname: string;
  constructor(_TokensObj, _signersObj, _provider, _nickname){
    /*
      new Logger({SampleToken1, SampleToken2}, {owner,alice,bob,PoolContract});
    */
    this.TokensObj = _TokensObj;
    this.signersObj = _signersObj;
    this.provider = _provider;
    this.list = [];
    this.nickname = _nickname;
  }
  async log(){
    this.list.push(await this.getBalances());
  }
  get(person:string, token:string):BigNumber{
    let latestBal: BigNumber = this.list[this.list.length-1][person][token];
    return latestBal;
  }
  diff(person:string, token:string): BigNumber{
    if(!this.list[this.list.length-1][person] || !this.list[0][person]){
      return BigNumber.from(0);
    }
    let newBal: BigNumber = this.list[this.list.length-1][person][token];
    let oldBal: BigNumber = this.list[0][person][token];
    return newBal.sub(oldBal);
  }
  diffStr(person:string, token:string): string{
    if(this.list.length < 2) return "-";
    return toFloat(this.diff(person, token).toString());
  }
  ltAbsOneBN(bn:BigNumber|string){
    let isNumber:boolean=false, num:number;
    let isBigNumber:boolean = BigNumber.isBigNumber(bn);
    const maxStr = `${Number.MAX_SAFE_INTEGER}`;

    if(!isBigNumber && (<string>bn).length >= maxStr.length) {
      return false;
    } else if ((<string>bn).length == maxStr.length && (<string>bn).slice(0,1) == maxStr.slice(0,1)) {
      return false
    }
    if(isBigNumber){
      try {
        isNumber =
          (<BigNumber>bn).gt(-1*(Number.MAX_SAFE_INTEGER-1))
          &&
          (<BigNumber>bn).lt(Number.MAX_SAFE_INTEGER-1);
      } catch (e) {
        console.error(e.message);
      }

      try {
        num = (<BigNumber>bn).toNumber();
      } catch (e) {
        return false;
      }

    } else {
      isNumber = true;
      num = parseInt(<string>bn);
    }

    if(isNumber) {
      return -1 < num && num < 1;
    } else {
      return false;
    }
  }
  async dump(){
    let arr1 = await Promise.all(
      Object.keys(this.signersObj).map(async username=>{
        const un:string = username.padEnd(10, ' ');
        let arr2 = await Promise.all(
          Object.keys(this.TokensObj).map(async tokenName=>{
            const tn:string = tokenName.padEnd(10, ' ');
            const val:string = toFloat( (await this.TokensObj[tokenName].balanceOf(this.signersObj[username].address)).toString() ).padEnd(30, ' ');
            return `${tn}:${val}`
          })
        );
        if(username.match(/^[A-Z][a-zA-Z0-9]+/)){
          /* contract balance */
          let Contract = this.signersObj[username];
          const val = toFloat((await Contract.provider.getBalance(Contract.address)).toString() ).padEnd(18, ' ');
          arr2.unshift(`${un}: eth:${val}`);
        } else {
          /* EOA balance */
          const val = toFloat((await this.signersObj[username].getBalance()).toString() ).padEnd(18, ' ');
          arr2.unshift(`${un}: eth:${val}`);
        }
        const _val = this.diffStr(username, 'eth').padEnd(14, ' ');
        arr2.push(`diff::eth ${_val}`);
        Object.keys(this.TokensObj).map(async tokenName=>{
          const tn:string = tokenName.padEnd(10, ' ');
          const val = this.diffStr(username, tokenName).padEnd(14, ' ');
          arr2.push(`diff::${tn} ${val}`);
        })
        return arr2.join(" ");
      })
    );
    let initialUser = Object.keys(this.signersObj)[0];
    let isPre = this.diffStr(initialUser, 'eth') === '-';
    let header = `\n[${this.nickname}] - ${isPre?'pre':'post'}\n`;
    arr1.unshift(header);
    let body = arr1.join("\n");
    console.log(body);
  }
  async getBalances(){
    let obj = {};
    await Promise.all(
      Object.keys(this.signersObj).map(async username=>{
        obj[username] = {};
        if(username.match(/^[A-Z][a-zA-Z0-9]+/)){
          /* contract balance */
          let Contract = this.signersObj[username];
          obj[username].eth = await Contract.provider.getBalance(Contract.address);
        } else {
          /* EOA balance */
          obj[username].eth = await this.signersObj[username].getBalance();
        }
        await Promise.all(
          Object.keys(this.TokensObj).map(async tokenName=>{
            obj[username][tokenName] = await this.TokensObj[tokenName].balanceOf(this.signersObj[username].address);
            return true;
          })
        );
        return true;
      })
    );
    return obj;
  }
  setToken(obj){
    Object.keys(obj).map(k=>{
      this.TokensObj[k] = obj[k];
    })
  }
  setSigner(obj){
    Object.keys(obj).map(k=>{
      this.signersObj[k] = obj[k];
    })
  }
}
