const City = artifacts.require('./City');
const IERC20 = artifacts.require('IERC20.sol');
const AddressUpgrader = artifacts.require('./AddressUpgrader');
const config = require('./config');

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

        // TODO: cheange for production
        // const city = await IERC20.at(config.cityAddress);
        const city = await IERC20.at(data.fakeCityAddress);

        const tariffParams = JSON.parse(fs.readFileSync('./tmp/old-tariff-config.json'));
        console.log('Tariff params', tariffParams);

        await city.createTariff();

    } catch (e) {
        console.log(e);
    }

    callback();
};
