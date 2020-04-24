const { contract, web3 } = require('@openzeppelin/test-environment');

const CoinToken = contract.fromArtifact('CoinToken');
const YALDistributor = contract.fromArtifact('YALDistributor');
const YALExchange = contract.fromArtifact('YALExchange');
const Proxy = contract.fromArtifact('OwnedUpgradeabilityProxy');

CoinToken.numberFormat = 'String';
YALExchange.numberFormat = 'String';
YALDistributor.numberFormat = 'String';

const { ether, now } = require('@galtproject/solidity-test-chest')(web3);

async function buildCoinDistAndExchange(web3, owner, verifier, periodVolume = ether(250)) {
    const keccak256 = web3.utils.soliditySha3;

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

    const yall = await CoinToken.new(owner, "Coin token", "COIN", 18);

    const distProxy = await Proxy.new();
    const exchangeProxy = await Proxy.new();

    const distImplementation = await YALDistributor.new();
    const exchangeImplementation = await YALExchange.new();

    const distInitTx = distImplementation.contract.methods.initialize(
        periodVolume,
        verifier,
        verifierRewardShare,

        yall.address,
        periodLength,
        genesisTimestamp
    ).encodeABI();

    const exchangeInitTx = exchangeImplementation.contract.methods.initialize(
        owner,
        distProxy.address,
        yall.address,
        // defaultExchangeRate numerator
        ether(42)
    ).encodeABI();

    await distProxy.upgradeToAndCall(distImplementation.address, distInitTx);
    await exchangeProxy.upgradeToAndCall(exchangeImplementation.address, exchangeInitTx);

    const dist = await YALDistributor.at(distProxy.address);
    const exchange = await YALExchange.at(exchangeProxy.address);

    return [
        yall,
        dist,
        exchange,
        genesisTimestamp
    ]
}

module.exports = {
    buildCoinDistAndExchange
};
