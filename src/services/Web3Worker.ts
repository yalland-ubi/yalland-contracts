/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import FakeWorker from "./FakeWorker";
import GaltData from "./galtData";
const Web3 = require('web3');
const EthContract = require('../libs/EthContract');
const BBPromise = require("bluebird");
const _ = require("lodash");

// const ctx: Worker = self as any;

export default class Web3Worker extends FakeWorker {
    currentRpcServer: string;
    web3InstancesCache: {[rpcServer: string]: any} = {};
    contractInstancesCache: {[rpcServer: string]:
            {[contractAddress: string]: any}
    } = {};

    txCountByOperationId: {[operationId: number]: number} = {};
    txFinishedCountByOperationId: {[operationId: number]: number} = {};
    sentTransactionsByOperationId: {[operationId: number]: any[]} = {};
    rejectedTransactionsByOperationId: {[operationId: number]: any[]} = {};
    
    watchTransactionsByOperationId: {[operationId: number]: {[txHash: string]: boolean}} = {};
    watchOperationIntervalId: {[operationId: number]: number} = {};
    
    sendQueueInProcess: boolean = false;
    
    maxTxInPromiseArray = 10;
    waitSecondsForNextTxQueueIteration = 5;
    confirmationsForResolveTx = 4;
    
    txPendingTransactions: any[] = [];
    
    transactionsQueue: any[] = [];

    callQueueInProcess: boolean = false;
    
    maxCallsInPromiseArray = 50;
    waitSecondsForNextCallQueueIteration = 1;
    
    callsPendingRequests: any[] = [];

    callsQueue: any[] = [];

    waitForTransactionConfirmations = 2;
    
    constructor() {
        super('Web3Worker');
    }
    
    setWeb3(rpcServer, reconnect = false) {
        this.currentRpcServer = rpcServer;

        let provider;
        if(rpcServer.indexOf("ws://") === -1) {
            provider = new Web3.providers.HttpProvider(rpcServer);
        } else {
            provider = new Web3.providers.WebsocketProvider(rpcServer);

            // provider.on('error', async (e) => {
            //     console.warn('websocket reconnect', e);
            //     setTimeout(() => {
            //         this.setWeb3(rpcServer, true);
            //     }, 5000);
            // });
            provider.on('end', async (e) => {
                console.warn('websocket reconnect', e);
                setTimeout(() => {
                    this.setWeb3(rpcServer, true);
                }, 5000);
            });
        }
        
        this.web3InstancesCache[rpcServer] = new Web3(provider);
        
        if(reconnect) {
            _.forEach(this.contractInstancesCache[rpcServer], (instance, contractAddress) => {
                this.setContract(rpcServer, this.web3InstancesCache[rpcServer], contractAddress, instance.abi);
            })
        }
    }
    
    setContract(rpcServer, web3Instance, contractAddress, contractAbi) {
        this.contractInstancesCache[rpcServer][contractAddress] = new EthContract();
        this.contractInstancesCache[rpcServer][contractAddress].init(null, web3Instance, contractAbi, contractAddress);
    }
    
    cacheWeb3AndContract(rpcServer, contractAddress, contractAbi) {
        if(!this.web3InstancesCache[rpcServer]) {
            this.setWeb3(rpcServer);
        }

        if(!this.contractInstancesCache[rpcServer]) {
            this.contractInstancesCache[rpcServer] = {};
        }

        if(!this.contractInstancesCache[rpcServer][contractAddress]) {
            this.setContract(rpcServer, this.web3InstancesCache[rpcServer], contractAddress, contractAbi);
        }
    }

    sendTransactionToContract(data, finishEvent) {
        this.transactionsQueue.push({
            finishEvent,
            contractName: data.contractName,
            contractAddress: data.contractAddress,
            contractMethod: data.method || data.contractMethod,
            operationId: data.operationId,
            sendOptions: data.sendOptions,
            args: data.args,
            repeatOfTx: data.repeatOfTx,
            gas: data.gas
        });
        
        if(this.txCountByOperationId[data.operationId]) {
            this.txCountByOperationId[data.operationId]++;
        } else {
            this.txFinishedCountByOperationId[data.operationId] = 0;
            this.txCountByOperationId[data.operationId] = 1;
            this.sentTransactionsByOperationId[data.operationId] = [];
            this.rejectedTransactionsByOperationId[data.operationId] = [];
        }
        
        this.cacheWeb3AndContract(data.rpcServer, data.contractAddress, data.contractAbi);

        this.currentRpcServer = data.rpcServer;
        
        this.processSendQueue();
    }
    
