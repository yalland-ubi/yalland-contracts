/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const AddressUpgrader = artifacts.require('./AddressUpgraderL');

const fs = require('fs');
const _ = require('lodash');

AddressUpgrader.numberFormat = 'String';


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    console.log('coreTeam', coreTeam);

    const networkFile = process.env.RESULT_FILE || 'yalland_netconfig';
    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${networkFile}.json`).toString());
    console.log('Create contract instances...');
    const addressUpgader = await deployer.deploy(AddressUpgrader, data.coinTokenAddress);


    console.log('Save addresses and abi to deployed folder...');

    await new Promise(resolve => {
      const deployDirectory = `${__dirname}/../deployed`;
      if (!fs.existsSync(deployDirectory)) {
        fs.mkdirSync(deployDirectory);
      }

      const deployFile = `${deployDirectory}/${networkFile}.json`;
      console.log(`saved to ${deployFile}`);

      fs.writeFile(
        deployFile,
        JSON.stringify(
          _.extend(data, {
            addressUpgraderAddress: addressUpgader.address,
            addressUpgraderAbi: addressUpgader.abi
          }),
          null,
          2
        ),
        resolve
      );
    });
  });
};
