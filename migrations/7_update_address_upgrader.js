/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const City = artifacts.require('./City');
const CoinToken = artifacts.require('./CoinToken');
const AddressUpgrader = artifacts.require('./AddressUpgrader');
const Burner = artifacts.require('./Burner');

const fs = require('fs');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    console.log('coreTeam', coreTeam);

    console.log('Create contract instances...');
    const burner = await deployer.deploy(
        AddressUpgrader,
        // city
        '0x463f8834c322d9e56e2409e562a635dfd5967092',
        // coinToken
        '0x72cBf5751365F47A7A1374d3B6065269EF82127e',
        { from: coreTeam }
        );

    const coinToken = await CoinToken.at('0x72cBf5751365F47A7A1374d3B6065269EF82127e');
    await coinToken.addRoleTo(burner.address, 'burner');
    await coinToken.addRoleTo(burner.address, 'minter');

    console.log('Save addresses and abi to deployed folder...');
    return;

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
          {
            addressUpgraderAddress: addressUpgrader.address,
            addressUpgraderAbi: addressUpgrader.abi,
            cityAddress: city.address,
            cityAbi: city.abi,
            coinTokenAddress: coinToken.address,
            coinTokenAbi: coinToken.abi,
            minterAddress: minter.address,
            minterAbi: minter.abi,
            burnerAddress: burner.address,
            burnerAbi: burner.abi
          },
          null,
          2
        ),
        resolve
      );
    });
  });
};
