const { contract, web3, defaultSender } = require('@openzeppelin/test-environment');

const YALLToken = contract.fromArtifact('YALLToken');
const YALLRegistry = contract.fromArtifact('YALLRegistry');
const YALLDistributor = contract.fromArtifact('YALLDistributor');
const YALLExchange = contract.fromArtifact('YALLExchange');
const Proxy = contract.fromArtifact('AdminUpgradeabilityProxy');
const ProxyAdmin = contract.fromArtifact('ProxyAdmin');

YALLToken.numberFormat = 'String';
YALLExchange.numberFormat = 'String';
YALLDistributor.numberFormat = 'String';

const { ether, now, zeroAddress } = require('@galtproject/solidity-test-chest')(web3);

async function buildCoinDistAndExchange(web3, governance, config) {
    const bytes32 = web3.utils.utf8ToHex;
    const keccak256 = web3.utils.soliditySha3;

    const periodVolume = config.periodVolume || ether(250)

    // 7 days
    const periodLength = 7 * 24 * 60 * 60;
    const verifierRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    const memberId2 = keccak256('charlie');
    const memberId3 = keccak256('dan');
    const memberId4 = keccak256('eve');
    const genesisTimestamp = parseInt(await now(), 10) + startAfter;

    const registryImplementation = await YALLRegistry.new();
    const distImplementation = await YALLDistributor.new();
    const exchangeImplementation = await YALLExchange.new();
    const proxyAdmin = await ProxyAdmin.new();

    const registryProxy = await Proxy.new(
        registryImplementation.address,
        defaultSender,
        registryImplementation.contract.methods.initialize().encodeABI()
    );
    const distProxy = await Proxy.new(
        distImplementation.address,
        defaultSender,
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
        defaultSender,
        exchangeImplementation.contract.methods.initialize(
            registryProxy.address,
            // defaultExchangeRate numerator
            ether(42)
        ).encodeABI()
    );

    await registryProxy.changeAdmin(proxyAdmin.address);
    await distProxy.changeAdmin(proxyAdmin.address);
    await exchangeProxy.changeAdmin(proxyAdmin.address);

    const yall = await YALLToken.new(registryProxy.address, "Coin token", "COIN", 18);

    const registry = await YALLRegistry.at(registryProxy.address);
    const dist = await YALLDistributor.at(distProxy.address);
    const exchange = await YALLExchange.at(exchangeProxy.address);

    // Setting up contract addresses
    await registry.setContract(await registry.YALL_TOKEN_KEY(), yall.address);
    await registry.setContract(await registry.YALL_DISTRIBUTOR_KEY(), dist.address);
    await registry.setContract(await registry.YALL_EXCHANGE_KEY(), exchange.address);

    await registry.transferOwnership(governance);
    await proxyAdmin.transferOwnership(governance);

    if (!config.onlyCustomACL) {
        await registry.setRole(dist.address, await yall.YALL_TOKEN_MINTER_ROLE(), true);
        await registry.setRole(dist.address, await yall.YALL_TOKEN_BURNER_ROLE(), true);
    }
    // Setting up ACL roles
    // common
    config.pauser && await registry.setRole(config.pauser, await dist.PAUSER_ROLE(), true);
    config.feeManager && await registry.setRole(config.feeManager, await yall.FEE_MANAGER_ROLE(), true);
    config.feeClaimer && await registry.setRole(config.feeClaimer, await yall.FEE_CLAIMER_ROLE(), true);
    // yallToken
    config.yallMinter && await registry.setRole(config.yallMinter, await yall.YALL_TOKEN_MINTER_ROLE(), true);
    config.yallBurner && await registry.setRole(config.yallBurner, await yall.YALL_TOKEN_BURNER_ROLE(), true);
    config.yallWLManager && await registry.setRole(
        config.yallWLManager,
        await yall.YALL_TOKEN_WHITELIST_MANAGER_ROLE(),
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

    return [
        registry,
        yall,
        dist,
        exchange,
        genesisTimestamp
    ]
}

module.exports = {
    buildCoinDistAndExchange
};
