module.exports = {
    version: process.env.VERSION,
    rpcServer: process.env.RPC_SERVER,
    rpcServerId: process.env.RPC_SERVER_ID,
    altRpcServers: process.env.ALT_RPC_SERVERS,
    contractsConfigUrl: process.env.CONTRACTS_CONFIG_URL,
    defaultLang: process.env.DEFAULT_LANG || 'en',
    enableWebSocket: false
};
