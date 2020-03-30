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

const CoinToken = artifacts.require('./CoinToken');
const YALDistributor = artifacts.require('./YALDistributor');
const { ether, now } = require('@galtproject/solidity-test-chest')(web3);
const keccak256 = web3.utils.soliditySha3;

module.exports = async function (truffle, network, accounts) {
    if (network === 'test' || network === 'local_test' || network === 'development') {
        console.log('Skipping deployment migration');
        return;
    }
    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());


    // User1 private: 849381f70496d2d13ceb5ca5c07fb88445df8d5f78492ffa2d318b7d6118a933
    // User1 address: 111119454839c655ecbf662a292de4fc597a9f44
    // User2 private: 83e4b681814f3bbe09952d94999e194c25a52e5c3ebf36b09d77f16ff8a10da8
    // User2 address: 2222ebc798ebe6517adf90483d1ca69b5276978b
    // User3 private: 53fc51359ec13ead43b3a31253063188c13c82ec4769dfdcc17dcc37edcacfd6
    // User3 address: 3333331e386a009d9538e759a92ddb37f8da4852



    const beneficiary = '0x699224Cc2b2D2DDF8bc7852582541cF4DdC4F77f';
    truffle.then(async () => {
        const deployer = truffle.networks.kovan.from;
        console.log('deployer address:', deployer);

        console.log('Create contract instances...');
        const coinToken = await truffle.deploy(CoinToken, "Yalland Test", "YALT", 18);
        const dist = await truffle.deploy(YALDistributor);

        // 5 min
        const periodLength = 5 * 60;
        const periodVolume = ether(250 * 1000);
        const verifierRewardShare = ether(10);
        // 10 min
        const startAfter = 10 * 60;
        const genesisTimestamp = parseInt(await now(), 10) + startAfter;

        await dist.initialize(
            periodVolume,
            // verifierAddress
            deployer,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
        );

        await Promise.all([
            coinToken.setTransferFee(web3.utils.toWei('0.02', 'szabo')),
            coinToken.addRoleTo(dist.address, "minter"),
            dist.addMembersBeforeGenesis(
                [
                    keccak256('user1'),
                    keccak256('user2'),
                    keccak256('user3'),
                ],
                [
                    '111119454839c655ecbf662a292de4fc597a9f44',
                    '2222ebc798ebe6517adf90483d1ca69b5276978b',
                    '3333331e386a009d9538e759a92ddb37f8da4852'
                ]),
            coinToken.addRoleTo(beneficiary, await coinToken.ROLE_ROLE_MANAGER())
        ]);


        await coinToken.removeRoleFrom(deployer, await coinToken.ROLE_ROLE_MANAGER());
        await dist.setVerifier(beneficiary);
        await dist.transferOwnership(beneficiary);

        console.log('Saving addresses and abi to deployed folder...');
        await new Promise(resolve => {
            const deployDirectory = `${__dirname}/../deployed`;
            if (!fs.existsSync(deployDirectory)) {
                fs.mkdirSync(deployDirectory);
            }

            const deployFile = `${deployDirectory}/${network}.json`;
            console.log(`saved to ${deployFile}`);

            fs.writeFile(
                deployFile,
                JSON.stringify(
                    _.extend(data, {
                        testCoinTokenAddress: coinToken.address,
                        testCoinTokenAbi: coinToken.abi,
                        testYalDistributorAddress: dist.address,
                        testYalDistributorAbi: dist.abi
                    }),
                    null,
                    2
                ),
                resolve
            );
        });
    });
};
