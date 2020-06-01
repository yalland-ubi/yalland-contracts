const fs = require('fs');

const flattenedFolder = './build/flattened/';

module.exports = function flatten(fileName) {
  try {
    fs.mkdirSync(flattenedFolder);
    // eslint-disable-next-line no-empty
  } catch (e) {}

  if (!fileName) {
    console.error('ERROR: Specify a contract file name');
    process.exit(0);
  }

  const rex = /import.*\/(.*\.sol)/gi;
  const rex2 = /((.|\n)+)^(contract|library|interface)/gm;
  const contracts = {};
  const deps = [];

  function getImports(name, level) {
    const source = fs.readFileSync(`build/src/${name}`, 'utf-8').toString();
    const currentLevelContracts = [];
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = rex.exec(source)) !== null) {
      currentLevelContracts.push(match[1]);
    }

    for (let i = 0; i < currentLevelContracts.length; i++) {
      const contract = currentLevelContracts[i];
      deps.push([name, contract]);
      if (!contracts[contract]) {
        contracts[contract] = true;
        getImports(contract, level + 1);
      }
    }
  }

  getImports(fileName, 0);

  // TODO: user C3 linearization
  // eslint-disable-next-line global-require
  const keys = require('./toposort.js')(deps).reverse();

  if (keys.indexOf(fileName) === -1) {
    keys.push(fileName);
  }

  // TODO: fetch from source
  let output =
    '/*\n' +
    ' * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company\n' +
    ' * (Founded by [Nikolai Popeka](https://github.com/npopeka)\n' +
    ' *\n' +
    ' * Copyright ©️ 2018-2020 Galt•Core Blockchain Company\n' +
    ' * (Founded by [Nikolai Popeka](https://github.com/npopeka) by\n' +
    ' * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).\n' +
    ' * \n' +
    ' * 🌎 Galt Project is an international decentralized land and real estate property registry\n' +
    ' * governed by DAO (Decentralized autonomous organization) and self-governance platform for communities\n' +
    ' * of homeowners on Ethereum.\n' +
    ' * \n' +
    ' * 🏡 https://galtproject.io\n' +
    ' */\n\n' +
    'pragma solidity 0.5.17;\n';

  for (let i = 0; i < keys.length; i++) {
    const contract = keys[i];
    console.log(`${fileName} << ${contract}`);
    let src = fs.readFileSync(`build/src/${contract}`, 'utf-8').toString();

    src = src.replace(rex2, '$3');
    output += `\n${src}`;
  }

  fs.writeFileSync(`${flattenedFolder}/${fileName}`, output);

  console.log('done');
};
