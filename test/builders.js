/* eslint-disable no-unused-expressions */

const { defaultSender } = require('@openzeppelin/test-environment');
const { contract } = require('./twrapper');
// eslint-disable-next-line import/order
const { ether, now } = require('@galtproject/solidity-test-chest')(web3);

const YALLToken = contract.fromArtifact('YALLToken');
const YALLRegistry = contract.fromArtifact('YALLRegistry');
const YALLDistributor = contract.fromArtifact('YALLDistributor');
const YALLExchange = contract.fromArtifact('YALLExchange');
const YALLEmissionRewardPool = contract.fromArtifact('YALLEmissionRewardPool');
const YALLCommissionRewardPool = contract.fromArtifact('YALLCommissionRewardPool');
const YALLVerification = contract.fromArtifact('YALLVerification');
const StakingHomeMediator = contract.fromArtifact('StakingHomeMediator');
const Proxy = contract.fromArtifact('AdminUpgradeabilityProxy');
const ProxyAdmin = contract.fromArtifact('ProxyAdmin');

YALLToken.numberFormat = 'String';
YALLExchange.numberFormat = 'String';
YALLDistributor.numberFormat = 'String';
YALLEmissionRewardPool.numberFormat = 'String';
YALLCommissionRewardPool.numberFormat = 'String';
YALLVerification.numberFormat = 'String';
StakingHomeMediator.numberFormat = 'String';

const TransferRestrictionsMode = {
  OFF: 0,
  ONLY_MEMBERS: 1,
  ONLY_WHITELIST: 2,
  ONLY_MEMBERS_OR_WHITELIST: 3,
};

async function deployWithProxy(contractFactory, proxyAdminAddress, ...args) {
  const implementation = await contractFactory.new();
  const proxy = await Proxy.new(
    implementation.address,
    proxyAdminAddress,
    implementation.contract.methods.initialize(...args).encodeABI()
  );

  const contractImplementation = await contractFactory.at(proxy.address);

  return {
    implementation,
    proxy,
    contract: contractImplementation,
  };
}

