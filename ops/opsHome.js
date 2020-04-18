const { getLoader } = require('../galtproject-truffle-config');
const {
    fundRecipient,
    registerRelay,
    deployRelayHub
} = require('@openzeppelin/gsn-helpers');
const assert = require('assert');

const { loader, defaultSender } = getLoader();

const config = require(`../deployed/${process.env.NETWORK}.json`)

const YALDistributor = loader.truffle.fromArtifact('YALDistributor');
const CoinToken = loader.truffle.fromArtifact('CoinToken');
const HomeMediator = loader.truffle.fromABI(config.homeBridgeMediatorAbi)

HomeMediator.numberFormat = 'String';
YALDistributor.numberFormat = 'String';
CoinToken.numberFormat = 'String';

const { web3 } = YALDistributor;
// eslint-disable-next-line import/order
const { getEventArg, ether } = require('@galtproject/solidity-test-chest')(web3);
const keccak256 = web3.utils.soliditySha3;
const { approveFunction } = require('../test/helpers')(web3);

// inputs >>>
const superuser = 'fffff2b5e1b308331b8548960347f9d874824f40';
const me = '3333331e386a009d9538e759a92ddb37f8da4852';
const myMemberId = keccak256('user3');
const he = '0x2222ebc798ebe6517adf90483d1ca69b5276978b';

async function ambTransferHomeToForeign(token, mediator) {
    const amount = ether(1.5);

    assert.equal(
        await mediator.erc677token(),
        token.address,
        "Mediator ERC20 token and current token address doesn't match"
    );
    assert.equal(
        await mediator.mediatorContractOnOtherSide(),
        config.foreignBridgeMediatorAddress,
        "Mediator contractOnOtherSide and foreignBridgeMediatorAddress from config doesn't match"
    );
    assert(await token.opsWhitelist(config.homeBridgeMediatorAddress), "Mediator not in a WL list of YALLToken");

    console.log('>>> my current balance', await token.balanceOf(me));
    console.log('>>> mediator check', await mediator.MEDIATOR_CHAIN());
    console.log('>>> mediator address ', config.homeBridgeMediatorAddress);
    console.log('>>> mediator erc677token ', await mediator.erc677token());
    console.log('>>> mediator current balance ', await token.balanceOf(config.homeBridgeMediatorAddress));
    console.log('>>> mediator on other side ', await mediator.mediatorContractOnOtherSide());
    console.log('>>> mediator in WL', await token.opsWhitelist(config.homeBridgeMediatorAddress));

    console.log('>>> Approving...');
    await token.approve(config.homeBridgeMediatorAddress, amount, { from: me });
    console.log('>>> Relaying...');
    const res = await mediator.relayTokens(me, amount, { from: me });
    console.log('>>> Sent in tx', res.tx);
}

async function checkWhitelistedAddresses(token) {
    console.log('WL Check:', await token.opsWhitelist('0x16D21B9521ED8C24ADa06BEcF31Fa2414b70072D'));
    console.log('WL Check:', await token.opsWhitelist('0x2cb423ba940ede9ec5f59faec9d5605d04876441'));
}

async function claimFunds(dist) {
    console.log('>>> currentPeriodId ', await dist.getCurrentPeriodId());
    console.log('>>> me active ', await dist.member(myMemberId));

    await dist.claimFunds({ from: me });
}

async function setMediatorOnOtherSide(mediator) {
    console.log('>>> current mediator on other side ', await mediator.mediatorContractOnOtherSide());
    await mediator.setMediatorContractOnOtherSide(config.foreignBridgeMediatorAddress, { from: superuser });
    console.log('>>> new mediator on other side ', await mediator.mediatorContractOnOtherSide());
}

async function addWhitelistedAddress(token) {
    const addressToAdd = config.homeBridgeMediatorAddress;
    await token.setWhitelistAddress(addressToAdd, true, { from: superuser });
}

async function totalSupply(token) {
    console.log('>>> YALToken address ', await token.address);
    console.log('>>> YALToken totalSupply ', await token.totalSupply());
}

async function balanceOf(token) {
    console.log('>>> YALToken address ', await token.address);
    console.log('>>> YALToken balanceOf ', await token.balanceOf(me));
}


async function main() {
    console.log('web3::eth::id::', await web3.eth.net.getId());

    const token = await CoinToken.at(config.coinTokenAddress);
    const dist = await YALDistributor.at(config.yalDistributorAddress);
    const mediator = await HomeMediator.at(config.homeBridgeMediatorAddress);
    console.log('>>> Starting...');

    // NOTICE: Please, keep all the following method call lines commented out before making a commit

    // await ambTransferHomeToForeign(token, mediator);
    // await claimFunds(dist);
    // await addWhitelistedAddress(token);
    // await checkWhitelistedAddresses(token);
    // await setMediatorOnOtherSide(mediator);
    // await totalSupply(token);
    // await balanceOf(token);
}

(async function() {
    try {
        await main();
    } catch (e) {
        console.log('>>> Error\n', e);
    }
    console.log('Done!');
    process.exit(1);
})();
