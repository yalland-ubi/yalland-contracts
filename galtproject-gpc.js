const homedir = require('os').homedir
const path = require('path')
const fs = require('fs')
const YAML = require('yamljs')
const assert = require('assert')
const web3 = require('web3')
const _ = require('lodash')

const HDWalletProvider = require('@truffle/hdwallet-provider')
const wsProviders = {};
const httpProviders = {};

const DEFAULT_MNEMONIC =
    'explain tackle mirror kit van hammer degree position ginger unfair soup bonus'

const defaultHTTPRPC = network => `https://http-rpc.${network}.galtproject.io`
const defaultWSRPC = network => `wss://wss-rpc.${network}.galtproject.io`

const configFilePath = path.join(homedir(), `.gpc/keys.yaml`)

const mnemonic = () => {
    try {
        return require(configFilePath).mnemonic
    } catch (e) {
        return DEFAULT_MNEMONIC
    }
}

const settingsForNetwork = network => {
    if (!fs.existsSync(configFilePath)) {
        throw new Error(`GPC: Please, create a config file at "${configFilePath}"` );
    }
    const config = YAML.load(configFilePath)
    return config[network]
}

// Lazily loaded provider
const httpProviderForNetwork = network => () => {
    let { rpc, key } = settingsForNetwork(network)
    rpc = rpc.http || defaultHTTPRPC(network)

    assert(key.length > 0, `GPC: No private key for ${network} specified in ~/.gpc/keys.yaml`);

    // TODO: improve
    return new HDWalletProvider([key], rpc)
}

const wsProviderForNetwork = network => () => {
    network = network || process.env.NETWORK || 'local';
    if (!wsProviders[network]) {
        let { rpc, key, keys } = settingsForNetwork(network)
        rpc = rpc.ws || defaultWSRPC(network)

        if (!keys || keys.length === 0) {
            assert(key.length > 0, `GPC: No private key for ${network} specified in ~/.gpc/keys.yaml`);
            keys = [key];
        }

        const provider = new web3.providers.WebsocketProvider(rpc);

        const hdProvider = new HDWalletProvider(keys, provider)

        console.log(`GPC: A new WS provider created for "${network}" network`);
        console.log('GPC: RPC endpoint:', rpc);
        console.log('GPC: Unlocked accounts:', hdProvider.getAddresses());
        console.log('');

        wsProviders[network] = hdProvider;
    }

    return wsProviders[network];
}

function getLoader(network, provider, options) {
    const { setupLoader } = require('@openzeppelin/contract-loader');
    provider = provider || wsProviderForNetwork(network)();

    return {
        loader: setupLoader(_.extend({
            provider ,
            useGSN: false,
            defaultGas: 8000000,
            defaultGasPrice: 10 ** 9
        }, options)),
        defaultSender: provider.addresses[0]
    };
}

module.exports = {
    getLoader,
    wsProviderForNetwork,
    httpProviderForNetwork
}
