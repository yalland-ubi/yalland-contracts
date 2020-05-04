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
const assert = require('assert');

const YALLToken = artifacts.require('./YALLToken');
const YALLDistributor = artifacts.require('./YALLDistributor');
const YALLExchange = artifacts.require('./YALLExchange');
const YALLRegistry = artifacts.require('./YALLRegistry');
const Proxy = artifacts.require('AdminUpgradeabilityProxy');
const ProxyAdmin = artifacts.require('ProxyAdmin');
const { web3 } = YALLDistributor;
const { ether, now, increaseTime } = require('@galtproject/solidity-test-chest')(web3);
const {
    fundRecipient,
    deployRelayHub
} = require('@openzeppelin/gsn-helpers');
const keccak256 = web3.utils.soliditySha3;

YALLDistributor.numberFormat = 'String';

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
    // Deployer private: 8e1b9e2b156bc61d74482427f522842d8b1e6252b284da4d80fcbd95638d9ee9
    // Deployer address: dddddf4630b0ca1d7f18b681e61f5f40c0a4a652
    // Operations private: 9ee002502c20dea0ab361007c78e8b44aaa92aa6593d130a0a11acddeaf8fb40
    // Operations address: aaaaa67b971f1181f5af957ea4a0fc53cc034f63

    const superuser = '0xffffF2B5e1b308331B8548960347f9d874824f40';
    const expectedDeployer = '0xDDddDf4630b0Ca1D7F18B681e61F5F40c0a4A652';

    truffle.then(async () => {
        const networkName = network || 'ganache';
        console.log('network name:', networkName);

        let deployer;
        if (network === 'ganache') {
            deployer = (await web3.eth.getAccounts())[0]
        } else {
            deployer = truffle.networks[networkName].from;
            assert.equal(accounts[0], expectedDeployer, 'Please, deploy using the above deployer address');
        }
        console.log('deployer address:', deployer);

        // deploys a relay hub if it's not deployed yet
        await deployRelayHub(web3);

        // 5 min
        const periodLength = 5 * 60;
        const periodVolume = ether(275 * 1000);
        const verifierRewardShare = ether(10);
        // 10 min
        const startAfter = 5 * 60;
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

        console.log('Deploying the proxied contract implementations...');
        const registryImplementation = await truffle.deploy(YALLRegistry);
        const distImplementation = await truffle.deploy(YALLDistributor);
        const exchangeImplementation = await truffle.deploy(YALLExchange);
        const proxyAdmin = await truffle.deploy(ProxyAdmin);

        console.log('Deploying YALLDistributor/YALLExchange proxy instances...');
        const registryProxy = await Proxy.new(
            registryImplementation.address,
            deployer,
            registryImplementation.contract.methods.initialize().encodeABI()
        );
        const distProxy = await Proxy.new(
            distImplementation.address,
            deployer,
            distImplementation.contract.methods.initialize(
                periodVolume,
                verifierRewardShare,

                registryProxy.address,
                periodLength,
                genesisTimestamp
            ).encodeABI()
        );
        const exchangeProxy = await Proxy.new(
            exchangeImplementation.address,
            deployer,
            exchangeImplementation.contract.methods.initialize(
                registryProxy.address,
                defaultExchangeRateNumerator
            ).encodeABI()
        );

        console.log('Transferring proxy admin permissions to the ProxyAdmin contract');
        await Promise.all([
            registryProxy.changeAdmin(proxyAdmin.address),
            distProxy.changeAdmin(proxyAdmin.address),
            exchangeProxy.changeAdmin(proxyAdmin.address)
        ]);

        console.log('Deploying YALLToken contract...');
        const yall = await truffle.deploy(YALLToken, registryProxy.address, "Yalland Test", "YALT", 18);

        const registry = await YALLRegistry.at(registryProxy.address);
        const dist = await YALLDistributor.at(distProxy.address);
        const exchange = await YALLExchange.at(exchangeProxy.address);

        console.log('GSN checks...');
        assert.equal(await dist.getHubAddr(), await yall.getHubAddr());

        console.log('Funding GSN recipients...');
        // await Promise.all([
        //     fundRecipient(web3, { recipient: yall.address, amount: ether(1) }),
        //     fundRecipient(web3, { recipient: dist.address, amount: ether(1) }),
        //     fundRecipient(web3, { recipient: exchange.address, amount: ether(1) })
        // ]);

        console.log('Setting up Registry and ACL records');
        await Promise.all([
            registry.setContract(await registry.YALL_TOKEN_KEY(), yall.address),
            registry.setContract(await registry.YALL_DISTRIBUTOR_KEY(), dist.address),
            registry.setContract(await registry.YALL_EXCHANGE_KEY(), exchange.address),
            registry.setRole(dist.address, await yall.YALL_TOKEN_MINTER_ROLE(), true),
            registry.setRole(dist.address, await yall.YALL_TOKEN_BURNER_ROLE(), true),

            registry.setRole(superuser, await dist.PAUSER_ROLE(), true),
            registry.setRole(superuser, await yall.FEE_MANAGER_ROLE(), true),
            registry.setRole(superuser, await yall.FEE_CLAIMER_ROLE(), true),
            registry.setRole(superuser, await yall.YALL_TOKEN_WHITELIST_MANAGER_ROLE(), true),
            registry.setRole(superuser, await yall.DISTRIBUTOR_MANAGER_ROLE(), true),
            registry.setRole(superuser, await yall.DISTRIBUTOR_VERIFIER_ROLE(), true),
            registry.setRole(superuser, await yall.DISTRIBUTOR_EMISSION_CLAIMER_ROLE(), true),
            registry.setRole(superuser, await yall.EXCHANGE_MANAGER_ROLE(), true),
            registry.setRole(superuser, await yall.EXCHANGE_OPERATOR_ROLE(), true),
            registry.setRole(superuser, await yall.EXCHANGE_SUPER_OPERATOR_ROLE(), true),
        ]);

        console.log('Setting up temporary Registry and ACL records for deployer');
        await Promise.all([
            registry.setRole(deployer, await yall.FEE_MANAGER_ROLE(), true),
            registry.setRole(deployer, await yall.YALL_TOKEN_WHITELIST_MANAGER_ROLE(), true),
            registry.setRole(deployer, await yall.DISTRIBUTOR_MANAGER_ROLE(), true),
            registry.setRole(deployer, await yall.DISTRIBUTOR_VERIFIER_ROLE(), true),
            registry.setRole(deployer, await yall.EXCHANGE_MANAGER_ROLE(), true)
        ]);

        console.log('Setting up fees...');
        await yall.setTransferFee(erc20TransferFeeShare);
        await Promise.all([
            yall.setTransferFee(erc20TransferFeeShare),
            yall.setGsnFee(gsnFee),
            dist.setGsnFee(gsnFee),
            exchange.setGsnFee(gsnFee),
        ]);

        console.log('Setting up whitelisted contracts for token transfers...');
        await Promise.all([
            yall.setWhitelistAddress(dist.address, true),
            yall.setWhitelistAddress(exchange.address, true),
            yall.setWhitelistAddress(superuser, true)
        ]);

        console.log('Setting up exchange limits...');
        await Promise.all([
            exchange.setDefaultMemberPeriodLimit(defaultMemberPeriodLimit),
            exchange.setTotalPeriodLimit(totalPeriodLimit)
        ]);

        console.log('Adding initial members...');
        await dist.addMembersBeforeGenesis(
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
            ]);

        console.log('Revoking temporary Registry and ACL records for deployer');
        await Promise.all([
            registry.setRole(superuser, await yall.FEE_MANAGER_ROLE(), false),
            registry.setRole(superuser, await yall.YALL_TOKEN_WHITELIST_MANAGER_ROLE(), false),
            registry.setRole(superuser, await yall.DISTRIBUTOR_MANAGER_ROLE(), false),
            registry.setRole(superuser, await yall.DISTRIBUTOR_VERIFIER_ROLE(), false),
            registry.setRole(superuser, await yall.EXCHANGE_MANAGER_ROLE(), false)
        ]);

        console.log('Transferring ownerships');
        await Promise.all([
            registry.transferOwnership(superuser),
            proxyAdmin.transferOwnership(superuser)
        ]);

        console.log('Checking permissions');
        assert.equal(await registry.owner(), superuser);
        assert.equal(await proxyAdmin.owner(), superuser);
        assert.equal(await proxyAdmin.getProxyAdmin(registryProxy.address), proxyAdmin.address);
        assert.equal(await proxyAdmin.getProxyAdmin(distProxy.address), proxyAdmin.address);
        assert.equal(await proxyAdmin.getProxyAdmin(exchangeProxy.address), proxyAdmin.address);

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
                        yallProxyAdminAddress: proxyAdmin.address,
                        yallProxyAdminAbi: proxyAdmin.abi,
                        yallRegistryAddress: registry.address,
                        yallRegistryAbi: registry.abi,
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
