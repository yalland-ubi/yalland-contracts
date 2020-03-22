const { GSNProvider } = require("@openzeppelin/gsn-provider");
const { setupLoader } = require('@openzeppelin/contract-loader');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const web3 = require('web3');

function getProvider(rpc) {
  return function() {
    const provider = new web3.providers.WebsocketProvider(rpc);
    return new HDWalletProvider(process.env.DEPLOYMENT_KEY, provider);
  };
}

const provider = getProvider('wss://kovan.infura.io/ws/v3/e37391279cc043d29ca318d1bfcfcce1')();
const wrapped = new GSNProvider(provider, { debug: true });

const loader = setupLoader({
  provider: wrapped,
  defaultGas: 8000000,
  defaultGasPrice: 12 * 10 ** 9
});

module.exports = { loader: loader.truffle, from: provider.addresses[0] };
