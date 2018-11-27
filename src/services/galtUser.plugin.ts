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

import GaltData from "./galtData";

const _ = require('lodash');
const galtUtils = require('@galtproject/utils');

export default {
    install (Vue, options: any = {}) {
        let walletAddress;

        let internalWalletAddress;
        let internalWalletPrivateKey;

        let internalWalletActive = false;

        function sendOptions(fromInternalWallet?) {
            if(fromInternalWallet && internalWalletActive) {
                return {from: internalWalletAddress, privateKey: internalWalletPrivateKey};
            } else {
                return {from: walletAddress};
            }
        }

        function getContract(contractName) {
            const contract = $contracts['$' + contractName];
            if(!contract) {
                throw "Contract " + contractName + " not found";
            }
            return contract;
        }

        let walletReadyCallback;
        let walletReadyPromise = new Promise((resolve, reject) => {
            walletReadyCallback = resolve;
        });
        
        function onWalletReady(){
            return new Promise((resolve, reject) => {
                if(walletAddress)
                    resolve();
                else
                    walletReadyPromise.then(() => {
                        resolve();
                    })
            });
        }
        
        const onInternalWalletSet = [];
        const onInternalWalletActivatedCallbacks = [];

        let $internalWallet;
        let $contracts;
        let $store;
        
        Vue.prototype.$galtUser = {
            init(internalWalletPlugin, contracts, store) {
                $internalWallet = internalWalletPlugin;
                $contracts = contracts;
                $store = store;

                $internalWallet.setActive(false);
                this.setInternalWallet($internalWallet.getAddress(), $internalWallet.getPrivate());
            },
            getAddress() {
                return walletAddress;
            },
            setAddress(_walletAddress) {
                let firstInit = false;
                if(!walletAddress) {
                    firstInit = true;
                }
                walletAddress = _walletAddress;
                if(firstInit) {
                    walletReadyCallback();
                }
            },

            getInternalWallet() {
                return internalWalletAddress;
            },
            setInternalWallet(_internalWalletAddress, _internalWalletPrivateKey) {
                internalWalletAddress = _internalWalletAddress;
                internalWalletPrivateKey = _internalWalletPrivateKey;

                onInternalWalletSet.forEach(callback => {
                    callback(_internalWalletAddress);
                });
            },
            getInternalWalletActive() {
                return internalWalletActive;
            },
            setInternalWalletActive(_active) {
                internalWalletActive = _active;

                onInternalWalletActivatedCallbacks.forEach(callback => {
                    callback(_active);
                });
            },

            onInternalWalletSet(callback) {
                onInternalWalletSet.push(callback);
            },

            onInternalWalletActivated(callback) {
                onInternalWalletActivatedCallbacks.push(callback);
            },

            // Web3 Data
            async balance(currency) {
                await onWalletReady();
                if(currency.toLowerCase() == 'eth') {
                    return await this.ethBalance();
                } else if(currency.toLowerCase() == 'galt') {
                    return await this.galtBalance();
                } else {
                    return await this.erc20Balance(currency);
                }
            },
            async ethBalance() {
                await onWalletReady();
                return await GaltData.ethBalance(walletAddress);
            },
            async sendEthFromUserWaller(recipient, ethAmount) {
                return await GaltData.sendEthTo(sendOptions(), recipient, ethAmount);
            },
            async sendEthFromInternalWaller(recipient, ethAmount) {
                return await GaltData.sendEthTo(sendOptions(true), recipient, ethAmount);
            },

            // Erc20 Contract
            async erc20Balance(erc20Address) {
                await onWalletReady();
                return await GaltData.erc20Balance(erc20Address, walletAddress);
            },
            async approveErc20(erc20Address, address, galtAmount) {
                return await GaltData.approveErc20(sendOptions(), erc20Address, address, galtAmount);
            },
            async getErc20Allowance(erc20Address, address) {
                await onWalletReady();
                return await GaltData.getErc20Allowance(erc20Address, walletAddress, address);
            },

            // Galt Contract
            async coinBalance() {
                await onWalletReady();
                return await GaltData.coinBalance(walletAddress);
            },
            async approveCoin(address, galtAmount) {
                return await GaltData.approveCoin(sendOptions(), address, galtAmount);
            },
            async getCoinAllowance(address) {
                await onWalletReady();
                return await GaltData.getCoinAllowance(walletAddress, address);
            },
            async waitForApproveCoin(addressForAprove, needGaltAmount){
                return new Promise((resolve, reject) => {
                    const interval = setInterval(async () => {
                        const galtAllowance = await this.getGaltAllowance(addressForAprove);

                        if (galtAllowance >= needGaltAmount) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 10000);
                });
            },
            
            async createTariff(tariff) {
                return await $contracts.$city.createTariff(sendOptions(), {
                    title: tariff.title,
                    payment: GaltData.etherToWei(tariff.payment),
                    paymentPeriod: tariff.paymentPeriod,
                    currency: tariff.currency.name == 'eth' ? tariff.currency.name : tariff.currency.address
                });
            },

            async editTariff(tariff) {
                return await $contracts.$city.editTariff(sendOptions(), {
                    title: tariff.title,
                    payment: GaltData.etherToWei(tariff.payment),
                    paymentPeriod: tariff.paymentPeriod,
                    currency: tariff.currency.name == 'eth' ? tariff.currency.name : tariff.currency.address
                });
            },
            
            async changeMemberTariff(memberAddress, tariffId) {
                return await $contracts.$city.changeMemberTariff(sendOptions(), memberAddress, tariffId);
            },

            async addMember(memberAddress, tariffId) {
                return await $contracts.$city.addMember(sendOptions(), memberAddress, tariffId);
            },

            async deactivateTariff(tariff) {
                return await $contracts.$city.deactivateTariff(sendOptions(), tariff);
            },

            async activateTariff(tariff) {
                return await $contracts.$city.activateTariff(sendOptions(), tariff);
            },
            
            async kickMember(member) {
                return await $contracts.$city.kickMember(sendOptions(), member);
            },

            async claimPaymentFor(memberAddress) {
                return await $contracts.$city.claimPaymentFor(sendOptions(), memberAddress);
            },
            
            async hasCityManagerRole() {
                await onWalletReady();
                return await $contracts.$city.hasRole(walletAddress, "city_manager");
            },

            async generateNewInternalWallet(){
                const isActive = this.getInternalWalletActive();
                if(!isActive){
                    this.setInternalWalletActive(true);
                }
                
                $internalWallet.generateNew();
                const newInternalAddress = $internalWallet.getAddress();
                
                const promise = this.sendAllInternalWalletEthTo(newInternalAddress);
                
                this.setInternalWallet(newInternalAddress, $internalWallet.getPrivate());
                
                if(!isActive){
                    this.setInternalWalletActive(false);
                }
                return promise;
            },

            async sendAllInternalWalletEthTo(recipient){
                return GaltData.sendAllEthTo(sendOptions(true), recipient);
            },
            
            async releaseInternalWallet(contractName, subjectId) {
                if(!internalWalletActive) {
                    return;
                }

                await onWalletReady();
                
                this.sendAllInternalWalletEthTo(walletAddress);
                
                $internalWallet.setActive(false);
                this.setInternalWalletActive(false);
            },
            
        };
    }
}