async function buildCoinDistAndExchange(governance, config) {
  const periodVolume = config.periodVolume || ether(250);

  // 7 days
  const periodLength = 7 * 24 * 60 * 60;
  const emissionPoolRewardShare = ether(10);
  const emissionDelegatorShare = ether(40);
  const emissionVerifierShare = ether(60);
  const commissionDelegatorShare = ether(40);
  const commissionVerifierShare = ether(10);
  const commissionMemberShare = ether(50);
  const startAfter = 10;
  const genesisTimestamp = parseInt(await now(), 10) + startAfter;

  const proxyAdmin = await ProxyAdmin.new();

  const registryDeployment = await deployWithProxy(YALLRegistry, proxyAdmin.address);
  const registry = registryDeployment.contract;

  const distDeployment = await deployWithProxy(
    YALLDistributor,
    proxyAdmin.address,
    periodVolume,
    emissionPoolRewardShare,

    registry.address,
    periodLength,
    genesisTimestamp
  );
  const dist = distDeployment.contract;

  let exchange;
  if (!config.disableExchange) {
    const exchangeDeployment = await deployWithProxy(
      YALLExchange,
      proxyAdmin.address,
      registry.address,
      // defaultExchangeRate numerator
      ether(42)
    );
    exchange = exchangeDeployment.contract;
  }

  let emission;
  if (!config.disableEmission) {
    const emissionDeployment = await deployWithProxy(
      YALLEmissionRewardPool,
      proxyAdmin.address,
      registry.address,
      emissionDelegatorShare,
      emissionVerifierShare
    );
    emission = emissionDeployment.contract;
  }

  let commission;
  if (!config.disableCommission) {
    const commissionDeployment = await deployWithProxy(
      YALLCommissionRewardPool,
      proxyAdmin.address,
      registry.address,
      commissionDelegatorShare,
      commissionVerifierShare,
      commissionMemberShare
    );
    commission = commissionDeployment.contract;
  }

  let verification;
  if (!config.disableVerification) {
    const verificationDeployment = await deployWithProxy(YALLVerification, proxyAdmin.address, registry.address);
    verification = verificationDeployment.contract;
  }

  let homeMediator;
  if (config.bridge && config.mediatorOnTheOtherSide) {
    const res = await deployWithProxy(
      StakingHomeMediator,
      proxyAdmin.address,
      // initialize() arguments
      config.bridge,
      config.mediatorOnTheOtherSide,
      2000000,
      // oppositeChainId,
      0,
      // owner
      defaultSender
    );
    homeMediator = res.contract;
    await registry.setContract(await registry.YALL_HOME_MEDIATOR_KEY(), homeMediator.address);
  }

  const yallToken = await YALLToken.new(registry.address, 'Coin token', 'COIN', 18);

  // Setting up contract addresses
  await registry.setContract(await registry.YALL_TOKEN_KEY(), yallToken.address);
  await registry.setContract(await registry.YALL_DISTRIBUTOR_KEY(), dist.address);
  exchange && (await registry.setContract(await registry.YALL_EXCHANGE_KEY(), exchange.address));
  verification && (await registry.setContract(await registry.YALL_VERIFICATION_KEY(), verification.address));
  commission && (await registry.setContract(await registry.YALL_COMMISSION_REWARD_POOL_KEY(), commission.address));
  emission && (await registry.setContract(await registry.YALL_EMISSION_REWARD_POOL_KEY(), emission.address));
  await registry.setContract(await registry.YALL_FEE_COLLECTOR_KEY(), config.feeCollector || commission.address);
  await registry.setContract(await registry.YALL_GSN_FEE_COLLECTOR_KEY(), config.gsnFeeCollector);

  if (!config.onlyCustomACL) {
    await registry.setRole(dist.address, await yallToken.YALL_TOKEN_MINTER_ROLE(), true);
    await registry.setRole(dist.address, await yallToken.YALL_TOKEN_BURNER_ROLE(), true);
    emission && (await registry.setRole(emission.address, await yallToken.DISTRIBUTOR_EMISSION_CLAIMER_ROLE(), true));
    commission && (await registry.setRole(commission.address, await yallToken.FEE_CLAIMER_ROLE(), true));
    verification && (await registry.setRole(verification.address, await dist.DISTRIBUTOR_VERIFIER_ROLE(), true));
  }
  // Setting up ACL roles
  // common
  config.governance && (await registry.setRole(config.governance, await dist.GOVERNANCE_ROLE(), true));
  config.pauser && (await registry.setRole(config.pauser, await dist.PAUSER_ROLE(), true));
  config.feeManager && (await registry.setRole(config.feeManager, await yallToken.FEE_MANAGER_ROLE(), true));
  config.feeClaimer && (await registry.setRole(config.feeClaimer, await yallToken.FEE_CLAIMER_ROLE(), true));
  // yallToken
  config.yallMinter && (await registry.setRole(config.yallMinter, await yallToken.YALL_TOKEN_MINTER_ROLE(), true));
  config.yallBurner && (await registry.setRole(config.yallBurner, await yallToken.YALL_TOKEN_BURNER_ROLE(), true));
  config.yallTokenManager &&
    (await registry.setRole(config.yallTokenManager, await yallToken.YALL_TOKEN_MANAGER_ROLE(), true));
  // yallDistributor
  config.distributorManager &&
    (await registry.setRole(config.distributorManager, await dist.DISTRIBUTOR_MANAGER_ROLE(), true));
  config.distributorVerifier &&
    (await registry.setRole(config.distributorVerifier, await dist.DISTRIBUTOR_VERIFIER_ROLE(), true));
  config.distributorEmissionClaimer &&
    (await registry.setRole(config.distributorEmissionClaimer, await dist.DISTRIBUTOR_EMISSION_CLAIMER_ROLE(), true));
  // yallExchange
  config.exchangeManager &&
    (await registry.setRole(config.exchangeManager, await exchange.EXCHANGE_MANAGER_ROLE(), true));
  config.exchangeOperator &&
    (await registry.setRole(config.exchangeOperator, await exchange.EXCHANGE_OPERATOR_ROLE(), true));
  config.exchangeSuperOperator &&
    (await registry.setRole(config.exchangeSuperOperator, await exchange.EXCHANGE_SUPER_OPERATOR_ROLE(), true));
  config.commissionRewardPoolManager &&
    (await registry.setRole(config.commissionRewardPoolManager, await dist.COMMISSION_POOL_MANAGER_ROLE(), true));
  config.emissionRewardPoolManager &&
    (await registry.setRole(config.emissionRewardPoolManager, await dist.EMMISSION_POOL_MANAGER_ROLE(), true));

  // setup whitelisted contracts
  await registry.setRole(defaultSender, await yallToken.YALL_TOKEN_MANAGER_ROLE(), true);

  // can transfer whitelist
  await yallToken.setCanTransferWhitelistAddress(yallToken.address, true);
  await yallToken.setCanTransferWhitelistAddress(dist.address, true);
  exchange && (await yallToken.setCanTransferWhitelistAddress(exchange.address, true));
  commission && (await yallToken.setCanTransferWhitelistAddress(commission.address, true));
  emission && (await yallToken.setCanTransferWhitelistAddress(emission.address, true));
  // config.feeClaimer && await yallToken.setCanTransferWhitelistAddress(config.feeClaimer, true);
  config.feeCollector && (await yallToken.setCanTransferWhitelistAddress(config.feeCollector, true));
  config.gsnFeeCollector && (await yallToken.setCanTransferWhitelistAddress(config.gsnFeeCollector, true));

  // no fee whitelist
  await yallToken.setNoTransferFeeWhitelistAddress(yallToken.address, true);
  await yallToken.setNoTransferFeeWhitelistAddress(dist.address, true);
  exchange && (await yallToken.setNoTransferFeeWhitelistAddress(exchange.address, true));
  commission && (await yallToken.setNoTransferFeeWhitelistAddress(commission.address, true));
  emission && (await yallToken.setNoTransferFeeWhitelistAddress(emission.address, true));
  config.feeCollector && (await yallToken.setNoTransferFeeWhitelistAddress(config.feeCollector, true));
  config.gsnFeeCollector && (await yallToken.setNoTransferFeeWhitelistAddress(config.gsnFeeCollector, true));

  await yallToken.setTransferRestrictionMode(TransferRestrictionsMode.ONLY_MEMBERS_OR_WHITELIST);

  await registry.setRole(defaultSender, await yallToken.YALL_TOKEN_MANAGER_ROLE(), false);

  await registry.transferOwnership(governance);
  await proxyAdmin.transferOwnership(governance);

  return {
    registry,
    yallToken,
    dist,
    exchange,
    genesisTimestamp,
    proxyAdmin,
    emission,
    commission,
    homeMediator,
    verification,
  };
}

module.exports = {
  buildCoinDistAndExchange,
  deployWithProxy,
  TransferRestrictionsMode,
};
