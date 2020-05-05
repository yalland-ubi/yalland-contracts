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

export default class ExchangeContract extends EthContract {
    async setTotalPeriodLimit(sendOptions, _totalPeriodLimit) {
        return this.sendMethod(
            sendOptions,
            "setTotalPeriodLimit",
            GaltData.etherToWei(_totalPeriodLimit)
        );
    }

    async setDefaultMemberPeriodLimit(sendOptions, _defaultMemberPeriodLimit) {
        return this.sendMethod(
          sendOptions,
          "setDefaultMemberPeriodLimit",
          GaltData.etherToWei(_defaultMemberPeriodLimit)
        );
    }

    async setCustomPeriodLimit(sendOptions, _memberId, _customPeriodLimit) {
        return this.sendMethod(
          sendOptions,
          "setCustomPeriodLimit",
          _memberId,
          GaltData.etherToWei(_customPeriodLimit)
        );
    }

    async setDefaultExchangeRate(sendOptions, _defaultExchangeRate) {
        return this.sendMethod(
          sendOptions,
          "setDefaultExchangeRate",
          GaltData.etherToWei(_defaultExchangeRate * 100)
        );
    }

    async setCustomExchangeRate(sendOptions, _memberId, _customExchangeRate) {
        return this.sendMethod(
          sendOptions,
          "setCustomExchangeRate",
          _memberId,
          GaltData.etherToWei(_customExchangeRate * 100)
        );
    }

    async calculateMaxYalToSellByAddress(wallet){
        return this.massCallMethod("calculateMaxYalToSellByAddress", [wallet])
            .then(balanceInWei => GaltData.weiToEtherRound(balanceInWei));
    }

    async defaultExchangeRate(){
        return this.massCallMethod("defaultExchangeRate", [])
          .then(balanceInWei => GaltData.weiToEtherRound(balanceInWei) / 100);
    }

    async defaultMemberPeriodLimit(){
        return this.massCallMethod("defaultMemberPeriodLimit", [])
          .then(balanceInWei => GaltData.weiToEtherRound(balanceInWei));
    }

    async totalPeriodLimit(){
        return this.massCallMethod("totalPeriodLimit", [])
          .then(balanceInWei => GaltData.weiToEtherRound(balanceInWei));
    }

    async totalExchangedYal(){
        return this.massCallMethod("totalExchangedYal", [])
          .then(balanceInWei => GaltData.weiToEtherRound(balanceInWei));
    }

    async getMember(memberId){
        const member = await this.massCallMethod("members", [memberId]);
        member.customExchangeRate = GaltData.weiToEtherRound(member.customExchangeRate) / 100;
        member.customPeriodLimit = GaltData.weiToEtherRound(member.customPeriodLimit);
        member.totalExchanged = GaltData.weiToEtherRound(member.totalExchanged);
        member.totalVoided = GaltData.weiToEtherRound(member.totalVoided);
        return member;
    }

    async getOrder(orderId){
        const order = await this.massCallMethod("orders", [orderId]);
        order.yalAmount = GaltData.weiToEtherRound(order.yalAmount);
        order.buyAmount = GaltData.weiToEtherRound(order.buyAmount);
        return order;
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