    async processSendQueue() {
        if(this.sendQueueInProcess || !this.transactionsQueue.length){
            return;
        }

        this.sendQueueInProcess = true;
        
        while(this.transactionsQueue.length) {
            const txObject = this.transactionsQueue[0];
            let {contractAddress, operationId, sendOptions, contractMethod, args, repeatOfTx} = txObject;

            if(txObject.gas) {
                sendOptions = _.extend({}, sendOptions, {gas: txObject.gas});
            }
            
            const contract = this.getContract(contractAddress);

            if(this.txPendingTransactions.length >= this.maxTxInPromiseArray) {
                this.txPendingTransactions = this.txPendingTransactions.filter((promise) => {
                    return !promise.isFulfilled();
                });
                await this.waitSeconds(this.waitSecondsForNextTxQueueIteration);
                continue;
            }

            try {
                const txResponse = await contract.sendMethod.apply(contract, [sendOptions, contractMethod].concat(args));

                this.txPendingTransactions.push(this.waitTransactionConfirm(txObject, txResponse.hash, txResponse.promise));
                
                this.sendEvent('txSent', {
                    contractAddress,
                    contractMethod,
                    operationId,
                    repeatOfTx,
                    hash: txResponse.hash
                });
                
                this.sentTransactionsByOperationId[operationId].push(_.extend({hash: txResponse.hash}, txObject));
                
                localStorage.setItem(txResponse.hash, JSON.stringify(_.extend({hash: txResponse.hash, operationId: operationId}, txObject)));
            } catch(error) {
                console.error('transaction failed', contractAddress, contractMethod, args, error);
                
                this.sendEvent('txFailed', {
                    contractAddress,
                    contractMethod,
                    operationId,
                    repeatOfTx,
                    error
                });

                this.txFinishedCountByOperationId[operationId]++;
                this.rejectedTransactionsByOperationId[operationId].push(_.clone(txObject));
            }
            this.transactionsQueue.splice(0, 1);
        }
        
        this.sendQueueInProcess = false;
    }

