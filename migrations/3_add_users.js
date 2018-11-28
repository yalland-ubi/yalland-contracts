const CoinToken = artifacts.require('./CoinToken');
const City = artifacts.require('./City');
const Web3 = require('web3');
const pIteration = require('p-iteration');

const fs = require('fs');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    // const proxiesAdmin = accounts[1];
      
    const admins = {
      jonybang: '0xf0430bbb78C3c359c22d4913484081A563B86170',
      nickAdmin: '0x84131ce9f499667c6fd7ec9e0860d8dfaba63ed9'
    };
    
    const members = {
        nickMember1: '0x075c3e0d1a4829c866ea9048a335bd3955e8da33',
        nickMember2: '0xafc0fd8153bd835fa6e57e8b5c5b3210c44c5069',
        nickMember3: '0xef7751e98c135d28af63d1353cb02dc502b72ee6'
    };

    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());
    const city = await City.at(data.cityAddress);
    const coin = await CoinToken.at(data.coinTokenAddress);

    const coinTariffId = (await city.getAllTariffs.call())[0];
    
    await pIteration.forEach(Object.values(admins), async (adminAddress) => {
        await city.addRoleTo(adminAddress, await city.CITY_MANAGER_ROLE.call(), { from: coreTeam });
        await city.addParticipation(adminAddress, coinTariffId, { from: coreTeam });
        await coin.addRoleTo(adminAddress, await coin.FEE_MANAGER_ROLE.call(), { from: coreTeam });
    });

    await pIteration.forEach(Object.values(members), async (memberAddress) => {
        await city.addParticipation(memberAddress, coinTariffId, { from: coreTeam });
    });
  });
};
