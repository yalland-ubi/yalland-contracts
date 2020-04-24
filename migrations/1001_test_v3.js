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
const YALExchange = artifacts.require('./YALExchange');
const Proxy = artifacts.require('./OwnedUpgradeabilityProxy');
const { web3 } = YALDistributor;
const { ether, now } = require('@galtproject/solidity-test-chest')(web3);
const {
    fundRecipient,
    deployRelayHub
} = require('@openzeppelin/gsn-helpers');
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
    // User4 private: 522584f79ee1532f78f277764cba66202f17a2e1e4bc45fdbaa8fba23424c4cd
    // User4 address: 444445886b9f7567cd712cc4a10a1062ac4997c0
    // User5 private: a6a41693e93dd11b95a1f4c4c975887866cbffaef3ef9dc0879907d6e655e791
    // User5 address: 555503322a4998ac49a1d83c3df75706ec6456bd
    // User6 private: ae0ac26c14927195ff348c157e98bc0ac5e4325c8cd66f1fe6ab95e36dd5bbfa
    // User6 address: 666616209881bc9870fea2f13ae3562cad42ab1b
    // Superuser private: a46e68b3f1881ca65ddb387b9e9baf28c3da1f6848d3f93cd206e51549453669
    // Superuser address: fffff2b5e1b308331b8548960347f9d874824f40


    const superuser = 'fffff2b5e1b308331b8548960347f9d874824f40';
    truffle.then(async () => {
        const networkName = network || 'ganache';
        console.log('network name:', networkName);

        let deployer;
        if (network === 'ganache') {
            deployer = (await web3.eth.getAccounts())[0]
        } else {
            deployer = truffle.networks[networkName].from;
        }
        console.log('deployer address:', deployer);

        await deployRelayHub(web3);

        console.log('Deploying CoinToken contract...');
        const yall = await truffle.deploy(CoinToken, deployer, "Yalland Test", "YALT", 18);

        console.log('Deploying YALDistributor/YALExchange proxy instances...');
        const distProxy = await Proxy.new();
        const exchangeProxy = await Proxy.new();

        console.log('Deploying YALDistributor/YALExchange contract implementations...');
        const distImplementation = await truffle.deploy(YALDistributor);
        const exchangeImplementation = await truffle.deploy(YALExchange);

        // 5 min
        const periodLength = 5 * 60;
        const periodVolume = ether(275 * 1000);
        const verifierRewardShare = ether(10);
        // 10 min
        const startAfter = 3 * 60;
        const genesisTimestamp = parseInt(await now(), 10) + startAfter;
        const defaultExchangeRateNumerator = ether(42);

        // limits
        const defaultMemberPeriodLimit = ether(30 * 1000);
        const totalPeriodLimit = ether(70 * 1000);

        // fees
        // in YAL
        const gsnFee = ether('0.87');
        // 0.0002%
        const erc20TransferFeeShare = ether('0.02');

        const distInitTx = distImplementation.contract.methods.initialize(
            periodVolume,
            // verifierAddress
            deployer,
            verifierRewardShare,

            yall.address,
            periodLength,
            genesisTimestamp
        ).encodeABI();

        const exchangeInitTx = exchangeImplementation.contract.methods.initialize(
            // owner
            deployer,
            distProxy.address,
            yall.address,
            defaultExchangeRateNumerator
        ).encodeABI();

        console.log('Initializing proxies...');
        await Promise.all([
            distProxy.upgradeToAndCall(distImplementation.address, distInitTx),
            exchangeProxy.upgradeToAndCall(exchangeImplementation.address, exchangeInitTx),
        ]);
        // TODO: initialize implementation with 0s

        const dist = await YALDistributor.at(distProxy.address);
        const exchange = await YALExchange.at(exchangeProxy.address);

        console.log('GSN checks...');
        console.log('YALLToken:', await yall.getHubAddr());
        console.log('YALLDistributor:', await dist.getHubAddr());
        console.log('YALLExchange:', await exchange.getHubAddr());

        // console.log('Funding GSN recipients...');
        await Promise.all([
            fundRecipient(web3, { recipient: yall.address, amount: ether(1) }),
            fundRecipient(web3, { recipient: dist.address, amount: ether(1) }),
            fundRecipient(web3, { recipient: exchange.address, amount: ether(1) })
        ]);


        console.log('Granting deployer permissions...');
        await Promise.all([
            exchange.addRoleTo(deployer, 'fund_manager'),
            yall.addRoleTo(deployer, 'fee_manager'),
            yall.addRoleTo(deployer, 'transfer_wl_manager'),
        ]);

        console.log('Setting up superuser permissions...');
        await Promise.all([
            yall.addRoleTo(dist.address, 'minter'),
            yall.addRoleTo(dist.address, 'burner'),
            yall.addRoleTo(superuser, 'pauser'),
            yall.addRoleTo(superuser, 'fee_manager'),
            yall.addRoleTo(superuser, 'transfer_wl_manager'),
            yall.addRoleTo(superuser, 'role_manager'),

            exchange.addRoleTo(superuser, 'fund_manager'),
            exchange.addRoleTo(superuser, 'operator'),
            exchange.addRoleTo(superuser, 'super_operator'),
            exchange.addRoleTo(superuser, 'pauser'),
        ]);

        console.log('Setting up fees...');
        await Promise.all([
            yall.setTransferFee(erc20TransferFeeShare),
            yall.setGsnFee(gsnFee),
            dist.setGsnFee(gsnFee),
            exchange.setGsnFee(gsnFee),
        ]);

        console.log('Setting up whitelisted contracts for token transfers...');
        await yall.setWhitelistAddress(dist.address, true);
        await yall.setWhitelistAddress(exchange.address, true);
        await yall.setWhitelistAddress(superuser, true);

        console.log('Setting up exchange limits...');
        await exchange.setDefaultMemberPeriodLimit(defaultMemberPeriodLimit);
        await exchange.setTotalPeriodLimit(totalPeriodLimit);

        console.log('Linking contracts...');
        await yall.setDistributor(dist.address);

        console.log('Adding initial members...');
        await Promise.all([
            dist.addMembersBeforeGenesis(
                [
                    keccak256('user1'),
                    keccak256('user2'),
                    keccak256('user3'),
                    keccak256('user4'),
                    keccak256('user5'),
                    keccak256('user6'),
                ],
                [
                    '111119454839c655ecbf662a292de4fc597a9f44',
                    '2222ebc798ebe6517adf90483d1ca69b5276978b',
                    '3333331e386a009d9538e759a92ddb37f8da4852',
                    '444445886b9f7567cd712cc4a10a1062ac4997c0',
                    '555503322a4998ac49a1d83c3df75706ec6456bd',
                    '666616209881bc9870fea2f13ae3562cad42ab1b'
                ]),
        ]);

        console.log('Revoking CoinToken deployer permissions...');
        await Promise.all([
            exchange.removeRoleFrom(deployer, 'fund_manager'),
            yall.removeRoleFrom(deployer, 'fee_manager'),
            yall.removeRoleFrom(deployer, 'transfer_wl_manager'),
            yall.removeRoleFrom(deployer, 'role_manager'),
        ]);

        console.log('Revoking YALDistributor deployer permissions...');
        await dist.setVerifier(superuser);
        await dist.transferOwnership(superuser);

        console.log('Revoking YALExchange deployer permissions...');
        await exchange.transferOwnership(superuser);

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
                        yallTokenAddress: yall.address,
                        yallTokenAbi: yall.abi,
                        yallDistributorAddress: dist.address,
                        yallDistributorAbi: dist.abi,
                        yallExchangeAddress: exchange.address,
                        yallExchangeAbi: exchange.abi
                    }),
                    null,
                    2
                ),
                resolve
            );
        });
    });
};
