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

import GaltData from "../services/galtData";

const EthContract = require('../libs/EthContract');

export default class CoinTokenContract extends EthContract {
    async approve(sendOptions, approveToWallet, approveAmount) {
        return await this.sendMethod(
            sendOptions,
            "approve",
            approveToWallet,
            GaltData.etherToWei(approveAmount));
    }

    async balanceOf(wallet){
        return this.massCallMethod("balanceOf", [wallet])
            .then(async (balanceInWei) => {
                return GaltData.weiToEtherRound(balanceInWei);
            });
    }

    async transferFee(){
        return this.massCallMethod("transferFee")
            .then(async (feeInWei) => {
                return GaltData.weiToSzabo(feeInWei);
            });
    }

    async allowance(userAddress, approveToWallet){
        return this.massCallMethod("allowance", [userAddress, approveToWallet])
            .then(async (balanceInWei) => {
                return GaltData.weiToEtherRound(balanceInWei);
            });
    }

    async totalSupply(){
        return this.massCallMethod("totalSupply")
            .then(async (feeInWei) => {
                return GaltData.weiToEtherRound(feeInWei);
            });
    }
    
    async feePayout() {
        return this.balanceOf(this.address);
    }
    
    async withdrawFee(sendOptions) {
        return await this.sendMethod(
            sendOptions,
            "withdrawFee");
    }

    async setTransferFee(sendOptions, newFeeAmount) {
        return await this.sendMethod(
            sendOptions,
            "setTransferFee",
            GaltData.szaboToWei(newFeeAmount));
    }
}
