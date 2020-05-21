const fs = require('fs');
const rimraf = require('rimraf');
const flattener = require('./flattener');

const flattenedFolder = './build/flattened/';

rimraf.sync(flattenedFolder);
fs.mkdirSync(flattenedFolder);

const chainSpec = require(`../deployed/sokol_extended.json`);

Object.keys(chainSpec.contracts)
  .map(contract => {
    return chainSpec.contracts[contract];
  })
  .concat([{ factory: 'AdminUpgradeabilityProxy' }])
  .map(contract => {
    try {
      flattener(`${contract.factory}.sol`);
    } catch (e) {
      console.log(e);
    }

    return contract;
  });
