const CoinToken = artifacts.require('./CoinToken');
const City = artifacts.require('./City');
const Web3 = require('web3');

const fs = require('fs');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    // const proxiesAdmin = accounts[1];
      
    const users = {
      jonybang: '0xf0430bbb78C3c359c22d4913484081A563B86170'
    };

    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());
    const city = await City.at(data.cityAddress);

    const coinTariffId = (await city.getAllTariffs.call())[0];

    await city.addRoleTo(users.jonybang, await city.CITY_MANAGER_ROLE.call(), { from: coreTeam });
    await city.addParticipation(users.jonybang, coinTariffId, { from: coreTeam });
  });
};
