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
import * as _ from "lodash";
import * as pIteration from "p-iteration";

const EthContract = require('../libs/EthContract');

export default class CityContract extends EthContract {
    
    tariffsCache = {};

    async createTariff(sendOptions, tariff) {
        return this.sendMethod(
            sendOptions,
            "createTariff",
            tariff.title,
            GaltData.etherToWei(tariff.payment),
            tariff.paymentPeriod,
            tariff.mintForPeriods,
            tariff.currency == 'eth' ? "0" : "1",
            tariff.currency == 'eth' ? GaltData.nullAddress : tariff.currency);
    }

    async editTariff(sendOptions, tariff) {
        return this.sendMethod(
            sendOptions,
            "editTariff",
            tariff.id,
            tariff.title,
            GaltData.etherToWei(tariff.payment),
            tariff.paymentPeriod,
            tariff.mintForPeriods,
            tariff.currency == 'eth' ? "0" : "1",
            tariff.currency == 'eth' ? GaltData.nullAddress : tariff.currency);
    }
    
    async addMember(sendOptions, memberAddress, tariffId) {
        return this.sendMethod(
            sendOptions,
            "addParticipation",
            memberAddress,
            tariffId);
    }

    async changeMemberTariff(sendOptions, memberAddress, tariffId) {
        return this.sendMethod(
            sendOptions,
            "changeParticipationTariff",
            memberAddress,
            tariffId);
    }

    async deactivateTariff(sendOptions, tariff) {
        return this.sendMethod(
            sendOptions,
            "setTariffActive",
            tariff.id,
            false);
    }

    async activateTariff(sendOptions, tariff) {
        return this.sendMethod(
            sendOptions,
            "setTariffActive",
            tariff.id,
            true);
    }

    async kickMember(sendOptions, member) {
        return this.sendMethod(
            sendOptions,
            "kickParticipation",
            member.address);
    }

    async claimPaymentFor(sendOptions, memberAddress, periodsNumber = 1) {
        return this.sendMethod(
            sendOptions,
            "claimPayment",
            memberAddress,
            periodsNumber);
    }

    async mintTokens(sendOptions, tokenAddress, tokensAmount) {
        return this.sendMethod(
            sendOptions,
            "mintTokens",
            tokenAddress,
            GaltData.etherToWei(tokensAmount));
    }

    async getActiveTariffs(options = {}){
        return this.massCallMethod("getActiveTariffs")
            .then(async (tariffsIds) => {
                return this.getTariffsByIds(tariffsIds, options);
            });
    }
    
    async getAllTariffs(options = {}){
        return this.massCallMethod("getAllTariffs")
            .then(async (tariffsIds) => {
                return this.getTariffsByIds(tariffsIds, options);
            });
    }

    async getTariffsByIds(tariffsIds, params: any = {}){
        const applications = await pIteration.map(tariffsIds, async (applicationId) => {
            // try {
            return this.getTariffById(applicationId, params);
            // } catch (e) {
            // console.error(e);
            //     return {
            //         error: e
            //     };
            // }
        });
        return _.reverse(applications);
    }
    async getTariffById(tariffId, params: any = {}) {
        const tariff = await this.massCallMethod(params.method || "getTariff", [tariffId]);
        tariff.id = tariffId;
        tariff.payment = GaltData.weiToEther(tariff.payment);
        tariff.paymentPeriod = parseInt(tariff.paymentPeriod);
        
        this.tariffsCache[tariffId] = tariff;
        
        if(tariff.currency == "1") {
            tariff.currencyName = tariff.currencyAddress.toLowerCase() == GaltData.contractsConfig.coinTokenAddress.toLowerCase() ? 'yal' : tariff.currencyAddress;
        } else {
            tariff.currencyName = 'eth';
        }
        
        tariff.toLowerCase = tariff.toString = function(){
            return tariff.title;
        };
        return tariff;
    }
    
    async getTariffTitle(tariffId) {
        if(!this.tariffsCache[tariffId]) {
            await this.getTariffById(tariffId);
        }
        return this.tariffsCache[tariffId].title;
    }
    
    async getActiveMembersCount(){
        return this.massCallMethod("getActiveParticipantsCount");
    }

    async getActiveMembers(options = {}){
        return this.massCallMethod("getActiveParticipants")
            .then(async (membersAddresses) => {
                return this.getMembersByAddresses(membersAddresses, options);
            });
    }

    async getAllMembers(options = {}){
        return this.massCallMethod("getAllParticipants")
            .then(async (membersAddresses) => {
                return this.getMembersByAddresses(membersAddresses, options);
            });
    }

    async getMembersByAddresses(membersAddresses, params: any = {}){
        const applications = await pIteration.map(membersAddresses, async (memberId) => {
            // try {
            return this.getMember(memberId, params);
            // } catch (e) {
            // console.error(e);
            //     return {
            //         error: e
            //     };
            // }
        });
        return _.reverse(applications);
    }
    async getMember(memberAddress, params: any = {}) {
        if(!memberAddress) {
            return {};
        }
        const member = await this.massCallMethod(params.method || "getParticipantInfo", [memberAddress]);
        member.address = memberAddress;
        member.claimed = GaltData.weiToEtherRound(member.claimed);
        member.lastTimestamp = parseInt(member.lastTimestamp);
        member.tariffTitle = "";
        member.tariffObject = null;
        
        member.resolved = false;
        
        if(member.tariff == GaltData.nullBytes32) {
            member.tariff = null;
            member.resolved = true;
        } else {
            member.resolvePromise = this.getTariffTitle(member.tariff).then((title) => {
                member.tariffTitle = title;
                member.tariffObject = this.tariffsCache[member.tariff];
                member.resolved = true;
            });
        }
        
        return member;
    }
    
    async isMember(address) {
        return this.massCallMethod("participants", [address]);
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
    
    //
    // async exchangeGaltToEth(sendOptions, galtAmount) {
    //     return this.sendMethod(sendOptions, 'exchangeGaltToEth', GaltData.etherToWei(galtAmount));
    // }
    //
    // async hasRole(userWallet, role) {
    //     return this.massCallMethod('hasRole', [userWallet, role]);
    // }
    //
    // async withdrawEthFee(sendOptions) {
    //     return this.sendMethod(sendOptions, 'withdrawEthFee');
    // }
    //
    // async withdrawGaltFee(sendOptions) {
    //     return this.sendMethod(sendOptions, 'withdrawGaltFee');
    // }
    //
    // async setFee(sendOptions, currency, amount) {
    //     return this.sendMethod(sendOptions, "set" + GaltData.upperFirst(currency.toLowerCase()) + "Fee", GaltData.szaboToWei(amount));
    // }
}
