/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import {IDCityChainService, IDCityChainTransferEvent} from "./IChainService";

const _ = require('lodash');

const Web3 = require("web3");
const Web3Utils = require("web3-utils");
const pIteration = require("p-iteration");
const sigUtil = require('eth-sig-util');

const axios = require('axios');

let config = require('./config');

module.exports = async (extendConfig) => {
    config = _.merge({}, config, extendConfig || {});

    if (!config.rpcServer) {
        console.error('rpcServer required in config.js');
        process.exit(1);
    }

    return new DCityChainWeb3Service();
};

class DCityChainWeb3Service implements IDCityChainService {
    websocketProvider: any;
    httpProvider: any;
    web3: any;

    tokenContract: any;
    cityContract: any;

    callbackOnReconnect: any;

    constructor() {
        if (_.startsWith(config.rpcServer, 'ws')) {
            this.websocketProvider = new Web3.providers.WebsocketProvider(config.rpcServer);
            this.web3 = new Web3(this.websocketProvider);
        } else {
            this.httpProvider = new Web3.providers.HttpProvider(config.rpcServer);
            this.web3 = new Web3(this.httpProvider);
        }

        this.createContractInstance();
        this.subscribeForReconnect();
    }

    getDefaultTokenAddress() {
        return config.tokenContractAddress;
    }

    getCityAddress() {
        return config.cityContractAddress;
    }

    async getCurrentBlock() {
        return this.web3.eth.getBlockNumber();
    }

    async getBlockTimeStamp(blockNumber) {
        return (await this.web3.eth.getBlock(blockNumber)).timestamp;
    }

    async getBlockTransactionCount(blockNumber) {
        return this.web3.eth.getBlockTransactionCount(blockNumber)
    }

    async getGasPrice() {
        let gasPrice = parseInt((await this.web3.eth.getGasPrice()).toString(10));
        if (gasPrice > 10000000000) {
            gasPrice = 5000000000;
        }
        return gasPrice;
    }

    onReconnect(callback) {
        this.callbackOnReconnect = callback;
    }

