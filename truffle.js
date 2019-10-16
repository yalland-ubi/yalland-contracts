/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

/*
 * NB: since truffle-hdwallet-provider 0.0.5 you must wrap HDWallet providers in a 
 * function when declaring them. Failure to do so will cause commands to hang. ex:
 * ```
 * mainnet: {
 *     provider: function() { 
 *       return new HDWalletProvider(mnemonic, 'https://mainnet.infura.io/<infura-key>') 
 *     },
 *     network_id: '1',
 *     gas: 4500000,
 *     gasPrice: 10000000000,
 *   },
 */
const Ganache = require('ganache-core');
module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!
    networks: {
        local: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*" // Match any network id
        },
        testnet57: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*" // Match any network id
        },
        test: {
            // https://github.com/trufflesuite/ganache-core#usage
            provider: Ganache.provider({
                unlocked_accounts: [0, 1, 2, 3, 4, 5],
                total_accounts: 30,
                vmErrorsOnRPCResponse: true,
                default_balance_ether: 5000000,
                // 7 800 000
                gasLimit: 0x7704c0
            }),
            skipDryRun: true,
            network_id: '*'
        }
    }
};
