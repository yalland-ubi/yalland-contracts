/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import CoinTokenContract from "../contracts/CoinTokenContract";
import CityContract from "../contracts/CityContract";
import GaltData from "./galtData";

const _ = require('lodash');

export default {
    install (Vue, options: any = {}) {
        const contracts = {
            'coinToken': CoinTokenContract,
            'city': CityContract
        };

        Vue.prototype.$contracts = {};
        
        _.forEach(contracts, (ContractClass, contractName) => {
            Vue.prototype['$' + contractName + 'Contract'] = new ContractClass();
            
            Vue.prototype.$contracts['$' + contractName] = Vue.prototype['$' + contractName + 'Contract'];
        });

        Vue.prototype.$contractsFactory = {
            init(vueInstance, contractsConfig) {
                this.$notify = vueInstance.$notify;
                this.$locale = vueInstance.$locale;
                
                _.forEach(contracts, (ContractClass, contractName) => {
                    const contractInstance = Vue.prototype['$' + contractName + 'Contract'];
                    
                    const contractAbi = contractsConfig[contractName + 'Abi'];
                    const contractAddress = contractsConfig[contractName + 'Address'];

                    contractInstance.setCallMethodsRpcServer(GaltData.callMethodsRpcServer());
                    
                    contractInstance.init(vueInstance.$root.$web3, vueInstance.$root.$serverWeb3, contractAbi, contractAddress);

                    contractInstance.onMethodNotResponding = this.serverNotRespondingMessage(contractName);

                    contractInstance.setErrorHandler(vueInstance.$sentry.exception);

                    contractInstance.setWeb3Worker(vueInstance.$web3Worker);
                });
            },
            serverNotRespondingMessage(contractName) {
                return (options) => {
                    this.$notify({
                        type: 'error',
                        title: this.$locale.get('server_not_responding.title'),
                        text: this.$locale.get('server_not_responding.title', {contract_name: contractName, contract_address: options.contractAddress, method_name: options.methodName})
                    });
                }
            },
        };
    }
}
