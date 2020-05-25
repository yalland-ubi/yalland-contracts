const { getLoader } = require('../galtproject-gpc');
const {
    relayHub
} = require('@openzeppelin/gsn-helpers');
const assert = require('assert');

const { loader, provider, defaultSender } = getLoader({
    gsnSupport: true,
    loaderOptions: {
        // 12 gwei
        defaultGasPrice: 12 * 10 ** 9
    },
    gsnOptions: {
        preferredRelayer: {
            RelayServerAddress: '0xae9fd8783cf13a722d1b2aff9b749f73cb61999e',
            relayUrl: 'https://gsn-relayer.sokol.galtproject.io/',
        }
    }
});

const config = require(`../deployed/${process.env.NETWORK}.json`)

const YALLRegistry = loader.truffle.fromArtifact('YALLRegistry');
const YALLDistributor = loader.truffle.fromArtifact('YALLDistributor');
const YALLExchange = loader.truffle.fromArtifact('YALLExchange');
const YALLToken = loader.truffle.fromArtifact('YALLToken');
const HomeMediator = loader.truffle.fromABI(config.homeBridgeMediatorAbi)
const RelayHub = loader.truffle.fromABI(relayHub.abi);

HomeMediator.numberFormat = 'String';
YALLDistributor.numberFormat = 'String';
YALLToken.numberFormat = 'String';
YALLExchange.numberFormat = 'String';

const { web3 } = YALLDistributor;
// eslint-disable-next-line import/order
const { getEventArg, ether } = require('@galtproject/solidity-test-chest')(web3);
const keccak256 = web3.utils.soliditySha3;
const { approveFunction } = require('../test/helpers')(web3);

// inputs >>>
const superuser = '0xfffff2b5e1b308331b8548960347f9d874824f40';
const ops = 'aaaaa67b971f1181f5af957ea4a0fc53cc034f63';
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

async function claimFundsGSN(dist) {
    console.log('>>> dist getHubAddr ', await dist.getHubAddr());
    console.log('>>> currentPeriodId ', await dist.getCurrentPeriodId());
    console.log('>>> me active ', await dist.member(myMemberId));

    await dist.claimFunds({ from: me, useGSN: true, approveFunction });
}

// WARNING: doesnt' work, will be fixed later
async function fundGSNContracts(dist, token, exchange) {
    const relayHub = await RelayHub.at('0xd216153c06e857cd7f72665e0af1d7d82172f494');

    await relayHub.depositFor(dist.address, { value: ether(0.5), from: defaultSender });
    await relayHub.depositFor(token.address, { value: ether(0.5), from: defaultSender });
    await relayHub.depositFor(exchange.address, { value: ether(0.5), from: defaultSender });
}

async function setMediatorOnOtherSide(mediator) {
    console.log('>>> current mediator on other side ', await mediator.mediatorContractOnOtherSide());
    await mediator.setMediatorContractOnOtherSide(config.foreignBridgeMediatorAddress, { from: superuser });
    console.log('>>> new mediator on other side ', await mediator.mediatorContractOnOtherSide());
}

async function addWhitelistedAddress(registry, token, dist) {
    assert(
      await registry.hasRole(superuser, await token.FEE_MANAGER_ROLE()),
      "Sender has no WL manager role"
    );
    const addressToAdd = config.homeBridgeMediatorAddress;
    await token.setCanTransferWhitelistAddress(addressToAdd, true, { from: superuser });
}

async function totalSupply(token) {
    console.log('>>> YALLToken address ', await token.address);
    console.log('>>> YALLToken totalSupply ', await token.totalSupply());
}

async function balanceOf(token, mediator) {
    console.log('>>> YALLToken address ', await token.address);
    console.log('>>> YALLToken balanceOf mediator', await token.balanceOf(mediator.address));
    console.log('>>> YALLToken balanceOf me', await token.balanceOf(me));
}

async function transferMeHe(token) {
    console.log('>>> gsnFee', await token.gsnFee());
    console.log('>>> mine balance', await token.balanceOf(me));
    console.log('>>> yall token balance', await token.balanceOf(token.address));
    console.log('>>> me can pay for GSN tx', await token.canPayForGsnCall(me));

    await token.transfer(he, ether(1), { from: me, useGSN: true, approveFunction });
}

async function estimateExchange(dist, token, exchange) {
    console.log('>>> YALLExchange address ', await exchange.address);

    const addr = '0x11965fa061d53b7b9d49e06155f35964682df52b';
    const amount = ether(0.9);

    const memberId = await dist.memberAddress2Id(addr);
    const currentPeriod = await dist.getCurrentPeriodId();
    console.log('>>> Member ID:', memberId);
    console.log('>>> Current Period ID:', currentPeriod);
    console.log('>>> YALDist member count:', await dist.activeMemberCount());
    // console.log('>>> Member Details:', await dist.getMemberByAddress(addr));

    console.log('>>> Approving... ');
    await token.approve(exchange.address, amount, { from: addr })

    console.log('>>> Limit 1:', await exchange.checkExchangeFitsLimit1(memberId, amount));
    console.log('>>> Limit 2:', await exchange.checkExchangeFitsLimit2(memberId, amount, currentPeriod));
    console.log('>>> Limit 3:', await exchange.checkExchangeFitsLimit3(amount, currentPeriod));

    console.log('>>> Estimating... ');
    console.log(
        '>>> YALLExchange estimation ',
        await exchange.contract.methods
            .createOrder(amount)
            .estimateGas({ from: addr })
    );
}

async function main() {
    console.log('web3::eth::id::', await web3.eth.net.getId());

    // WARNING: don't forget include approveFunction as an option for GSN calls like `{ from: me, approveFunction}`

    const token = await YALLToken.at(config.yallTokenAddress);
    const dist = await YALLDistributor.at(config.yallDistributorAddress);
    const exchange = await YALLExchange.at(config.yallExchangeAddress);
    // const mediator = await HomeMediator.at(config.homeBridgeMediatorAddress);
    const registry = await YALLRegistry.at(config.yallRegistryAddress)
    console.log('>>> Starting...');

    // NOTICE: Please, keep all the following method call lines commented out before making a commit

    // await ambTransferHomeToForeign(token, mediator);
    // await fundGSNContracts(dist, token, exchange);
    // await claimFunds(dist);
    // await claimFundsGSN(dist);
    // await addWhitelistedAddress(registry, token, dist);
    // await checkWhitelistedAddresses(token);
    // await setMediatorOnOtherSide(mediator);
    // await totalSupply(token);
    // await balanceOf(token, mediator);
    // await transferMeHe(token);
    // await estimateExchange(dist, token, exchange);
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
