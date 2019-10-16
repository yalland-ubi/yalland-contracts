/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

module.exports = {
    version: process.env.VERSION,
    rpcServer: process.env.RPC_SERVER,
    rpcServerId: process.env.RPC_SERVER_ID,
    altRpcServers: process.env.ALT_RPC_SERVERS,
    contractsConfigUrl: process.env.CONTRACTS_CONFIG_URL,
    defaultLang: process.env.DEFAULT_LANG || 'en',
    enableWebSocket: false
};
