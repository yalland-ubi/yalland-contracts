/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const TariffAdder = artifacts.require('./TariffAdder');

const fs = require('fs');
const _ = require('lodash');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    console.log('coreTeam', coreTeam);

    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());
    console.log('Create contract instances...');
    const tariffAdder = await deployer.deploy(
        TariffAdder,
        // city
        '0x463f8834c322d9e56e2409e562a635dfd5967092',
        { from: coreTeam }
        );

    await tariffAdder.addRoleTo('0xf0430bbb78C3c359c22d4913484081A563B86170', 'role_manager');
    await tariffAdder.addRoleTo('0xf0430bbb78C3c359c22d4913484081A563B86170', 'superuser');
    await tariffAdder.addRoleTo('0x7a90ac1969e5452DCb914b66f5a924493D0c64d7', 'superuser');

    console.log('Save addresses and abi to deployed folder...');

    await new Promise(resolve => {
      const deployDirectory = `${__dirname}/../deployed`;
      if (!fs.existsSync(deployDirectory)) {
        fs.mkdirSync(deployDirectory);
      }

      const deployFile = `${deployDirectory}/${network}.json`;
      console.log(`saved to ${deployFile}`);

      fs.writeFile(
        deployFile,
        JSON.stringify(
          _.extend(data, {
            tariffAdderAddress: tariffAdder.address,
            tariffAdderAbi: tariffAdder.abi
          }),
          null,
          2
        ),
        resolve
      );
    });
  });
};
