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
const pIteration = require('p-iteration');

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
                    return this.ethBalance();
                } else if(currency.toLowerCase() == 'galt') {
                    return this.galtBalance();
                } else {
                    return this.erc20Balance(currency);
                }
            },
            async ethBalance() {
                await onWalletReady();
                return GaltData.ethBalance(walletAddress);
            },
            async sendEthFromUserWaller(recipient, ethAmount) {
                return GaltData.sendEthTo(sendOptions(), recipient, ethAmount);
            },
            async sendEthFromInternalWaller(recipient, ethAmount) {
                return GaltData.sendEthTo(sendOptions(true), recipient, ethAmount);
            },

            // Erc20 Contract
            async erc20Balance(erc20Address) {
                await onWalletReady();
                return GaltData.erc20Balance(erc20Address, walletAddress);
            },
            async approveErc20(erc20Address, address, galtAmount) {
                return GaltData.approveErc20(sendOptions(), erc20Address, address, galtAmount);
            },
            async getErc20Allowance(erc20Address, address) {
                await onWalletReady();
                return GaltData.getErc20Allowance(erc20Address, walletAddress, address);
            },

            // Coin Contract
            async coinBalance() {
                await onWalletReady();
                return $contracts.$coinToken.balanceOf(walletAddress);
            },
            async transferCoin(recipient, galtAmount) {
                return GaltData.transferCoin(sendOptions(), recipient, galtAmount);
            },
            async approveCoin(address, galtAmount) {
                return $contracts.$coinToken.approve(sendOptions(), address, galtAmount);
            },
            async withdrawCoinFee() {
                return $contracts.$coinToken.withdrawFee(sendOptions());
            },
            async setCoinTransferFee(newFee) {
                // return console.log($contracts, sendOptions); //TODO: delete
                return $contracts.$coinToken.setTransferFee(sendOptions(), newFee);
            },
            async getCoinAllowance(address) {
                await onWalletReady();
                return $contracts.$coinToken.allowance(walletAddress, address);
            },
            async waitForApproveCoin(addressForAprove, needGaltAmount){
                return new Promise((resolve, reject) => {
                    const interval = setInterval(async () => {
                        const galtAllowance = await this.getCoinAllowance(addressForAprove);

                        if (galtAllowance >= needGaltAmount) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 10000);
                });
            },
            
            async createTariff(tariff) {
                return $contracts.$city.createTariff(sendOptions(), {
                    title: tariff.title,
                    payment: tariff.payment,
                    paymentPeriod: tariff.paymentPeriod,
                    mintForPeriods: tariff.mintForPeriods,
                    currency: tariff.currency.name == 'eth' ? tariff.currency.name : tariff.currency.address
                });
            },

            async editTariff(tariff) {
                // return console.log($contracts, sendOptions);//TODO: delete
                return $contracts.$city.editTariff(sendOptions(), {
                    id: tariff.id,
                    title: tariff.title,
                    payment: tariff.payment,
                    paymentPeriod: tariff.paymentPeriod,
                    mintForPeriods: tariff.mintForPeriods,
                    currency: tariff.currency.name == 'eth' ? tariff.currency.name : tariff.currency.address
                });
            },
            
            async changeMemberTariff(memberAddress, tariffId) {
                return $contracts.$city.changeMemberTariff(sendOptions(), memberAddress, tariffId);
            },

            async addMember(memberAddress, tariffId) {
                return $contracts.$city.addMember(sendOptions(), memberAddress, tariffId);
            },

            async deactivateTariff(tariff) {
                return $contracts.$city.deactivateTariff(sendOptions(), tariff);
            },

            async activateTariff(tariff) {
                return $contracts.$city.activateTariff(sendOptions(), tariff);
            },
            
            async kickTariffMember(member, tariffId) {
                return $contracts.$city.kickTariffMember(sendOptions(), member, tariffId);
            },

            async claimPaymentFor(memberAddress, periodsNumber = 1) {
                return $contracts.$city.claimPaymentFor(sendOptions(), memberAddress, periodsNumber);
            },
            
            async mintCoinToCity(tokensAmount) {
                return $contracts.$city.mintTokens(sendOptions(), $contracts.$coinToken.address, tokensAmount);
            },
            
            async hasRateManagerRole() {
                await onWalletReady();
                return $contracts.$city.hasRole(walletAddress, "rate_manager");
            },

            async hasMemberJoinManagerRole() {
                await onWalletReady();
                return $contracts.$city.hasRole(walletAddress, "member_join_manager");
            },

            async hasMemberLeaveManagerRole() {
                await onWalletReady();
                return $contracts.$city.hasRole(walletAddress, "member_leave_manager");
            },

            async hasFeeManagerRole() {
                await onWalletReady();
                return $contracts.$coinToken.hasRole(walletAddress, "fee_manager");
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
            
            async releaseInternalWallet(contractName?, subjectId?) {
                if(!internalWalletActive) {
                    return;
                }

                await onWalletReady();
                
                this.sendAllInternalWalletEthTo(walletAddress);
                
                $internalWallet.setActive(false);
                this.setInternalWalletActive(false);
            },
            
            claimPaymentForMultipleMembers(members, tariffId){
                const operationId = GaltData.getNewOperationId();
                
                const currentTimestamp = Date.now() / 1000;

                members.forEach((member: any) => {
                    const claimForPeriods = Math.floor((currentTimestamp - member.lastTimestamp) / member.tariffObject.paymentPeriod);
                    console.log('claimForPeriods', claimForPeriods, member.address);
                    
                    GaltData.sendMassTransaction(
                        'cityContract', 
                        operationId, 
                        sendOptions(true), 
                        'claimPayment', 
                        [member.address, tariffId, claimForPeriods]
                    )
                });
                
                return operationId;
            }
        };
    }
}
