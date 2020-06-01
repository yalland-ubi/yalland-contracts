const assert = require('assert');
const { getLoader } = require('../galtproject-gpc');

const { loader } = getLoader({
  gsnSupport: false,
  loaderOptions: {
    // 1 gwei
    defaultGasPrice: 10 ** 9,
  },
});

// eslint-disable-next-line import/no-dynamic-require
const config = require(`../deployed/${process.env.NETWORK}.json`);

const YALLTokenEthereum = loader.truffle.fromArtifact('YALLTokenEthereum');
const ForeignMediator = loader.truffle.fromABI(config.foreignBridgeMediatorAbi);

YALLTokenEthereum.numberFormat = 'String';
ForeignMediator.numberFormat = 'String';

const { web3 } = YALLTokenEthereum;
// eslint-disable-next-line import/order
const { ether } = require('@galtproject/solidity-test-chest')(web3);

// eslint-disable-next-line no-unused-vars
const keccak256 = web3.utils.soliditySha3;

// inputs >>>
const superuser = 'fffff2b5e1b308331b8548960347f9d874824f40';
const me = '3333331e386a009d9538e759a92ddb37f8da4852';
// eslint-disable-next-line no-unused-vars
const he = '0x2222ebc798ebe6517adf90483d1ca69b5276978b';

async function ambMediatorCheck(token, mediator) {
  assert.equal(
    await mediator.erc677token(),
    token.address,
    "Mediator ERC20 token and current token address doesn't match"
  );
  assert.equal(
    await mediator.mediatorContractOnOtherSide(),
    config.homeBridgeMediatorAddress,
    "Mediator contractOnOtherSide and homeBridgeMediatorAddress from config doesn't match"
  );
  assert.equal(await token.minter(), mediator.address, 'Mediator has no minter permissions at YALLToken');

  console.log('>>> mediator address', config.foreignBridgeMediatorAddress);
  console.log('>>> token minterAndBurner', await token.minter());
  console.log('>>> mediator check', await mediator.MEDIATOR_CHAIN());
  console.log('>>> mediator current balance ', await token.balanceOf(config.foreignBridgeMediatorAddress));
}

// eslint-disable-next-line no-unused-vars
async function ambTransferForeignToHome(token, mediator) {
  const amount = ether(1.5);

  await ambMediatorCheck(token, mediator);

  console.log('>>> my current balance', await token.balanceOf(me));
  console.log('>>> Approving...');
  await token.approve(config.foreignBridgeMediatorAddress, amount, { from: me });
  console.log('>>> Relaying...');
  const res = await mediator.relayTokens(me, amount, { from: me });
  console.log('>>> Sent in tx', res.tx);
}

// eslint-disable-next-line no-unused-vars
async function setErc677token(mediator) {
  console.log('>>> current 677 token ', await mediator.erc677token());
  await mediator.setErc677token(config.yallTokenEthereumAddress, { from: superuser });
  console.log('>>> new 677 token ', await mediator.erc677token());
}

// eslint-disable-next-line no-unused-vars
async function setMinter(token) {
  console.log('>>> current minter ', await token.minter());
  await token.setMinter(config.foreignBridgeMediatorAddress, { from: superuser });
  // await token.setMinter(superuser, { from: superuser });
  console.log('>>> new minter ', await token.minter());
}

// eslint-disable-next-line no-unused-vars
async function ambFixFailedTransfer(token, mediator) {
  // home chain failed transfer txHash
  // WARNING: ensure that the home mediator has enough YALLs to operate
  await mediator.requestFailedMessageFix('0x3456fc8d4292f7cd388f11d9b14886528a2af74d152ea030d82b646802475d90', {
    from: me,
  });
  // console.log('>>> YALTokenEthereum address ', await token.address);
  // console.log('>>> YALTokenEthereum totalSupply ', await token.totalSupply());
}

// eslint-disable-next-line no-unused-vars
async function setMediatorOnOtherSide(mediator) {
  console.log('>>> current mediator on other side ', await mediator.mediatorContractOnOtherSide());
  await mediator.setMediatorContractOnOtherSide(config.homeBridgeMediatorAddress, { from: superuser });
  console.log('>>> new mediator on other side ', await mediator.mediatorContractOnOtherSide());
}

// eslint-disable-next-line no-unused-vars
async function totalSupply(token) {
  console.log('>>> YALTokenEthereum address ', await token.address);
  console.log('>>> YALTokenEthereum totalSupply ', await token.totalSupply());
}

// eslint-disable-next-line no-unused-vars
async function balanceOf(token) {
  console.log('>>> YALTokenEthereum address ', await token.address);
  console.log('>>> YALTokenEthereum balanceOf ', await token.balanceOf(me));
}

async function main() {
  console.log('web3::eth::id::', await web3.eth.net.getId());

  // eslint-disable-next-line no-unused-vars
  const token = await YALLTokenEthereum.at(config.yallTokenEthereumAddress);
  // eslint-disable-next-line no-unused-vars
  const mediator = await ForeignMediator.at(config.foreignBridgeMediatorAddress);
  console.log('>>> Starting...');

  // NOTICE: Please, keep all the following method call lines commented out before making a commit

  // await ambMediatorCheck(token, mediator);
  // await ambFixFailedTransfer(token, mediator);
  // await setMinter(token);
  // await ambTransferForeignToHome(token, mediator);
  // await setErc677token(mediator);
  // await totalSupply(token);
  // await balanceOf(token);
  // await setMediatorOnOtherSide(mediator);
}

(async function () {
  try {
    await main();
  } catch (e) {
    console.log('>>> Error\n', e);
  }
  console.log('Done!');
  process.exit(1);
})();
