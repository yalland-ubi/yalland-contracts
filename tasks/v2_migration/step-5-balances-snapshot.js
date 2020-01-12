const IERC20 = artifacts.require('IERC20.sol');
const config = require('./config');

IERC20.numberFormat = 'String';
console.log('Web3 version is', IERC20.web3.version);
const web3 = IERC20.web3;
const pIteration = require('p-iteration');
const _ = require('lodash');

const fs = require('fs');

module.exports = async function(callback) {
    try {
        console.log('Old token address is', config.oldTokenAddress);
        const oldToken = await IERC20.at(config.oldTokenAddress);
        console.log('Total supply', await oldToken.totalSupply(), 'WEI');
        console.log('Total supply', web3.utils.fromWei(await oldToken.totalSupply(), 'ether'), 'ETH');
        console.log('Dumping holder addresses...');

        // STAGE 1
        const members = {};
        const res = await oldToken.getPastEvents('Transfer', { fromBlock: 0, toBlock: 'latest'});
        console.log('Transfer event count', res.length);
        console.log(res[0].args.to);

        for (let i = 0; i < res.length; i++) {
            members[res[i].args.from] = true;
            members[res[i].args.to] = true;
        }

        let addresses = Object.keys(members);
        console.log('Total address found', addresses.length);

        fs.writeFileSync('./tmp/old-token-addresses.json', JSON.stringify(addresses, null, 2));

        // STAGE 2
        addresses = JSON.parse(fs.readFileSync('./tmp/old-token-addresses.json'));
        console.log('count', addresses.length);

        let balances = {};
        console.log('Fetching address balancess...');
        await pIteration.forEachSeries(addresses, async function(address, index) {
            console.log(`Fetching address #${index} of ${addresses.length}`);
            const balance = await oldToken.balanceOf(address);
            if (balance > 0) {
                balances[address] = balance;
            }
        });

        console.log('Saving dump...');
        fs.writeFileSync('./tmp/old-token-balances.json', JSON.stringify(balances, null, 2));
        console.log('Done. Dump saved to {project_root}/tmp/old-token-balances.json');

        // STAGE 3
        balances = JSON.parse(fs.readFileSync('./tmp/old-token-balances.json'));
        const myTotal = Object.values(balances).reduce((accumulator, address) => {
            return BigInt(address) + accumulator;
        }, BigInt(0));

        console.log('Accumulated total', myTotal);
        console.log('Contract total   ', await oldToken.totalSupply());
    } catch (e) {
        console.log(e);
    }

    callback();
};
