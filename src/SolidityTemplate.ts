/*

  !!! THIS IS DEPRECATED !!!

  Wrote for runtime rewriting of hard-coded contract address.

  But dependency resolution was hard to do within my resources.

*/

import Mustache from 'mustache';
import fs from 'fs';
import solc from 'solc';

export function render(_filename, options) {
  const code = fs.readFileSync(`contracts/${_filename}.t.sol`).toString()
  const newCode = Mustache.render(code, options)
  fs.writeFileSync(`contracts/${_filename}.sol`, newCode);

  compile(_filename);

}

function compile(_filename){
  const LIB_NAME = "BytesLib.sol";
  function findImports(path) {
    if (path === LIB_NAME)
      return {
        contents: fs.readFileSync(`contracts/${LIB_NAME}`).toString()
      };
    else return { error: 'File not found' };
  }
  const contractFilename = `${_filename}.sol`;
  let input:any = {};
  input.language = 'Solidity';
  input.sources = {};
  input.sources[contractFilename] = {};
  input.sources[contractFilename].content = fs.readFileSync(`contracts/${contractFilename}`).toString();

  var output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  console.log(output);
}

