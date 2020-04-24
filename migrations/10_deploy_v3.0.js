/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const fs = require('fs');
const _ = require('lodash');

const CoinToken = artifacts.require('./CoinTokenL');
const YALDistributor = artifacts.require('./YALDistributorL');
const { ether, now } = require('@galtproject/solidity-test-chest')(web3);

let lastCoinAddress;

module.exports = async function (truffle, network, accounts) {
    if (network === 'test' || network === 'local_test' || network === 'development') {
        console.log('Skipping deployment migration');
        return;
    }
    const networkFile = process.env.RESULT_FILE || network;
    let data = {};
    try {
        data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${networkFile}.json`).toString());
    } catch(e) {}

    truffle.then(async () => {
        const deployer = truffle.networks.kovan.from;
        console.log('deployer address:', deployer);

        console.log('Create contract instances...');
        const dist = await truffle.deploy(YALDistributor);

        const yalDistributorOwner = '0xf0430bbb78C3c359c22d4913484081A563B86170';
        const yalDistributorVerifier = '0x7DB143B5B2Ef089992c89a27B015Ab47391cdfFE';

        let coinToken;
        if(lastCoinAddress) {
            coinToken = await CoinToken.at(lastCoinAddress);
        } else {
            coinToken = await CoinToken.new("Yalland", "YAL", '18');
        }
        // 1 week
        const periodLength = process.env.PERIOD || 7 * 24 * 60 * 60;
        // 00:00 30 Mar 2020 UTC+2
        const genesisTimestamp = 1585519200;
        // 275_000 YAL
        const periodVolume = ether(275 * 1000);
        // 10%
        const verifierRewardShare = ether(10);

        console.log('dist.initialize');
        await dist.initialize(
            periodVolume,
            yalDistributorVerifier,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
        );

        if(!lastCoinAddress) {
            console.log('coinToken.addRoleTo');
            await coinToken.addRoleTo(dist.address, await coinToken.MINTER_ROLE());
        }

        console.log('dist.transferOwnership');
        await dist.transferOwnership(yalDistributorOwner);

        console.log('Saving addresses and abi to deployed folder...');
        await new Promise(resolve => {
            const deployDirectory = `${__dirname}/../deployed`;
            if (!fs.existsSync(deployDirectory)) {
                fs.mkdirSync(deployDirectory);
            }

            const deployFile = `${deployDirectory}/${networkFile}.json`;
            console.log(`saved to ${deployFile}`);

            fs.writeFile(
                deployFile,
                JSON.stringify(
                    _.extend(data, {
                        coinTokenAddress: coinToken.address,
                        coinTokenAbi: coinToken.abi,
                        yalDistributorAddress: dist.address,
                        yalDistributorAbi: dist.abi
                    }),
                    null,
                    2
                ),
                resolve
            );
        });
    });
};