    async sendEther(fromAddress, fromPrivateKey, to, amount, nonce = null) {
        const gasPrice = await this.getGasPrice();
        let options = {
            from: fromAddress,
            to: to,
            value: this.etherToWei(amount),
            gasPrice: gasPrice,
            nonce: nonce,
            gas: 21000
        };

        if (!options.nonce) {
            options.nonce = await this.web3.eth.getTransactionCount(options.from);
        }

        if (typeof options.nonce === "string") {
            options.nonce = this.web3.utils.hexToNumber(options.nonce);
        }

        const signedTx = await this.web3.eth.accounts.signTransaction(
            options,
            fromPrivateKey,
            false,
        );

        return new Promise((resolve, reject) => {
            const response = this.web3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, hash) => {
                if (err) {
                    if (_.includes(err.message, "Transaction gas price is too low")) {
                        return resolve(this.sendEther(fromAddress, fromPrivateKey, to, amount, options.nonce + 1));
                    } else {
                        return reject(err);
                    }
                }

                resolve({
                    hash: hash,
                    promise: response,
                    nonce: options.nonce,
                    gasPrice: gasPrice
                });
            })
        })
    }

    async isRateManager(address): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.hasRole(address, Web3Utils.utf8ToHex("rate_manager"))
                .call((err, result) => err ? reject(err) : resolve(result));
        });
    }

    async isJoinManager(address): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.hasRole(address, Web3Utils.utf8ToHex("member_join_manager"))
                .call((err, result) => err ? reject(err) : resolve(result));
        });
    }

    async isLeaveManager(address): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.hasRole(address, Web3Utils.utf8ToHex("member_leave_manager"))
                .call((err, result) => err ? reject(err) : resolve(result));
        });
    }

    async isCityOwner(address): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.owner()
                .call((err, result) => err ? reject(err) : resolve(result.toLowerCase() === address.toLowerCase()));
        });
    }

    async isContractManager(address): Promise<any> {
        return await this.isRateManager(address) || await this.isJoinManager(address) || await this.isLeaveManager(address) || await this.isCityOwner(address);
    }

    getAccountAddressBySignature(signature, message, fieldName) {
        const messageParams = [ { type: 'string', name: fieldName, value: message} ];
        return sigUtil.recoverTypedSignatureLegacy({ data: messageParams, sig: signature })
    }

    isSignatureValid(address, signature, message, fieldName) {
        const signedByAddress = this.getAccountAddressBySignature(signature, message, fieldName);
        return signedByAddress.toLowerCase() === address.toLowerCase();
    }

    getTotalSupply() {
        return new Promise((resolve, reject) => {
            this.tokenContract.methods.totalSupply()
                .call((err, supply) => err ? reject(err) : resolve(this.weiToEther(supply)));
        });
    }

    getTokenOwner(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.tokenContract.methods.owner()
                .call((err, address) => err ? reject(err) : resolve(address));
        });
    }

    getTokensBalance(address, tokenAddress?) {
        if (!tokenAddress) {
            tokenAddress = config.tokenContractAddress;
        }
        let contract = this.tokenContract;
        if (!contract) {
            contract = new this.web3.eth.Contract(config.tokenContractAbi, tokenAddress);
        }
        return new Promise((resolve, reject) => {
            contract.methods.balanceOf(address)
                .call((err, tokens) => err ? reject(err) : resolve(this.weiToEther(tokens)));
        });
    }

    getExplorerTokensBalance(address, tokenAddress?) {
        if (!tokenAddress) {
            tokenAddress = config.tokenContractAddress;
        }
        const explorerUrl = _.template(config.explorerTokenBalanceTpl)({
            contractAddress: tokenAddress,
            accountAddress: address
        });

        return axios.get(explorerUrl).then((response) => this.weiToEther(response.data.result));
    }

    async getEthBalance(address) {
        return this.weiToEther(await this.web3.eth.getBalance(address));
    }

    weiToEther(wei): number {
        return parseFloat(Web3.utils.fromWei(wei.toString(10), 'ether'))
    }

    etherToWei(ether): number {
        return Web3.utils.toWei(ether.toString(10), 'ether');
    }

    sendTokens(fromAddress, fromPrivateKey, to, amount) {
        return this.sendMethod(
            this.tokenContract.methods.transfer(to, this.etherToWei(amount)),
            config.tokenContractAddress,
            fromAddress,
            fromPrivateKey
        );
    }

    getSendTokenstTx(fromAddress, fromPrivateKey, to, amount, nonce) {
        return this.getTransaction(
            this.tokenContract.methods.transfer(to, this.etherToWei(amount)),
            config.cityContractAddress,
            fromAddress,
            fromPrivateKey,
            nonce
        );
    }


    async sendTokensList(fromAddress, fromPrivateKey, sendList) {
        let nonce = await this.web3.eth.getTransactionCount(fromAddress, 'pending');
        if (typeof nonce === "string") {
            nonce = parseInt(this.web3.utils.hexToNumber(nonce));
        }

        const batch = new this.web3.BatchRequest();

        const addToBatch = async (txPromise) => {
            const signedTx = await txPromise;
            return batch.add(this.web3.eth.sendSignedTransaction.request(signedTx.rawTransaction, 'receipt', console.log));
        };

        // nonce += 2000;

        await pIteration.forEachSeries(sendList, async (sendItem) => {
            const {to, amount} = sendItem;
            console.log(`${to}: ${amount}`);

            await addToBatch(this.getSendTokenstTx(fromAddress, fromPrivateKey, to, amount, nonce));
            nonce++;
        });

        return batch.execute();
    }

    async getTransaction(method, contractAddress, from, privateKey, nonce = null) {
        const gasPrice = await this.getGasPrice();
        let options = {
            from: from,
            gasPrice: gasPrice,
            nonce: nonce,
            gas: null
        };

        const encodedABI = method.encodeABI();
        if (!options.nonce) {
            options.nonce = await this.web3.eth.getTransactionCount(options.from);
        }

        if (typeof options.nonce === "string") {
            options.nonce = this.web3.utils.hexToNumber(options.nonce);
        }

        try {
            options.gas = await method.estimateGas(options);
        } catch (e) {
            options.gas = "6378750";
        }

        options = _.extend(options, {
            data: encodedABI,
            to: contractAddress
        });

        // console.log('signTransaction', options, privateKey);

        return this.web3.eth.accounts.signTransaction(
            options,
            privateKey,
            false,
        );
    }

    async sendMethod(method, contractAddress, from, privateKey, nonce = null) {
        const signedTx = await this.getTransaction(method, contractAddress, from, privateKey, nonce);

        return new Promise((resolve, reject) => {
            const response = this.web3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, hash) => {
                if (err) {
                    console.log('❌ Error', err.message);
                    return reject(err);
                }
                console.log('✅ Success', hash);

                resolve({
                    hash: hash,
                    promise: response,
                    // nonce: options.nonce,
                    // gasPrice: gasPrice
                });
            })
        })
    }

    getAllTokensTransfers(fromBlock: number = 0, toBlock: any = "latest", filters?): Promise<IDCityChainTransferEvent[]> {
        const parameters: any = {fromBlock, toBlock};
        if (filters) {
            parameters.filter = filters;
        }
        return this.tokenContract.getPastEvents('Transfer', parameters);
    }

    getTokensTransfersToAddress(address: string, fromBlock?: number): Promise<IDCityChainTransferEvent[]> {
        return this.tokenContract.getPastEvents('Transfer', {fromBlock, filter: {to: address}});
    }

    async getTokensTransfersSumOfAddress(address: string, fromBlock?: number): Promise<number> {
        const events = await this.getTokensTransfersToAddress(address, fromBlock);
        // console.log('events', events);
        return this.weiToEther(_.sumBy(events, function (e: IDCityChainTransferEvent) {
            return parseInt(e.returnValues.value.toString(10));
        }));
    }

    async getActiveCityMembers(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.getActiveParticipants()
                .call((err, addresses) => err ? reject(err) : resolve(addresses));
        });
    }

    async getCityTariffsIds(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.getActiveTariffs()
                .call((err, ids) => err ? reject(err) : resolve(ids));
        });
    }

    async getCityTariffInfo(tariffId): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.getTariff(tariffId)
                .call((err, tariff) => err ? reject(err) : resolve(tariff));
        });
    }

    async getTariffActiveParticipantsCount(tariffId): Promise<any> {
        return new Promise((resolve, reject) => {
            this.cityContract.methods.getTariffActiveParticipantsCount(tariffId)
                .call((err, tariff) => err ? reject(err) : resolve(parseInt(tariff.toString(10))));
        });
    }

    async getAllParticipants(tariffId) {
        const tariff: any = await new Promise((resolve, reject) => {
            this.cityContract.methods.getTariff(tariffId)
                .call((err, tariff) => err ? reject(err) : resolve(tariff));
        });

        const addresses = await new Promise((resolve, reject) => {
            this.cityContract.methods.getTariffActiveParticipants(tariffId)
                .call((err, ids) => err ? reject(err) : resolve(ids));
        });

        return pIteration.mapSeries(addresses, async (address) => {
            try {
                const participant: any = await new Promise((resolve, reject) => {
                    this.cityContract.methods.getParticipantTariffInfo(address, tariffId)
                        .call((err, participant) => err ? reject(err) : resolve(participant));
                });

                const currentTimestamp = Math.round(new Date().getTime() / 1000);
                const paymentPeriod = parseInt(tariff.paymentPeriod.toString(10));
                const lastTimestamp = parseInt(participant.lastTimestamp.toString(10));
                const minted = parseFloat(this.web3.utils.fromWei(participant.minted.toString(10), 'ether'));
                const claimed = parseFloat(this.web3.utils.fromWei(participant.claimed.toString(10), 'ether'));

                const periodsForClaim = Math.floor((currentTimestamp - lastTimestamp) / paymentPeriod);

                return {
                    address,
                    periodsForClaim,
                    lastTimestamp,
                    claimed,
                    minted
                }
            } catch (e) {
                console.log('participant catch', address, e);
                return {};
            }
        });
    }

    async getParticipantsForClaim(tariffId) {
        const participants = await this.getAllParticipants(tariffId);

        // console.log(participants.filter(p => p.claimed > 0).map(p => p.address).join('\n'));

        return participants.filter(p => p.periodsForClaim > 0);
    }

    getAddParticipationTx(participantAddress, tariffId, nonce = null) {
        return this.getTransaction(
            this.cityContract.methods.addParticipation(participantAddress, tariffId),
            config.cityContractAddress,
            config.coinbase.address,
            config.coinbase.privateKey,
            nonce
        );
    }

    addParticipation(participantAddress, tariffId, nonce = null) {
        return this.sendMethod(
            this.cityContract.methods.addParticipation(participantAddress, tariffId),
            config.cityContractAddress,
            config.coinbase.address,
            config.coinbase.privateKey,
            nonce
        );
    }

    async addParticipationList(addressList, tariffId) {
        const tariff: any = await new Promise((resolve, reject) => {
            this.cityContract.methods.getTariff(tariffId)
                .call((err, tariff) => err ? reject(err) : resolve(tariff));
        });

        let nonce = await this.web3.eth.getTransactionCount(config.coinbase.address, 'pending');
        if (typeof nonce === "string") {
            nonce = parseInt(this.web3.utils.hexToNumber(nonce));
        }

        const batch = new this.web3.BatchRequest();

        const addToBatch = async (txPromise) => {
            const signedTx = await txPromise;
            return batch.add(this.web3.eth.sendSignedTransaction.request(signedTx.rawTransaction, 'receipt', console.log));
        };

        // nonce += 2000;

        await pIteration.forEachSeries(addressList, async (address, index) => {
            console.log(`${index + 1}/${addressList.length}`);

            if (!this.web3.utils.isAddress(address)) {
                console.log('❗️', new Date(), `Not valid address:`, address);
                return;
            }

            const participant: any = await new Promise((resolve, reject) => {
                this.cityContract.methods.getParticipantTariffInfo(address, tariffId)
                    .call((err, participant) => err ? reject(err) : resolve(participant));
            });

            let success = true;

            if (participant.active) {
                console.log('✅', new Date(), `Already participant: ${address}`);

                const currentTimestamp = Math.round(new Date().getTime() / 1000);
                const paymentPeriod = parseInt(tariff.paymentPeriod.toString(10));
                const lastTimestamp = parseInt(participant.lastTimestamp.toString(10));
                const periodsForClaim = Math.floor((currentTimestamp - lastTimestamp) / paymentPeriod);

                if (periodsForClaim < 1) {
                    console.log('🎁', new Date(), `Already claimed: ${address}`);
                    return;
                }

                await addToBatch(this.getClaimPaymentTx(address, tariffId, '1', nonce));
                // try {
                //   await this.claimPayment(address, tariffId, '1', nonce);
                // } catch (e) {
                //   nonce++;
                //   await this.claimPayment(address, tariffId, '1', nonce).catch(e => {
                //     console.error(`Error on trying to claim ${address}: ${e.message}`);
                //     success = false;
                //   });
                // }
                nonce++;
                if (success) {
                    console.log('🎁', new Date(), `Payment claimed for: ${address}`);
                }
                return;
            }

            // try {
            //   await this.addParticipation(address, tariffId, nonce);
            // } catch (e) {
            //   nonce++;
            //   await this.addParticipation(address, tariffId, nonce).catch(e => {
            //     console.error(`Error on trying to add participant ${address}: ${e.message}`);
            //     success = false;
            //   });
            // }
            await addToBatch(this.getAddParticipationTx(address, tariffId, nonce));

            nonce++;

            if (success) {
                console.log('✅', new Date(), `Participant added: ${address}`);

                // try {
                //   await this.claimPayment(address, tariffId, '1', nonce);
                // } catch (e) {
                //   nonce++;
                //   await this.claimPayment(address, tariffId, '1', nonce).catch(e => {
                //     console.error(`Error on trying to claim payment for ${address}: ${e.message}`);
                //     success = false;
                //   });
                // }
                await addToBatch(this.getClaimPaymentTx(address, tariffId, '1', nonce));
                nonce++;

                if (success) {
                    console.log('🎁', new Date(), `Payment claimed for: ${address}`);
                }
            }
        });

        return batch.execute();
    }

    claimPayment(participantAddress, tariffId, periodsNumber, nonce = null) {
        return this.sendMethod(
            this.cityContract.methods.claimPayment(participantAddress, tariffId, periodsNumber.toString(10)),
            config.cityContractAddress,
            config.coinbase.address,
            config.coinbase.privateKey,
            nonce
        );
    }

    getClaimPaymentTx(participantAddress, tariffId, periodsNumber, nonce = null) {
        return this.getTransaction(
            this.cityContract.methods.claimPayment(participantAddress, tariffId, periodsNumber.toString(10)),
            config.cityContractAddress,
            config.coinbase.address,
            config.coinbase.privateKey,
            nonce
        );
    }

    async checkAndClaimAvailablePayments() {
        console.log(new Date(), '🔎 Find tariffs and participants for claim payout');
        const tariffsIds = await this.getCityTariffsIds();
        console.log(new Date(), `📋 ${tariffsIds.length} Tariffs found`);

        let nonce = await this.web3.eth.getTransactionCount(config.coinbase.address);
        if (typeof nonce === "string") {
            nonce = parseInt(this.web3.utils.hexToNumber(nonce));
        }

        return pIteration.forEachSeries(tariffsIds, async (tariffId) => {
            const participants = await this.getParticipantsForClaim(tariffId);

            console.log(new Date(), `👥 ${participants.length} Not claimed participants found of tariff ${tariffId}`);

            await pIteration.forEachSeries(participants, async (participant) => {
                try {
                    await this.claimPayment(participant.address, tariffId, participant.periodsForClaim, nonce);
                } catch (e) {
                    nonce++;
                    await this.claimPayment(participant.address, tariffId, participant.periodsForClaim, nonce);
                }
                nonce++;
            });

            console.log(new Date(), `🎁 All claim transaction sent for tariff ${tariffId}`);
        });
    }

    runAutoClaimer() {
        this.checkAndClaimAvailablePayments();

        setInterval(() => {
            this.checkAndClaimAvailablePayments();
        }, config.autoClaimPeriodSeconds * 1000);
    }

    private subscribeForReconnect() {
        if (!this.websocketProvider) {
            return;
        }
        this.websocketProvider.on('end', () => {
            setTimeout(() => {
                console.log('🔁 Websocket reconnect');

                this.websocketProvider = new Web3.providers.WebsocketProvider(config.rpcServer);
                this.web3 = new Web3(this.websocketProvider);

                if (this.callbackOnReconnect) {
                    this.callbackOnReconnect();
                }

                this.subscribeForReconnect();
            }, 1000);
        });
    }

    private createContractInstance() {
        this.tokenContract = new this.web3.eth.Contract(config.tokenContractAbi, config.tokenContractAddress);
        this.cityContract = new this.web3.eth.Contract(config.cityContractAbi, config.cityContractAddress);
    }
}