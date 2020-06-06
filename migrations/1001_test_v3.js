/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const assert = require('assert');

const YALLToken = artifacts.require('./YALLToken');
const YALLDistributor = artifacts.require('./YALLDistributor');
const YALLExchange = artifacts.require('./YALLExchange');
const YALLRegistry = artifacts.require('./YALLRegistry');
const Proxy = artifacts.require('AdminUpgradeabilityProxy');
const ProxyAdmin = artifacts.require('ProxyAdmin');
const { web3 } = YALLDistributor;
const { ether, now } = require('@galtproject/solidity-test-chest')(web3);
const { deployRelayHub } = require('@openzeppelin/gsn-helpers');

const keccak256 = web3.utils.soliditySha3;

YALLDistributor.numberFormat = 'String';

const TransferRestrictionsMode = {
  OFF: 0,
  ONLY_MEMBERS: 1,
  ONLY_WHITELIST: 2,
  ONLY_MEMBERS_OR_WHITELIST: 3,
};

module.exports = async function (truffle, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }
  // eslint-disable-next-line global-require
  const { Deployment } = require('../scripts/deployment')(web3, Proxy);
  const deployment = new Deployment(truffle, network, accounts[0]);

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
  // Fee Collector private: 9ee002502c20dea0ab361007c78e8b44aaa92aa6593d130a0a11acddeaf8fb40
  // Fee Collector address: aaaaa67b971f1181f5af957ea4a0fc53cc034f63
  // GSN Fee Collector private: e24f7da8befa6aa68344dc4a3112b891e68f30ad09e0464f8f0915c6745ac65f
  // GSN Fee Collector address: bbbbb53116526b87da15ac05ede1645b16a5e3fa

  const superuser = '0xffffF2B5e1b308331B8548960347f9d874824f40';
  const expectedDeployer = '0xDDddDf4630b0Ca1D7F18B681e61F5F40c0a4A652';
  const feeCollector = 'aaaaa67b971f1181f5af957ea4a0fc53cc034f63';
  const gsnFeeCollector = 'bbbbb53116526b87da15ac05ede1645b16a5e3fa';

  truffle.then(async () => {
    const networkName = network || 'ganache';
    console.log('network name:', networkName);

    let deployer;
    if (network === 'ganache') {
      deployer = (await web3.eth.getAccounts())[0];
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
    // 5 min
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

    console.log('Deploying the contracts...');
    const proxyAdmin = await deployment.factory(ProxyAdmin).name('yallProxyAdmin').arguments().deploy();

    const registry = await deployment
      .factory(YALLRegistry)
      .name('yallRegistry')
      .arguments()
      .deployWithProxy(proxyAdmin.address);

    const dist = await deployment
      .factory(YALLDistributor)
      .name('yallDistributor')
      .arguments(
        periodVolume,
        verifierRewardShare,

        registry.address,
        periodLength,
        genesisTimestamp
      )
      .deployWithProxy(proxyAdmin.address);

    const exchange = await deployment
      .factory(YALLExchange)
      .name('yallExchange')
      .arguments(registry.address, defaultExchangeRateNumerator)
      .deployWithProxy(proxyAdmin.address);

    console.log('Deploying YALLToken contract...');

    const yall = await deployment
      .factory(YALLToken)
      .name('yallToken')
      .arguments(registry.address, 'Yalland Test', 'YALT', 18)
      .deploy();

    deployment.save();

    console.log('GSN checks...');
    assert.equal(await dist.getHubAddr(), await yall.getHubAddr());

    console.log('Setting up Registry and ACL records');
    await Promise.all([
      registry.setContract(await registry.YALL_TOKEN_KEY(), yall.address),
      registry.setContract(await registry.YALL_DISTRIBUTOR_KEY(), dist.address),
      registry.setContract(await registry.YALL_EXCHANGE_KEY(), exchange.address),
      registry.setContract(await registry.YALL_FEE_COLLECTOR_KEY(), feeCollector),
      registry.setContract(await registry.YALL_GSN_FEE_COLLECTOR_KEY(), gsnFeeCollector),

      registry.setRole(dist.address, await yall.YALL_TOKEN_MINTER_ROLE(), true),
      registry.setRole(dist.address, await yall.YALL_TOKEN_BURNER_ROLE(), true),

      registry.setRole(superuser, await dist.PAUSER_ROLE(), true),
      registry.setRole(superuser, await yall.FEE_MANAGER_ROLE(), true),
      registry.setRole(superuser, await yall.YALL_TOKEN_MANAGER_ROLE(), true),
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
      registry.setRole(deployer, await yall.YALL_TOKEN_MANAGER_ROLE(), true),
      registry.setRole(deployer, await yall.DISTRIBUTOR_MANAGER_ROLE(), true),
      registry.setRole(deployer, await yall.DISTRIBUTOR_VERIFIER_ROLE(), true),
      registry.setRole(deployer, await yall.EXCHANGE_MANAGER_ROLE(), true),
    ]);

    console.log('Setting up fees...');
    await yall.setTransferFee(erc20TransferFeeShare);
    await Promise.all([
      yall.setTransferFee(erc20TransferFeeShare),
      yall.setGsnFee(gsnFee),
      dist.setGsnFee(gsnFee),
      exchange.setGsnFee(gsnFee),
    ]);

    console.log('Setting up YALLToken canTransfer whitelist...');
    await Promise.all([
      yall.setCanTransferWhitelistAddress(dist.address, true),
      yall.setCanTransferWhitelistAddress(exchange.address, true),
      yall.setCanTransferWhitelistAddress(superuser, true),
    ]);

    console.log('Setting up YALLToken noTransferFee whitelist...');
    await Promise.all([
      yall.setNoTransferFeeWhitelistAddress(dist.address, true),
      yall.setNoTransferFeeWhitelistAddress(exchange.address, true),
      yall.setNoTransferFeeWhitelistAddress(superuser, true),
    ]);

    console.log('Setting up YALLToken transfer restrictions...');
    await yall.setTransferRestrictionMode(TransferRestrictionsMode.ONLY_MEMBERS_OR_WHITELIST);

    console.log('Setting up exchange limits...');
    await Promise.all([
      exchange.setDefaultMemberPeriodLimit(defaultMemberPeriodLimit),
      exchange.setTotalPeriodLimit(totalPeriodLimit),
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
        '666616209881bc9870fea2f13ae3562cad42ab1b',
      ]
    );

    console.log('Revoking temporary Registry and ACL records for deployer');
    await Promise.all([
      registry.setRole(deployer, await yall.FEE_MANAGER_ROLE(), false),
      registry.setRole(deployer, await yall.YALL_TOKEN_MANAGER_ROLE(), false),
      registry.setRole(deployer, await yall.DISTRIBUTOR_MANAGER_ROLE(), false),
      registry.setRole(deployer, await yall.DISTRIBUTOR_VERIFIER_ROLE(), false),
      registry.setRole(deployer, await yall.EXCHANGE_MANAGER_ROLE(), false),
    ]);

    console.log('Transferring ownerships');
    await Promise.all([registry.transferOwnership(superuser), proxyAdmin.transferOwnership(superuser)]);

    console.log('Checking permissions');
    assert.equal(await registry.owner(), superuser);
    assert.equal(await proxyAdmin.owner(), superuser);
    assert.equal(await proxyAdmin.getProxyAdmin(registry.address), proxyAdmin.address);
    assert.equal(await proxyAdmin.getProxyAdmin(dist.address), proxyAdmin.address);
    assert.equal(await proxyAdmin.getProxyAdmin(exchange.address), proxyAdmin.address);

    console.log('Saving addresses and abi to deployed folder...');
    deployment.save();
  });
};
