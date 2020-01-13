const IERC20 = artifacts.require('IERC20.sol');
const CoinToken = artifacts.require('CoinToken.sol');
const City = artifacts.require('City.sol');
const Permissionable = artifacts.require('./Permissionable');
const AddressUpgrader = artifacts.require('./AddressUpgrader');
const config = require('./config');

CoinToken.numberFormat = 'String';
IERC20.numberFormat = 'String';
console.log('Web3 version is', IERC20.web3.version);
const assert = require('assert');
const web3 = IERC20.web3;
const pIteration = require('p-iteration');
const _ = require('lodash');

const fs = require('fs');

module.exports = async function(callback) {
    try {
        const data = JSON.parse(fs.readFileSync(`${__dirname}/../../deployed/testnet57.json`).toString());

        console.log('Old token address is', config.oldTokenAddress);
        console.log('New token address is', data.coinTokenAddress);

        const newToken = await CoinToken.at(data.coinTokenAddress);
        const cityTokenPermissionable = await Permissionable.at(config.cityAddress);
        const city = await City.at(config.cityAddress);
        const newTokenPermissionable = await Permissionable.at(data.coinTokenAddress);
        const addressUpgrader = await AddressUpgrader.at(data.addressUpgraderAddress);

        const csvContent = fs.readFileSync(`${__dirname}/migrate.csv`).toString('utf8');

        const pairs = csvContent.split(/\r\n|\r|\n/g).map((line) => {
            const split = line.split(/[,;]+ {0,}/);
            // console.log('split', split);
            const from = _.trim(split[0], ' ');
            const to = _.trim(split[1], ' ');
            if (!_.startsWith(from, '0x')) {
                return null;
            }
            if (!_.startsWith(to, '0x')) {
                return null;
            }
            return [from, to];
        }).filter(a => a);

        const totalSupplyBefore = await newToken.totalSupply();
        console.log('Checking permissions dcity minter...', await newTokenPermissionable.hasRole('0x463f8834c322d9e56e2409e562a635dfd5967092', 'minter'));
        console.log('Checking permissions ...', await newTokenPermissionable.hasRole('0x7a90ac1969e5452DCb914b66f5a924493D0c64d7', 'role_manager'));
        console.log('Checking permissions join...', await cityTokenPermissionable.hasRole('0x7a90ac1969e5452DCb914b66f5a924493D0c64d7', 'member_join_manager'));
        console.log('Checking permissions leave...', await cityTokenPermissionable.hasRole('0x7a90ac1969e5452DCb914b66f5a924493D0c64d7', 'member_leave_manager'));
        console.log('Checking permissions for upgrades...', await addressUpgrader.hasRole('0x7a90ac1969e5452DCb914b66f5a924493D0c64d7', 'superuser'));
        console.log('Checking permissions for upgrades...', await cityTokenPermissionable.hasRole(addressUpgrader.address, 'member_join_manager'));
        console.log('Checking permissions for upgrades...', await cityTokenPermissionable.hasRole(addressUpgrader.address, 'member_leave_manager'));
        console.log('Checking permissions for upgrades...', await newTokenPermissionable.hasRole(addressUpgrader.address, 'minter'));
        console.log('Checking permissions for upgrades...', await newTokenPermissionable.hasRole(addressUpgrader.address, 'burner'));
        // await newTokenPermissionable.removeRoleFrom('0x7a90ac1969e5452DCb914b66f5a924493D0c64d7', "burner");
        // await newTokenPermissionable.addRoleTo('0x7a90ac1969e5452DCb914b66f5a924493D0c64d7', "burner");

        await pIteration.forEachSeries(pairs, async function(pair, index) {
            console.log('index', index);
            // assert.equal(pair[0], '0xf57a3570b2a08315d139f00690bf4cf113ff62ee');
            // if (index === 0) {
            //     return;
            // }
            let balance0Before;
            try {
                balance0Before = await newToken.balanceOf(pair[0]);
            } catch(e) {
                return;
            }
            let balance1Before;
            try {
                balance1Before = await newToken.balanceOf(pair[1]);
            } catch (e) {
                console.log('Invalid address', pair[1]);
                return;
            }
            
            if (balance0Before === '0') {
                console.log('Skipping 0 balance address', pair[0]);
                return;
            }

            console.log('Migrating address', pair[0], 'to', pair[1], 'with balance', balance0Before);

            console.log('mint..');
            await newToken.burn(pair[0], balance0Before);
            console.log('burn..');
            await newToken.mint(pair[1], balance0Before);
            console.log('kick..');
            try {
                await city.kickTariffParticipation(pair[0], config.tariffId);
            } catch (e) {
                console.log('e', e);
                return;
            }
            console.log('add..');
            await city.addParticipation(pair[1], config.newTariffId);

            // await addressUpgrader.migrateUserAddress(pair[0], pair[1], config.tariffId);

            // assert.equal(await newToken.balanceOf(pair[1]), (BigInt(balance0Before) + BigInt(balance1Before)).toString(10));
            // assert.equal(await newToken.balanceOf(pair[0]), 0);
        });

        const totalSupplyAfter = await newToken.totalSupply();

        console.log('TotalSupply Before', totalSupplyBefore);
        console.log('TotalSupply After ', totalSupplyAfter);

    } catch (e) {
        console.log(e);
    }

    callback();
};
