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

import GaltData from "../../../services/galtData";

export default {
    name: 'admin-galt',
    template: require('./AdminCoin.html'),
    props: [],
    async mounted() {
        const interval = setInterval(() => {
            this.getCoinData();
        }, 10000);

        this.intervals.push(interval);
        this.getCoinData();
    },
    beforeDestroy() {
        this.intervals.forEach(intervalId => clearInterval(intervalId));
    },
    watch: {
        
    },
    methods: {
        async getCoinData() {
            this.totalSupply = await this.$coinTokenContract.totalSupply();
            this.cityBalance = await this.$coinTokenContract.balanceOf(this.$cityContract.address);
            this.transferFee = await this.$coinTokenContract.transferFee();
            this.feePayout = await this.$coinTokenContract.feePayout();
        },
        async withdrawFee() {
            await this.$galtUser.withdrawCoinFee();

            this.$notify({
                type: 'success',
                title: this.getLocale("success.fee_payout.title"),
                text: this.getLocale("success.fee_payout.description", {value: this.feePayout})
            });
        },
        async editFee(currency) {
            GaltData.specifyAmountModal({
                title: this.getLocale("edit_fee.title"),
                placeholder: this.getLocale("edit_fee.placeholder"),
                defaultValue: this.transferFee
            }).then(async (amount: any) => {
                this.$galtUser.setCoinTransferFee(amount).then(this.getCoinData);
            });
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    data() {
        return {
            localeKey: 'admin.coin',
            intervals: [],
            totalSupply: null,
            cityBalance: null,
            transferFee: null,
            feePayout: null
        }
    }
}
