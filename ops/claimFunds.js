const { loader, globalConfig, from } = require('./init');

const YALDistributor = loader.fromArtifact('YALDistributor');
const CoinToken = loader.fromArtifact('CoinToken');

YALDistributor.numberFormat = 'String';
CoinToken.numberFormat = 'String';

const { web3 } = YALDistributor;
const { utf8ToHex } = web3.utils;
// eslint-disable-next-line import/order
const { getEventArg } = require('@galtproject/solidity-test-chest')(web3);
const keccak256 = web3.utils.soliditySha3;
const { approveFunction } = require('../test/helpers')(web3);

// inputs >>>
const me = '2222ebc798ebe6517adf90483d1ca69b5276978b';
const coinTokenAddress = '0xc1533aaa64FfCF93CC6c857D0DF715808b10bbDA';
const yalDistributorAddress = '0x5005244428Bab9e77e1435EcB68EEb3E86cb4cF9';

async function main() {
    console.log('claim::id::', await web3.eth.net.getId());
    console.log('claim::accounts::', await web3.eth.getAccounts());

    const dist = await YALDistributor.at(yalDistributorAddress);
    const token = await CoinToken.at(coinTokenAddress);
    console.log('>>> Starting...');

    const memberId = keccak256('user2');
    console.log('>>> currentPeriodId ', await dist.getCurrentPeriodId());
    console.log('>>> me active ', await dist.member(memberId));
    await dist.claimFunds({ from: me, useGSN: true, approveFunction });
    console.log('>>> my balance is ', await token.balanceOf(me));
    console.log('>>>', await dist.getActiveAddressList());
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
