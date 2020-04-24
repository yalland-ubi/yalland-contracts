/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const _ = require('lodash');

module.exports = class EthContract {

    initialized: boolean;
    onInit: Promise<any>;
    abi: any;
    address: string;
    contractInstance: any;
    serverContractInstance: any;
    web3: any;
    serverWeb3: any;
    web3Worker: any;
    initFinish: Function;
    errorHandler: Function;
    
    name: string;
    callMethodsRpcServer: string;
    
    webWorkerOn: boolean = true;

    constructor(web3?, serverWeb3?, json_abi?, address?) {
        this.initialized = false;

        if(web3 && json_abi && address) {
            this.init(web3, serverWeb3, json_abi, address);
        } else {
            this.onInit = new Promise(function(resolve, reject){
                this.initFinish = resolve;
            }.bind(this));
        }
    }
    
    setName(_name) {
        this.name = _name;
    }

    setCallMethodsRpcServer(callMethodsServer) {
        this.callMethodsRpcServer = callMethodsServer;
    }

    init(web3, serverWeb3, json_abi, address) {
        if(!json_abi) {
            return console.error('EthContract.json_abi is undefined');
        }
        if(!address) {
            return console.error('EthContract.address is undefined');
        }
        this.abi = typeof json_abi === 'object' ? json_abi : JSON.parse(json_abi);
        this.address = address;
        this.web3 = web3;
        if(web3) {
            this.contractInstance = new web3.eth.Contract(this.abi, address);
        }
        this.serverWeb3 = serverWeb3;
        if(serverWeb3) {
            this.serverContractInstance = new serverWeb3.eth.Contract(this.abi, address);
            if(!web3) {
                this.web3 = serverWeb3;
                this.contractInstance = this.serverContractInstance;
            }
        }

        this.initialized = true;
        if(this.initFinish)
            this.initFinish();
    }
    
    setErrorHandler(_errorHandler) {
        this.errorHandler = _errorHandler;
    }

    setWeb3Worker(_web3Worker) {
        this.web3Worker = _web3Worker;
    }

    onReady() {
        return new Promise((resolve, reject) => {
            if(this.initialized)
                resolve();
            else
                this.onInit.then(() => {
                    resolve();
                })
        });
    }

    getProperty(property_name, convert = null) {
        return this.callMethod(property_name).then((result: any) => {
            if (!convert)
                return result;

            switch (convert) {
                case 'ether':
                    return this.web3.utils.fromWei(result);
                case 'hours':
                    return result / (60 * 60);
            }
        })
    }
    
    async massCallMethod(methodName, args?) {
        await this.onReady();

        if(this.webWorkerOn) {
            return await this.web3Worker.callMethod('callMethodFromContract', {
                contractAbi: this.abi,
                contractAddress: this.address,
                contractName: this.name,
                rpcServer: this.callMethodsRpcServer,
                method: methodName,
                args: args || []
            });
        } else {
            return await this.callMethod.apply(this, [methodName].concat(args));
        }
    }

    callMethod(methodName) {
        let methodArgs = _.map(arguments, (arg) => arg).slice(1);
        methodArgs = methodArgs.filter(arg => typeof arg != 'undefined');
        const isShowMethodLog = _.includes([], methodName);//'isApprovedForAll', 'getValidator', 'tokensOfOwner', 'getPackageGeohashes', 'getPackageContour'

        if(isShowMethodLog)
            console.log('callMethod', methodName, methodArgs);

        const warnTimeout = setTimeout(() => {
            console.error('callMethod not responding', methodName, methodArgs, this.address);
            if(this.onMethodNotResponding) {
                this.onMethodNotResponding({
                    methodName,
                    methodArgs,
                    contractAddress: this.address,
                    // currentProvider: this.web3.currentProvider
                });
            }
        }, 30000);

        return new Promise(async (resolve, reject) => {
            await this.onReady();
            
            const contractInstance = this.serverContractInstance;

            const methodFunc = contractInstance.methods[methodName];
            
            if(!methodFunc) {
                console.error('Method ' + methodName + ' not found in ' + this.address + ' contract');
                return;
            }
            
            const method = methodFunc.apply(this, methodArgs);
            
            try {
                method.call((err, result) => {
                    if(isShowMethodLog)
                        console.log('callMethod', methodName, 'result', result);

                    clearTimeout(warnTimeout);

                    if(err) {
                        console.warn(this.address, methodName, methodArgs, err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                })
            } catch(e) {
                console.warn(this.address, methodName, methodArgs, e);
                reject(e);
            }
        })
    }

    onMethodNotResponding(options) {
        // Function for override in instance, for example:
        // contractInstance.onMethodNotResponding = (options) => {
        //
        // }
        // options: {
        //     methodName,
        //     methodArgs,
        //     contractAddress,
        //     currentProvider
        // }
    }
    
    async prepareSendOptions(options, method) {
        await this.onReady();

        options = _.clone(options);
        
        const gasPrice = await this.getGasPrice();

        if(options.ether) {
            options.value = this.web3.utils.toWei(options.ether.toString(), 'ether');
            delete options.ether;
        }

        const estimateGasOptions = _.clone(options);
        delete estimateGasOptions.privateKey;
        const gasAmount = await method.estimateGas(estimateGasOptions).catch((err) => {
            console.log('estimateGas failed', err)
        });

        return _.extend({
            gasPrice: gasPrice,
            gas: gasAmount
        }, options);
    }

    sendMethod(options, methodName) {
        let methodArgs = _.map(arguments, (arg) => arg).slice(2);
        
        return this.sendMethodWithArgs(options, methodName, methodArgs);
    }
    
    async sendMethodWithArgs(options, methodName, methodArgs){
        console.log('sendMethodWithArgs', options, methodName, methodArgs)
        await this.onReady();
        console.log('onReady')
        
        const methodFunc = this.contractInstance.methods[methodName];
        
        if(!methodFunc) {
            console.error('Method ' + methodName + ' not found in ' + this.address + ' contract');
            return;
        }

        methodArgs = methodArgs.filter((arg) => typeof arg !== 'undefined' && arg !== null);

        const method = methodFunc.apply(this, methodArgs);
        
        options = await this.prepareSendOptions(options, method);

        if(options.privateKey) {
            const encodedABI = method.encodeABI();
            if(!options.gas) {
                // 7453773 for add 15 geohashes
                options.gas = "8600000";
            }

            if(!options.nonce) {
                options.nonce = await this.serverWeb3.eth.getTransactionCount(options.from);
            }

            if(typeof options.nonce == "string") {
                options.nonce = this.web3.utils.hexToNumber(options.nonce);
            }

            const lastNonce = localStorage.getItem(options.from + "_nonce");

            if(lastNonce && parseInt(lastNonce) >= options.nonce) {
                options.nonce = parseInt(lastNonce) + 1;
            }

            options = _.extend(options, {
                data: encodedABI,
                to: this.address
            });
            
            localStorage.setItem(options.from + "_nonce", options.nonce);

            console.info(methodName, 'nonce', options.nonce, methodArgs, options);

            const signedTx = await this.serverWeb3.eth.accounts.signTransaction(
                options,
                options.privateKey,
                false,
            );
            return new Promise((resolve, reject) => {
                const response = this.serverWeb3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, result) => {
                    if(err){
                        reject(err);
                        console.error(methodName, new Date(), err);
                    } else {
                        resolve({
                            hash: result,
                            promise: response
                        });
                    }
                });
            });
        } else {
            console.info(methodName, 'nonce', options.nonce, methodArgs, options);

            return new Promise((resolve, reject) => {
                const response = method.send(options, (err, result) => {
                    if(err) {
                        reject(err);
                        if(this.errorHandler) {
                            this.errorHandler(err);
                        }
                        console.error(err);
                    } else {
                        if(this.web3Worker) {
                            this.web3Worker.callMethod('waitForTransactionResult', result)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            resolve({
                                hash: result,
                                promise: response
                            })
                        }
                    }
                });
                
                response
                    .on('error', (error) => {
                        if(this.errorHandler) {
                            this.errorHandler(error);
                        }
                        console.error(error);
                    })
            });
        }
    }

    getGasPrice() {
        return new Promise(async (resolve, reject) => {
            await this.onReady();

            let gasPrice = await this.web3.eth.getGasPrice();
            gasPrice = parseInt(gasPrice);

            if (gasPrice < 1000000000)
                gasPrice = 1000000000;
            
            if(gasPrice >= 100000000000)
                gasPrice = 5000000000;

            resolve(gasPrice.toString());
        });
    }
    once() {
        return this.contractInstance.once;
    }
    events() {
        return this.contractInstance.events;
    }
    getPastEvents() {
        return this.contractInstance.getPastEvents;
    }
};
