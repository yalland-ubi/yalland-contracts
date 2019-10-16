/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "../services/galtData";

const EthContract = require('../libs/EthContract');

export default class CoinTokenContract extends EthContract {
    async approve(sendOptions, approveToWallet, approveAmount) {
        return this.sendMethod(
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
        return this.sendMethod(
            sendOptions,
            "withdrawFee");
    }

    async setTransferFee(sendOptions, newFeeAmount) {
        return this.sendMethod(
            sendOptions,
            "setTransferFee",
            GaltData.szaboToWei(newFeeAmount));
    }
    
    async hasRole(userWallet, roleName) {
        return this.massCallMethod("hasRole", [userWallet, roleName]);
    }

    async addRoleTo(sendOptions, address, role) {
        return this.sendMethod(
            sendOptions,
            "addRoleTo",
            address,
            role);
    }

    async transferOwnership(sendOptions, address) {
        return this.sendMethod(
            sendOptions,
            "transferOwnership",
            address);
    }
}
