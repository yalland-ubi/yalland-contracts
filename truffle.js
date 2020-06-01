/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const Ganache = require('ganache-core');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const web3 = require('web3');
const { wsProviderForNetwork } = require('./galtproject-gpc');

function getProvider(rpc) {
  return function () {
    const provider = new web3.providers.WebsocketProvider(rpc);
    return new HDWalletProvider(process.env.DEPLOYMENT_KEY, provider);
  };
}

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    ganache: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
    },
    sokol: {
      // 1 gwei
      gasPrice: 1000 * 1000 * 1000,
      // 10M
      gasLimit: 9 * 1000 * 1000,
      skipDryRun: true,
      websockets: true,
      provider: wsProviderForNetwork('sokol'),
      network_id: '*',
    },
    kovan: {
      // 1 gwei
      gasPrice: 9000 * 1000 * 1000,
      // 10M
      gasLimit: 9 * 1000 * 1000,
      skipDryRun: true,
      websockets: true,
      provider: wsProviderForNetwork('kovan'),
      network_id: '*',
    },
    yalland: {
      // 1 gwei
      gasPrice: 1000 * 1000 * 1000,
      // 10M
      gasLimit: 9 * 1000 * 1000,
      skipDryRun: true,
      provider: wsProviderForNetwork('yalland'),
      network_id: '*',
    },
    // network name deprecated
    testnet57: {
      // 1 gwei
      gasPrice: 1000 * 1000 * 1000,
      // 10M
      gasLimit: 20 * 1000 * 1000,
      skipDryRun: true,
      provider: getProvider('wss://server.yalland.com:8646/'),
      network_id: '*',
    },
    test: {
      // https://github.com/trufflesuite/ganache-core#usage
      provider: Ganache.provider({
        unlocked_accounts: [0, 1, 2, 3, 4, 5],
        total_accounts: 30,
        vmErrorsOnRPCResponse: true,
        default_balance_ether: 5000000,
        // 7 800 000
        gasLimit: 0x7704c0,
      }),
      skipDryRun: true,
      network_id: '*',
    },
  },
  compilers: {
    solc: {
      version: process.env.SOLC || 'native',
      settings: {
        optimizer: {
          enabled: true,
          runs: 20000,
        },
      },
      evmVersion: 'istanbul',
    },
  },
};
