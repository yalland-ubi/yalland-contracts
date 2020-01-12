const IERC20 = artifacts.require('IERC20.sol');
const Minter = artifacts.require('Minter.sol');
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

        // console.log('Old token address is', config.oldTokenAddress);
        console.log('New token address is', data.coinTokenAddress);

        // const oldToken = await IERC20.at(config.oldTokenAddress);
        const minter = await Minter.at(data.minterAddress);

        const newToken = await IERC20.at(data.coinTokenAddress);

        // assert.ok(oldToken.address !== newToken.address);

        const balances = JSON.parse(fs.readFileSync('./tmp/old-token-balances.json'));
        const myTotal = Object.values(balances).reduce((accumulator, address) => {
            return BigInt(address) + accumulator;
        }, BigInt(Object.values(balances)[0]));

        console.log('Target   total', myTotal);
        // console.log('Contract total', await oldToken.totalSupply());

        const addressChunks = _.chunk(Object.keys(balances), 500);

        await pIteration.forEachSeries(addressChunks, async (chunk) => {
            console.log('chunk len', chunk.length);
            const amount = chunk.map(address => balances[address]);
            await minter.mintBatch(chunk, amount, { gas: 28000000 });
        });

        console.log('New token total supply', await newToken.totalSupply());
        // console.log('Old token total supply', await oldToken.totalSupply());

    } catch (e) {
        console.log(e);
    }

    callback();
};
