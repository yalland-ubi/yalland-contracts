const { contract, web3, defaultSender } = require('@openzeppelin/test-environment');

const YALLToken = contract.fromArtifact('YALLToken');
const YALLRegistry = contract.fromArtifact('YALLRegistry');
const YALLDistributor = contract.fromArtifact('YALLDistributor');
const YALLExchange = contract.fromArtifact('YALLExchange');
const YALLEmissionRewardPool = contract.fromArtifact('YALLEmissionRewardPool');
const YALLVerification = contract.fromArtifact('YALLVerification');
const StakingHomeMediator = contract.fromArtifact('StakingHomeMediator');
const Proxy = contract.fromArtifact('AdminUpgradeabilityProxy');
const ProxyAdmin = contract.fromArtifact('ProxyAdmin');

YALLToken.numberFormat = 'String';
YALLExchange.numberFormat = 'String';
YALLDistributor.numberFormat = 'String';
YALLEmissionRewardPool.numberFormat = 'String';
StakingHomeMediator.numberFormat = 'String';

const { ether, now, zeroAddress } = require('@galtproject/solidity-test-chest')(web3);


async function deployWithProxy(implContract, proxyAdminAddress, ...args) {
    const implementation = await implContract.new();
    const proxy = await Proxy.new(
      implementation.address,
      proxyAdminAddress,
      implementation.contract.methods.initialize(...args).encodeABI()
    );

    const contract = await implContract.at(proxy.address);

    return {
        implementation,
        proxy,
        contract
    }
}

async function buildCoinDistAndExchange(web3, governance, config) {
    const bytes32 = web3.utils.utf8ToHex;
    const keccak256 = web3.utils.soliditySha3;

    const periodVolume = config.periodVolume || ether(250)

    // 7 days
    const periodLength = 7 * 24 * 60 * 60;
    const emissionPoolRewardShare = ether(10);
    const emissionDelegatorShare = ether(40);
    const emissionVerifierShare = ether(60);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    const memberId2 = keccak256('charlie');
    const memberId3 = keccak256('dan');
    const memberId4 = keccak256('eve');
    const genesisTimestamp = parseInt(await now(), 10) + startAfter;

    const proxyAdmin = await ProxyAdmin.new();

    const registryDeployment = await deployWithProxy(
      YALLRegistry,
      proxyAdmin.address,
    );
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

    const exchangeDeployment = await deployWithProxy(
        YALLExchange,
        proxyAdmin.address,
        registry.address,
        // defaultExchangeRate numerator
        ether(42)
    );
    const exchange = exchangeDeployment.contract;

    const emissionDeployment = await deployWithProxy(
      YALLEmissionRewardPool,
      proxyAdmin.address,
      registry.address,
      emissionDelegatorShare,
      emissionVerifierShare
    );
    const emission = emissionDeployment.contract;

    const verificationDeployment = await deployWithProxy(
      YALLVerification,
      proxyAdmin.address,
      registry.address,
    );
    const verification = verificationDeployment.contract;

    let homeMediator;
    if (config.bridge && config.mediatorOnTheOtherSide) {
        let res = await deployWithProxy(
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

    const yallToken = await YALLToken.new(registry.address, "Coin token", "COIN", 18);

    // Setting up contract addresses
    await registry.setContract(await registry.YALL_TOKEN_KEY(), yallToken.address);
    await registry.setContract(await registry.YALL_DISTRIBUTOR_KEY(), dist.address);
    await registry.setContract(await registry.YALL_EXCHANGE_KEY(), exchange.address);
    await registry.setContract(await registry.YALL_VERIFICATION_KEY(), verification.address);
    await registry.setContract(await registry.YALL_EMISSION_REWARD_POOL_KEY(), emission.address);

    if (!config.onlyCustomACL) {
        await registry.setRole(dist.address, await yallToken.YALL_TOKEN_MINTER_ROLE(), true);
        await registry.setRole(dist.address, await yallToken.YALL_TOKEN_BURNER_ROLE(), true);
        await registry.setRole(emission.address, await yallToken.DISTRIBUTOR_EMISSION_CLAIMER_ROLE(), true);
    }
    // Setting up ACL roles
    // common
    config.pauser && await registry.setRole(config.pauser, await dist.PAUSER_ROLE(), true);
    config.feeManager && await registry.setRole(config.feeManager, await yallToken.FEE_MANAGER_ROLE(), true);
    config.feeClaimer && await registry.setRole(config.feeClaimer, await yallToken.FEE_CLAIMER_ROLE(), true);
    // yallToken
    config.yallMinter && await registry.setRole(config.yallMinter, await yallToken.YALL_TOKEN_MINTER_ROLE(), true);
    config.yallBurner && await registry.setRole(config.yallBurner, await yallToken.YALL_TOKEN_BURNER_ROLE(), true);
    config.yallWLManager && await registry.setRole(
        config.yallWLManager,
        await yallToken.YALL_TOKEN_WHITELIST_MANAGER_ROLE(),
        true
    );
    // yallDistributor
    config.distributorManager && await registry.setRole(
        config.distributorManager,
        await dist.DISTRIBUTOR_MANAGER_ROLE(),
        true
    );
    config.distributorVerifier && await registry.setRole(
        config.distributorVerifier,
        await dist.DISTRIBUTOR_VERIFIER_ROLE(),
        true
    );
    config.distributorEmissionClaimer && await registry.setRole(
        config.distributorEmissionClaimer,
        await dist.DISTRIBUTOR_EMISSION_CLAIMER_ROLE(),
        true
    );
    // yallExchange
    config.exchangeManager && await registry.setRole(
        config.exchangeManager,
        await exchange.EXCHANGE_MANAGER_ROLE(),
        true
    );
    config.exchangeOperator && await registry.setRole(
        config.exchangeOperator,
        await exchange.EXCHANGE_OPERATOR_ROLE(),
        true
    );
    config.exchangeSuperOperator && await registry.setRole(
        config.exchangeSuperOperator,
        await exchange.EXCHANGE_SUPER_OPERATOR_ROLE(),
        true
    );

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
        homeMediator,
        verification
    }
}


module.exports = {
    buildCoinDistAndExchange,
    deployWithProxy
};
