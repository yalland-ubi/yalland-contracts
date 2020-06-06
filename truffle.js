const { wsProviderForNetwork } = require('./galtproject-gpc');

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    soliditycoverage: {
      host: '127.0.0.1',
      port: 8555,
      gasLimit: 9600000,
      network_id: '*',
    },
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
    test: {
      // https://github.com/trufflesuite/ganache-core#usage
      provider() {
        const { provider } = require('@openzeppelin/test-environment');
        return provider;
      },
      skipDryRun: true,
      network_id: '*',
    },
  },
  mocha: {
    timeout: 10000,
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
  plugins: ['solidity-coverage'],
};
