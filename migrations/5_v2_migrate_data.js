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

const fs = require('fs');

module.exports = async function (truffle, network, accounts) {
    if (network === 'test' || network === 'local_test' || network === 'development') {
        console.log('Skipping deployment migration');
        return;
    }

    truffle.then(async () => {
        const deployer = accounts[0];

        const previousCoinAddress = '0x8d4a6cd17d095ef09f460f181546fbec32e11e8b';

        const managers = {
            balashov: '0x8DDB4caD5037F9866955cc33e7CF8895126881D8',
            balashov2: '0x377616694E6872251DDc7bDAC351631f837E401B',
            // nick: '0xB9a8F8B45Cb6D3E6822AB28911679b8F4B8C68d2', //TODO: remove on prod
            jonybang: '0xf0430bbb78C3c359c22d4913484081A563B86170',
            chebykin: '0x7a90ac1969e5452DCb914b66f5a924493D0c64d7'
        };

        const multisig = '0x1a27d3E7887C237B3B49825BA531304C625DE24c';

        const members = {
            // nickMember1: '0x075c3e0d1a4829c866ea9048a335bd3955e8da33',
            // nickMember2: '0xafc0fd8153bd835fa6e57e8b5c5b3210c44c5069',
            // nickMember3: '0xef7751e98c135d28af63d1353cb02dc502b72ee6',
            // igor: '0x06Dba6eb6A1044B8cBcaA0033EA3897BF37E6671'
        };

        const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());
        const city = await City.at(data.cityAddress);
        const newToken = await CoinToken.at(data.coinTokenAddress);
        const addressUpgrader = await AddressUpgrader.at(data.addressUpgraderAddress);

        console.log('Setting up CoinToken roles...');
        await newToken.addRoleTo(addressUpgrader.address, "minter", { from: deployer });
        await newToken.addRoleTo(addressUpgrader.address, "burner", { from: deployer });
        await newToken.addRoleTo(city.address, "minter", { from: deployer });

        await newToken.addRoleTo(multisig, "fee_manager", { from: deployer });
        await newToken.addRoleTo(multisig, "pauser", { from: deployer });

        console.log("Revoking permissions...");
        await addressUpgrader.removeRoleFrom(deployer, "role_manager", { from: deployer });

        await newToken.removeRoleFrom(deployer, "role_manager", { from: deployer });
        await newToken.removeRoleFrom(deployer, "fee_manager", { from: deployer });
        await newToken.removeRoleFrom(deployer, "pauser", { from: deployer });
        // DO manual steps

        // AFTER manual steps
        // await newToken.removeRoleFrom(deployer, "minter", { from: deployer });
        // await newToken.removeRoleFrom(deployer, "burner", { from: deployer });

        // await pIteration.forEach(Object.values(members), async (memberAddress) => {
        //     await city.addParticipation(memberAddress, coinTariffId, {from: coreTeam});
        // });
    });
};
