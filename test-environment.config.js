module.exports = {
    accounts: {
        amount: 10, // Number of unlocked accounts
        ether: 5000000 // Initial balance of unlocked accounts (in ether)
    },

    contracts: {
        type: 'truffle', // Contract abstraction to use: 'truffle' for @truffle/contract or 'web3' for web3-eth-contract
        defaultGas: 9100000, // Maximum gas for contract calls (when unspecified)

        // Options available since v0.1.2
        defaultGasPrice: 20e9, // Gas price for contract calls (when unspecified)
        artifactsDir: 'build/contracts' // Directory where contract artifacts are stored
    },
    setupProvider: (baseProvider) => {
        const { GSNDevProvider } = require('@openzeppelin/gsn-provider');
        const { accounts } = require('@openzeppelin/test-environment');

        return new GSNDevProvider(baseProvider, {
            txfee: 70,
            useGSN: false,
            debug: false,
            ownerAddress: accounts[8],
            relayerAddress: accounts[9],
        });
    },

    blockGasLimit: 9900000 // Maximum gas per block
};