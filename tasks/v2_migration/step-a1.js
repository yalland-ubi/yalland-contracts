const City = artifacts.require('./City');
const IERC20 = artifacts.require('IERC20.sol');
const AddressUpgrader = artifacts.require('./AddressUpgrader');
const CoinToken = artifacts.require('./CoinToken');
const config = require('./config');

IERC20.numberFormat = 'String';
CoinToken.numberFormat = 'String';
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

        // TODO: cheange for production
        // const city = await IERC20.at(config.cityAddress);
        const city = await City.at('0x463f8834c322d9e56e2409e562a635dfd5967092');
        const newToken = await CoinToken.at(data.coinTokenAddress);
        const addressUpgrader = await AddressUpgrader.at(data.addressUpgraderAddress);
        const me2 = '0x588573EC6dD9F53582836625f8A22Ba46170af71';
        const me3 = '0x35E26B0537c8976F0646fAbFd7e14a914Bb74392';

        // await city.addParticipation('0x588573EC6dD9F53582836625f8A22Ba46170af71', config.newTariffId);
        // await newToken.mint('0x588573EC6dD9F53582836625f8A22Ba46170af71', 123456);
        await addressUpgrader.migrateUserAddress(me3, me2, config.newTariffId);
        console.log('migrate done. m2', await newToken.balanceOf(me2));
        console.log('migrate done. m3', await newToken.balanceOf(me3));

    } catch (e) {
        console.log(e);
    }

    callback();
};