    async waitSeconds(seconds) {
        return await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 1000 * seconds)
        });
    }
    
    getContract(address){
        return this.contractInstancesCache[this.currentRpcServer][address];
    }
    
    getWeb3(){
        return this.web3InstancesCache[this.currentRpcServer];
    }
    
    waitTransactionConfirm(txObject, txHash, txPromise) {
        const {finishEvent, contractName, contractAddress, contractMethod, args, operationId, repeatOfTx} = txObject;
        
        let fullfiled = false;
        let receipt;
        
        return new BBPromise((resolve, reject) => {
            txPromise
                .on('confirmation', (confirmationNumber, _receipt) => {
                    if(fullfiled) {
                        return;
                    }
                    receipt = _receipt;
                    // console.log('confirmation', confirmationNumber, receipt);
                    if(confirmationNumber == this.confirmationsForResolveTx) {
                        resolve(receipt);
                        fullfiled = true;
                        
                        this.txFinishedCountByOperationId[operationId]++;
                        
                        this.sendEvent('txConfirmed', {
                            contractName,
                            contractAddress,
                            contractMethod,
                            args,
                            operationId,
                            repeatOfTx,
                            hash: txHash,
                            // logs: receipt.logs
                        });

                        this.sendEvent(finishEvent, txHash);
                    } else if(confirmationNumber < this.confirmationsForResolveTx) {
                        this.sendEvent('txConfirmation', {
                            contractName,
                            contractAddress,
                            contractMethod,
                            args,
                            operationId,
                            repeatOfTx,
                            confirmationNumber,
                            hash: txHash,
                            // logs: receipt.logs
                        });
                    }
                })
                .on('error', (error) => {
                    if(fullfiled) {
                        return;
                    }
                    fullfiled = true;
                    
                    console.error('transaction error', contractAddress, contractMethod, args, error, receipt);

                    this.txFinishedCountByOperationId[operationId]++;
                    this.sentTransactionsByOperationId[operationId].push(_.extend({hash: txHash}, txObject));

                    this.sendEvent('txError', {
                        contractName,
                        contractAddress,
                        contractMethod,
                        args,
                        error,
                        operationId,
                        repeatOfTx,
                        hash: txHash,
                        // logs: receipt.logs
                    });
                    
                    reject(error);
                    
                    if(!repeatOfTx) {
                        txObject.sendOptions.nonce = null;
                        this.sendTransactionToContract(_.extend({}, txObject, {repeatOfTx: txHash, gas: Math.ceil(receipt.gasUsed * 1.5)}), finishEvent);
                    }
                });
        })
    }

    getOperationState(operationId) {
        const totalTxCount = this.txCountByOperationId[operationId];
        const finishedTxCount = this.txFinishedCountByOperationId[operationId];
        const rejectedTxCount = this.rejectedTransactionsByOperationId[operationId].length;
        const sentTxCount = this.sentTransactionsByOperationId[operationId].length;
        const confirmedTxCount = finishedTxCount - rejectedTxCount;

        return {
            totalTxCount,
            finishedTxCount,
            confirmedTxCount,
            rejectedTxCount,
            sentTxCount
        }
    }
    
    callMethodFromContract(data, finishEvent) {
        console.info(new Date().toISOString(), 'callMethodFromContract', data.method);
        this.callsQueue.push({
            finishEvent,
            contractName: data.contractName,
            contractAddress: data.contractAddress,
            contractMethod: data.method,
            args: data.args
        });
        
        this.cacheWeb3AndContract(data.rpcServer, data.contractAddress, data.contractAbi);

        this.currentRpcServer = data.rpcServer;

        this.processCallQueue();
    }

    async processCallQueue() {
        if(this.callQueueInProcess || !this.callsQueue.length){
            return;
        }

        this.callQueueInProcess = true;

        let index = 0;
        while(this.callsQueue.length) {
            const {contractAddress, contractMethod, args, finishEvent} = this.callsQueue[0];

            const contract = this.getContract(contractAddress);

            if(this.callsPendingRequests.length >= this.maxCallsInPromiseArray) {
                this.callsPendingRequests = this.callsPendingRequests.filter((promise) => {
                    return !promise.isFulfilled();
                });
                await this.waitSeconds(this.waitSecondsForNextCallQueueIteration);
                continue;
            }

            try {
                console.info(new Date().toISOString(), 'callMethod', contractMethod, args);
                const callPromise = BBPromise.resolve(contract.callMethod.apply(contract, [contractMethod].concat(args)));

                callPromise
                    .then((response) => {
                        // console.log(contractMethod, response);
                        this.sendEvent(finishEvent, response);
                    })
                    .catch((err) => {
                        this.sendEvent(finishEvent, {
                            error: err
                        });
                    });

                this.callsPendingRequests.push(callPromise);
            } catch(e) {
                console.error(contract.address, contractMethod, e);
                this.sendEvent(finishEvent, {
                    error: e
                });
            }
            this.callsQueue.splice(0, 1);
            index++;
        }

        this.callQueueInProcess = false;
    }
    
    waitForOperationMined(operationId) {
        return new Promise((resolve, reject) => {
            let totalTxCount = this.txCountByOperationId[operationId];
            let finishedTxCount = this.txFinishedCountByOperationId[operationId];
            
            if(totalTxCount > 0 && totalTxCount == finishedTxCount) {
                return resolve(this.getOperationState(operationId));
            }

            const waitInterval = setInterval(() => {
                totalTxCount = this.txCountByOperationId[operationId];
                finishedTxCount = this.txFinishedCountByOperationId[operationId];
                if(totalTxCount > 0 && totalTxCount == finishedTxCount) {
                    resolve(this.getOperationState(operationId));
                    clearInterval(waitInterval);
                }
                this.processSendQueue();
            }, 1000);
        });
    }
    
    waitForTransactionResult(txHash) {
        return new Promise((resolve, reject) => {
            const web3 = this.getWeb3();
            const waitInterval = setInterval(() => {
                web3.eth.getTransactionReceipt(txHash).then(response => {
                    if(!response) {
                        return;
                    }
                    
                    if(response.status) {
                        const txBlockNumber = response.blockNumber;

                        const waitForConfirmationInterval = setInterval(async () => {
                            const currentBlock = await web3.eth.getBlockNumber();
                            if(currentBlock - txBlockNumber >= this.waitForTransactionConfirmations) {
                                resolve({
                                    hash: txHash
                                });
                                clearInterval(waitForConfirmationInterval);
                            }
                        }, 1000);
                    } else {
                        resolve({
                            hash: txHash,
                            error: true
                        });
                    }
                    clearInterval(waitInterval);
                })
            }, 5000);
        });
    }

    addTransactionWatcherToOperation(data) {
        if(!this.watchTransactionsByOperationId[data.operationId]) {
            this.watchTransactionsByOperationId[data.operationId] = {};
            this.txCountByOperationId[data.operationId] = 0;
            this.txFinishedCountByOperationId[data.operationId] = 0;
            this.rejectedTransactionsByOperationId[data.operationId] = [];
            this.sentTransactionsByOperationId[data.operationId] = [];
        }
        
        if(!_.isUndefined(this.watchTransactionsByOperationId[data.operationId][data.txHash])) {
            return true;
        }

        this.sentTransactionsByOperationId[data.operationId].push(data.txHash);
        
        this.watchTransactionsByOperationId[data.operationId][data.txHash] = true;
        this.txCountByOperationId[data.operationId]++;

        this.waitForTransactionResult(data.txHash).then((result: any) => {
            this.txFinishedCountByOperationId[data.operationId]++;
            if(result.error) {
                this.rejectedTransactionsByOperationId[data.operationId].push(data.txHash);
            }
        });
        
        return true;
    }
}
