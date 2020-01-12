/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const CoinToken = artifacts.require('./CoinToken');
const City = artifacts.require('./City');
const AddressUpgrader = artifacts.require('./AddressUpgrader');
const Minter = artifacts.require('./Minter');

const fs = require('fs');

let lastCoinAddress = '0x8d4a6cd17d095ef09f460f181546fbec32e11e8b';
let previousCityAddress = '0x463f8834c322d9e56e2409e562a635dfd5967092';

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    console.log('coreTeam', coreTeam);

    console.log('Create contract instances...');
    // TODO: change for production
    // const newToken = await CoinToken.deploy("Yalland", "YAL", 18, { from: coreTeam });
    const coinToken = await deployer.deploy(CoinToken, "YTest1", "YT1", 18, { from: coreTeam });
    const city = await City.at(previousCityAddress);
    const minter = await deployer.deploy(Minter, coinToken.address, { from: coreTeam });
    const addressUpgrader = await deployer.deploy(AddressUpgrader, previousCityAddress, coinToken.address);

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
          {
            addressUpgraderAddress: addressUpgrader.address,
            addressUpgraderAbi: addressUpgrader.abi,
            coinTokenAddress: coinToken.address,
            coinTokenAbi: coinToken.abi,
            cityAddress: city.address,
            cityAbi: city.abi,
            minterAddress: minter.address,
            minterAbi: minter.abi
          },
          null,
          2
        ),
        resolve
      );
    });
  });
};
