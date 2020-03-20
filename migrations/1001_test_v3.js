/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const CoinToken = artifacts.require('./CoinToken');
const YALDistributor = artifacts.require('./YALDistributor');
const { ether, now } = require('@galtproject/solidity-test-chest')(web3);

module.exports = async function (truffle, network, accounts) {
    if (network === 'test' || network === 'local_test' || network === 'development') {
        console.log('Skipping deployment migration');
        return;
    }

    const beneficiary = '0x15d9bb6e47ef19fdf4e2e67c95ed997588c3fd37';
    truffle.then(async () => {
        const deployer = truffle.networks.yalland.from;
        console.log('deployer address:', deployer);

        console.log('Create contract instances...');
        const coinToken = await truffle.deploy(CoinToken, "Yalland Test", "YALT", 18);
        const dist = await truffle.deploy(YALDistributor);

        // 10 min
        const periodLength = 10 * 60;
        const periodVolume = ether(250 * 1000);
        const verifierRewardShare = ether(10);
        // 30 min
        const startAfter = 30 * 60;
        const genesisTimestamp = parseInt(await now(), 10) + startAfter;

        await dist.initialize(
            periodVolume,
            // verifierAddress
            beneficiary,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
        );

        await coinToken.setTransferFee(web3.utils.toWei('0.02', 'szabo'));
        await coinToken.addRoleTo(dist.address, "minter");

        await coinToken.addRoleTo(beneficiary, await coinToken.ROLE_ROLE_MANAGER());
        await coinToken.removeRoleFrom(deployer, await coinToken.ROLE_ROLE_MANAGER());
        await dist.transferOwnership(beneficiary);
    });
};
