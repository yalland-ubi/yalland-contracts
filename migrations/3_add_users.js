const CoinToken = artifacts.require('./CoinToken');
const City = artifacts.require('./City');
const Web3 = require('web3');
const pIteration = require('p-iteration');
const ethers = require('ethers');

const fs = require('fs');

module.exports = async function (deployer, network, accounts) {
    if (network === 'test' || network === 'local_test' || network === 'development') {
        console.log('Skipping deployment migration');
        return;
    }

    deployer.then(async () => {
        const coreTeam = accounts[0];
        // const proxiesAdmin = accounts[1];

        const admins = {
            balashov: '0x8DDB4caD5037F9866955cc33e7CF8895126881D8',
            jonybang: '0xf0430bbb78C3c359c22d4913484081A563B86170'
        };

        const members = {
            // nickMember1: '0x075c3e0d1a4829c866ea9048a335bd3955e8da33',
            // nickMember2: '0xafc0fd8153bd835fa6e57e8b5c5b3210c44c5069',
            // nickMember3: '0xef7751e98c135d28af63d1353cb02dc502b72ee6',
            // igor: '0x06Dba6eb6A1044B8cBcaA0033EA3897BF37E6671'
        };

        const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());
        const city = await City.at(data.cityAddress);
        const coin = await CoinToken.at(data.coinTokenAddress);

        // const coinTariffId = (await city.getAllTariffs.call())[0];

        await pIteration.forEach(Object.values(admins), async (adminAddress) => {
            await city.addRoleTo(adminAddress, await city.RATE_MANAGER_ROLE.call(), {from: coreTeam});
            await city.addRoleTo(adminAddress, await city.MEMBER_JOIN_MANAGER_ROLE.call(), {from: coreTeam});
            await city.addRoleTo(adminAddress, await city.MEMBER_LEAVE_MANAGER_ROLE.call(), {from: coreTeam});
            await coin.addRoleTo(adminAddress, await coin.FEE_MANAGER_ROLE.call(), {from: coreTeam});
        });
        
        await city.removeRoleFrom(coreTeam, await city.RATE_MANAGER_ROLE.call(), {from: coreTeam});
        await city.removeRoleFrom(coreTeam, await city.MEMBER_JOIN_MANAGER_ROLE.call(), {from: coreTeam});
        await city.removeRoleFrom(coreTeam, await city.MEMBER_LEAVE_MANAGER_ROLE.call(), {from: coreTeam});
        await coin.removeRoleFrom(coreTeam, await coin.FEE_MANAGER_ROLE.call(), {from: coreTeam});
        await coin.removeRoleFrom(coreTeam, await coin.MINTER_ROLE.call(), {from: coreTeam});
        await coin.removeRoleFrom(coreTeam, await coin.BURNER_ROLE.call(), {from: coreTeam});
        
        await city.transferOwnership('0xf0430bbb78C3c359c22d4913484081A563B86170');
        await coin.transferOwnership('0xf0430bbb78C3c359c22d4913484081A563B86170');
      
        // for (let i = 0; i < 100; i++) {
        //     let randomWallet = ethers.Wallet.createRandom();
        //     members['randomUser' + i] = randomWallet.address;
        // }
        //
        // await pIteration.forEach(Object.values(members), async (memberAddress) => {
        //     await city.addParticipation(memberAddress, coinTariffId, {from: coreTeam});
        // });
    });
};
