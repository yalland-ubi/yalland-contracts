/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company 
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster), 
 * [Valery Litvin](https://github.com/litvintech) by 
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 * ​
 * Copyright ©️ 2018 Galt•Core Blockchain Company 
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and 
 * Galt•Space Society Construction and Terraforming Company by 
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

import * as pIteration from "p-iteration";
import * as _ from "lodash";
const Web3 = require('web3');
const BN = Web3.utils.BN;
const isIPFS = require('is-ipfs');

import ConfirmModal from "../modals/ConfirmModal/ConfirmModal";
import SpecifyAmountModal from "../modals/SpecifyAmountModal/SpecifyAmountModal";
import UseInternalWalletModal from "../modals/UseInternalWalletModal/UseInternalWalletModal";
import SpecifySelectOptionModal from "../modals/SpecifySelectOptionModal/SpecifySelectOptionModal";
import ChangelogModal from "../modals/ChangelogModal/ChangelogModal";
const EthContract = require('../libs/EthContract');

const config = require("../../config");
const galtUtils = require('@galtproject/utils');
import * as moment from 'moment';

export default class GaltData {
    static contractsConfig: any;
    static cachedLocale: {[language: string]: any} = {};
    static $http: any;
    static $store: any;
    static $root: any;
    static $geohashWorker: any;
    static $web3Worker: any;
    static $contracts: any;
    
    static operationsCount: number = 0;
    
    static nullAddress = '0x0000000000000000000000000000000000000000';
    static nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    static applicationCurrencies = [
        {id: 0, name: 'eth'},
        {id: 1, name: 'galt'}
    ];
    
    static erc20Abi = '[{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]';
    
    static init(vueInstance) {
        this.$http = vueInstance.$http;
        this.$store = vueInstance.$store;
        this.$root = vueInstance.$root;
        this.$geohashWorker = vueInstance.$geohashWorker;
        this.$web3Worker = vueInstance.$web3Worker;
        this.$contracts = vueInstance.$contracts;
    }

    static rpcServer() {
        return config.rpcServer;
    }

    static wsServer() {
        return config.rpcServer.replace('http', 'ws').replace('8545', '8546');
    }
    
    static callMethodsRpcServer() {
        if(config.enableWebSocket) {
            return GaltData.wsServer();
        } else {
            return GaltData.rpcServer();
        }
    }

    static rpcServerId() {
        return config.rpcServerId;
    }

    static altRpcServers() {
        return (config.altRpcServers || "").split(",");
    }

    static allowableRpcServers() {
        const allServers = GaltData.altRpcServers();
        allServers.unshift(GaltData.rpcServer());
        return allServers;
    }

    static version() {
        return config.version;
    }
    
    static async getChangelogHtml() {
        return new Promise((resolve, reject) => {
            this.$http.get('/build/changelog.html').then((response) => {
                resolve(response.data);
            });
        });
    }

    static async getContractsConfig() {
        return new Promise((resolve, reject) => {
            if (this.contractsConfig)
                return resolve(this.contractsConfig);

            this.$http.get(config.contractsConfigUrl).then((response) => {
                if(!response || !response.data) {
                    setTimeout(() => GaltData.getContractsConfig(), 1000);
                    return;
                }
                this.contractsConfig = response.data;
                console.log('contractsConfig', this.contractsConfig);
                resolve(this.contractsConfig);
            }).catch(() => {
                setTimeout(() => {
                    GaltData.getContractsConfig().then(resolve);
                }, 1000);
            });
        });
    }

    static async getLocale(language) {
        return new Promise((resolve, reject) => {
            if (this.cachedLocale[language])
                return resolve(this.cachedLocale[language]);

            this.$http.get('/locale/' + language + '.json').then((response) => {
                if(!response || !response.data) {
                    setTimeout(() => GaltData.getLocale(language), 1000);
                    return;
                }
                this.cachedLocale[language] = response.data;
                console.log(language + ' locale', this.cachedLocale[language]);
                resolve(this.cachedLocale[language]);
            }).catch(() => {
                setTimeout(() => {
                    GaltData.getLocale(language).then(resolve);
                }, 1000);
            });
        });
    }

    static async ethBalance(userWallet) {
        const balanceInWei = await this.$root.$serverWeb3.eth.getBalance(userWallet);
        return GaltData.weiToEtherRound(balanceInWei);
    }

    static async gasPrice(mulToGasLimit) {
        let gasPrice = await this.$root.$serverWeb3.eth.getGasPrice();
        gasPrice = parseInt(gasPrice);

        if (gasPrice < 1000000000)
            gasPrice = 1000000000;

        if(mulToGasLimit) {
            gasPrice = (new BN(gasPrice)).mul(new BN(mulToGasLimit));
        }

        return GaltData.weiToEther(gasPrice.toString(10));
    }
    
    static async getMinGas() {
        return 53000;
    }

    static async sendEthTo(sendOptions, recipient, ethAmount) {
        return new Promise((resolve, reject) => {

            this.$root.$serverWeb3.eth.getGasPrice().then(async (gasPrice) => {
                gasPrice = parseInt(gasPrice) || '1000000000';

                sendOptions.value = GaltData.etherToWei(ethAmount);
                sendOptions.to = recipient;
                sendOptions.gasPrice = gasPrice;
                
                if(sendOptions.privateKey) {
                    if(!sendOptions.nonce) {
                        sendOptions.nonce = await this.$root.$serverWeb3.eth.getTransactionCount(sendOptions.from);
                    }
                    if(!sendOptions.gas) {
                        sendOptions.gas = await GaltData.getMinGas();
                    }
                    
                    const signedTx = await this.$root.$serverWeb3.eth.accounts.signTransaction(
                        sendOptions,
                        sendOptions.privateKey,
                        false,
                    );
                    // @ts-ignore: property exists
                    return this.$root.$serverWeb3.eth.sendSignedTransaction(signedTx.rawTransaction, (err, result) => {
                        err ? reject(err) : resolve(result);
                    });
                } else {
                    if(!sendOptions.gas) {
                        sendOptions.gas = 21000;
                    }
                    this.$root.$serverWeb3.eth
                        .sendTransaction(sendOptions, (err, result) => {
                            err ? reject(err) : resolve(result);
                        });
                }
            });
        });
    }

    static async sendAllEthTo(sendOptions, recipient) {
        return new Promise(async (resolve, reject) => {
            const ethBalance = await GaltData.ethBalance(sendOptions.from);
            console.log('sendAllEthTo.ethBalance', ethBalance);
            if(!ethBalance) {
                return resolve();
            }
            let gasPrice = await this.$root.$serverWeb3.eth.getGasPrice();
            gasPrice = parseInt(gasPrice) || '1000000000';

            const weiNeedForTx = gasPrice * (await GaltData.getMinGas()) * 4;

            const weiBalance = GaltData.etherToWei(ethBalance);
            const ethToSend = GaltData.weiToEther(new BN(weiBalance.toString(10)).sub(new BN(weiNeedForTx.toString(10))));
            console.log('sendAllEthTo.ethToSend', ethToSend);
            if(ethToSend < 0.001) {
                return resolve();
            }

            const txHash = await GaltData.sendEthTo(sendOptions, recipient, ethToSend).catch(reject);
            this.$web3Worker.callMethod('waitForTransactionResult', txHash).then(resolve).catch(reject);
        });
        
    }

    static copyToClipboard (str) {
        const el = document.createElement('textarea');
        el.value = str;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    }

    static async waitSeconds(seconds) {
        return await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 1000 * seconds)
        });
    }
    
    static beautyNumber(number) {
        number = parseFloat(number);
        number = Math.round(number * 100) / 100;
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    static beautyDate(date) {
        if(_.isNumber(parseInt(date)) && !_.isNaN(parseInt(date))) {
            date = new Date(parseInt(date) * 1000);
        }
        let mDate = moment(date);
        let now = moment();

        if (now.diff(mDate, 'hours') >= 24)
            return mDate.format("D MMMM YYYY H:mm:ss");
        else
            return mDate.fromNow();
    }

    static async sendMassTransaction(contractName, operationId, sendOptions, method, args) {
        const contract = this.$root['$' + contractName];

        await contract.onReady();
        
        if(sendOptions.privateKey) {
            this.$web3Worker.callMethod('sendTransactionToContract', {
                contractAbi: contract.abi,
                contractAddress: contract.address,
                contractName: contractName,
                operationId: operationId,
                rpcServer: GaltData.callMethodsRpcServer(),
                method: method,
                sendOptions: sendOptions,
                args: args
            });
        } else {
            const txResponse = await contract.sendMethod.apply(contract, [sendOptions, method].concat(args)).catch((response) => {
                return response;
            });
            this.$web3Worker.callMethod('addTransactionWatcherToOperation', {
                operationId: operationId,
                txHash: txResponse.hash
            });
        }
    }

    static async sendMassCallByAddress(contractAddress, contractAbi, contractName, method, args?) {
        return await this.$web3Worker.callMethod('callMethodFromContract', {
            contractAbi: _.isObject(contractAbi) ? contractAbi : JSON.parse(contractAbi),
            contractAddress: contractAddress,
            contractName: contractName + "_" + contractAddress,
            rpcServer: GaltData.callMethodsRpcServer(),
            method: method,
            args: args || []
        });
    }

    static async sendMassCall(contractName, method, args?) {
        const contract = this.$root['$' + contractName];
        
        try {
            await contract.onReady();
        } catch (e) {
            console.error('Contract ' + contractName + ' not found');
            return;
        }
        
        return await contract.massCallMethod(method, args);
    }
    
    static getNewOperationId(){
        GaltData.operationsCount = parseInt(localStorage.getItem('operationsCount') || '0');
        const newOperationId = ++GaltData.operationsCount;
        localStorage.setItem('operationsCount', newOperationId.toString());
        return newOperationId;
    }
    
    static async getTransactionCount(from) {
        return await this.$root.$serverWeb3.eth.getTransactionCount(from);
    }

    // ===========================================================
    // Helpers
    // ===========================================================
    static toBytes(str: string) {
        return this.$root.$web3.utils.asciiToHex(str.toString());
    }

    static geohashToUint = galtUtils.geohashToGeohash5;
    static geohashToTokenId = galtUtils.geohashToTokenId;
    static tokenIdToGeohash = galtUtils.tokenIdToGeohash;

    static geohashArrayToUint(geohashArray: string[]) {
        return geohashArray.map(galtUtils.geohashToGeohash5)
    }

    static geohashArrayToTokenId(geohashArray: string[]) {
        return geohashArray.map((geohash) => {
            return GaltData.geohashToTokenId(geohash);
        })
    }
    
    static tokenIdToHex(tokenId) {
        const geohash16 = (new Web3.utils.BN(tokenId)).toString(16);
        let hex;
        if(geohash16.length === 64) {
            hex = geohash16;
        } else {
            hex = "0".repeat(64 - geohash16.length) + geohash16;
        }
        return "0x" + hex;
    }
    
    static stringToHex(string) {
        if(isIPFS.multihash(string)) {
            return galtUtils.ipfsHashToBytes32(string);
        }
        return Web3.utils.utf8ToHex(string);
    }

    static hexToString(hex) {
        if(!hex) {
            return "";
        }
        try {
            return Web3.utils.hexToUtf8(hex);
        } catch (e) {
            // most possible this is ipfs hash
            if(hex.length == 66) {
                const ipfsHash = galtUtils.bytes32ToIpfsHash(hex);
                if(isIPFS.multihash(ipfsHash)) {
                    return ipfsHash;
                }
            }
            return null;
        }
    }

    static roundToDecimal(number, decimal = 4) {
        return Math.ceil(number * Math.pow(10, decimal)) / Math.pow(10, decimal);
    }

    static weiToSzabo(wei) {
        return parseFloat(Web3.utils.fromWei(wei.toString(10), 'szabo'));
    }

    static weiToSzaboRound(wei) {
        return GaltData.roundToDecimal(GaltData.weiToSzabo(wei));
    }

    static szaboToWei(number) {
        return Web3.utils.toWei(number, 'szabo');
    }

    static weiToEther(wei) {
        return parseFloat(Web3.utils.fromWei(wei.toString(10), 'ether'));
    }

    static weiToEtherRound(wei) {
        return GaltData.roundToDecimal(GaltData.weiToEther(wei));
    }

    static etherToWei(number) {
        return Web3.utils.toWei(number.toString(10), 'ether');
    }

    static gweiToWei(number) {
        return Web3.utils.toWei(number.toString(10), 'gwei');
    }

    static weiToGwei(wei) {
        return parseFloat(Web3.utils.fromWei(wei.toString(10), 'gwei'));
    }

    static upperFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // ===========================================================
    // Erc20 Contract
    // ===========================================================
    static async erc20Balance(erc20Address, userWallet) {
        const balanceInWei = await GaltData.sendMassCallByAddress(erc20Address, GaltData.erc20Abi, 'ERC20','balanceOf', [userWallet]);
        return GaltData.weiToEtherRound(balanceInWei);
    }

    static async approveErc20(sendOptions, erc20Address, approveToWallet, approveAmount){
        await this.$root.$galtTokenContract.onReady();
        const erc20Contract = new EthContract(this.$root.$galtTokenContract.web3, null, GaltData.erc20Abi, erc20Address);
        erc20Contract.setWeb3Worker(GaltData.$web3Worker);
        return await erc20Contract.sendMethod(sendOptions, 'approve', approveToWallet, GaltData.etherToWei(approveAmount));
    }

    static async getErc20Allowance(erc20Address, userAddress, approveToWallet) {
        return GaltData.weiToEther(await GaltData.sendMassCallByAddress(erc20Address, GaltData.erc20Abi,'allowance', [userAddress, approveToWallet]));
    }

    // ===========================================================
    // Modals
    // ===========================================================
    static confirmModal(props) {
        return new Promise((resolve, reject) => {
            this.$root.$asyncModal.open({
                id: 'confirm-modal',
                component: ConfirmModal,
                props: props,
                onClose(confirmed) {
                    if(confirmed) {
                        resolve();
                    } else {
                        reject();
                    }
                }
            });
        });
    }

    static specifyAmountModal(props) {
        return new Promise((resolve, reject) => {
            this.$root.$asyncModal.open({
                id: 'specify-amount-modal',
                component: SpecifyAmountModal,
                props: props,
                onClose(amount) {
                    if(amount) {
                        resolve(amount);
                    } else {
                        reject();
                    }
                }
            });
        });
    }

    static specifySelectOptionModal(props) {
        return new Promise((resolve, reject) => {
            this.$root.$asyncModal.open({
                id: 'specify-select-option-modal',
                component: SpecifySelectOptionModal,
                props: props,
                onClose(selected) {
                    if(selected) {
                        resolve(selected);
                    } else {
                        reject();
                    }
                }
            });
        });
    }

    static changelogModal() {
        return new Promise((resolve, reject) => {
            this.$root.$asyncModal.open({
                id: 'changelog-modal',
                component: ChangelogModal
            });
        });
    }

    static useInternalWalletModal(contractName, subjectId, txCount, ethPerTx?, sentEthPromise?) {
        return new Promise((resolve, reject) => {
            this.$root.$asyncModal.open({
                id: 'use-internal-wallet-modal',
                component: UseInternalWalletModal,
                props: {
                    contractName,
                    subjectId,
                    txCount,
                    ethPerTx,
                    sentEthPromise
                },
                onClose(mode) {
                    if(mode == 'metamask' || mode == 'internal_wallet') {
                        resolve(mode);
                    } else {
                        reject();
                    }
                }
            });
        });
    }
}
