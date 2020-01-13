const Burner = artifacts.require('./Burner');
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

function ether(number) {
    return web3.utils.toWei(number.toString(), 'ether');
}
module.exports = async function(callback) {
    try {
        const data = JSON.parse(fs.readFileSync(`${__dirname}/../../deployed/testnet57.json`).toString());

        const newToken = CoinToken.at('0x72cBf5751365F47A7A1374d3B6065269EF82127e')
        const burner = await Burner.at('0xA823E7a999fffaF11E90E75379A5e52D0122B9d5');
        const toBurn = JSON.parse(fs.readFileSync(`${__dirname}/to-burn.csv`));
        console.log('burning', toBurn.length);

        const filteredToBurn = toBurn.filter(async a => {
            return BigInt((await newToken.balanceOf(a))) >= BigInt(ether(250));
        });
        console.log('filterend', filteredToBurn.length);
        const amount = filteredToBurn.map(a => ether(250));
        console.log('burning', amount);
        await burner.burnBatch(filteredToBurn, amount, { gas: 28000000 });
    } catch (e) {
        console.log(e);
    }

    callback();
};
