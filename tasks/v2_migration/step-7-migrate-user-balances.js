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

        // const oldToken = await IERC20.at(config.oldTokenAddress);
        // const minter = await Minter.at(data.minterAddress);
        // const oldCoinToken = await CoinToken.at(config.oldTokenAddress);
        // const newToken = await IERC20.at(data.coinTokenAddress);
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

        await pIteration.forEachSeries(pairs, async function(pair) {
            await addressUpgrader.upgrade
        });

        console.log('addresses', addresses);

    } catch (e) {
        console.log(e);
    }

    callback();
};
