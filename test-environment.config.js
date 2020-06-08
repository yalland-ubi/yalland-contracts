// const coverage = process.env.TEST_ENV_COVERAGE !== undefined;

module.exports = {
  accounts: {
    amount: 25, // Number of unlocked accounts
    ether: 5000000, // Initial balance of unlocked accounts (in ether)
  },

  contracts: {
    type: 'truffle', // Contract abstraction to use: 'truffle' for @truffle/contract or 'web3' for web3-eth-contract
    defaultGas: 8500000, // Maximum gas for contract calls (when unspecified)

    // Options available since v0.1.2
    defaultGasPrice: 20e9, // Gas price for contract calls (when unspecified)
    artifactsDir: 'build/contracts', // Directory where contract artifacts are stored
  },

  node: {
    // Options passed directly to Ganache client
    gasLimit: 96000000, // Maximum gas per block
    gasPrice: 1, // Sets the default gas price for transactions if not otherwise specified.
  },
  setupProvider: (baseProvider) => {
    // eslint-disable-next-line global-require
    const { GSNDevProvider } = require('@openzeppelin/gsn-provider');
    // eslint-disable-next-line global-require
    const { accounts } = require('@openzeppelin/test-environment');
    // eslint-disable-next-line global-require
    const Web3 = require('web3');
    // eslint-disable-next-line global-require
    const { approveFunction } = require('./test/helpers')(new Web3(baseProvider));

    return new GSNDevProvider(baseProvider, {
      fixedGasPrice: 1,
      txfee: 70,
      useGSN: false,
      debug: false,
      approveFunction,
      ownerAddress: accounts[8],
      relayerAddress: accounts[9],
    });
  },
};
