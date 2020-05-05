/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "../../../services/galtData";

export default {
    name: 'admin-exchange',
    template: require('./AdminExchange.html'),
    props: [],
    async mounted() {
        const interval = setInterval(() => {
            this.getExchangeData();
        }, 60 * 1000);

        this.intervals.push(interval);
        await this.$yalExchangeContract.onReady();
        this.exchangeAddress = this.$yalExchangeContract.address;
        this.getExchangeData();
    },
    beforeDestroy() {
        this.intervals.forEach(intervalId => clearInterval(intervalId));
    },
    watch: {
        
    },
    methods: {
        async getExchangeData() {
            this.data = {
                totalExchanged: await this.$yalExchangeContract.totalExchangedYal(),
                exchangeBalance: await this.$coinTokenContract.balanceOf(this.$yalExchangeContract.address),
                defaultExchangeRate: await this.$yalExchangeContract.defaultExchangeRate(),
                defaultMemberPeriodLimit: await this.$yalExchangeContract.defaultMemberPeriodLimit(),
                totalPeriodLimit: await this.$yalExchangeContract.totalPeriodLimit()
            };
        },
        async editSetting(settingName, value) {
            GaltData.specifyAmountModal({
                title: this.getLocale(`edit_setting.${settingName}.title`),
                placeholder: this.getLocale(`edit_setting.${settingName}.placeholder`),
                defaultValue: value
            }).then(async (amount: any) => {
                await this.$galtUser.sendExchangeMethod(settingName, [amount]).then(() => {
                    setTimeout(() => {
                        this.getExchangeData();
                    }, 10 * 1000);

                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.edit_setting.title"),
                        text: this.getLocale("success.edit_setting.description")
                    });
                }).catch((e) => {
                    this.$notify({
                        type: 'error',
                        title: this.getLocale("error.edit_setting.title"),
                        text: this.getLocale("error.edit_setting.description", {message: e && e.message ? e.message : e})
                    });
                });
            }).catch(() => {});
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    computed: {
        is_exchange_manager() {
            return this.$store.state.is_exchange_manager;
        }
    },
    data() {
        return {
            localeKey: 'admin.exchange',
            intervals: [],
            exchangeAddress: null,
            data: null,
            dataItems: [
                {name: 'totalExchanged', setting: null, unit: 'YAL'},
                {name: 'exchangeBalance', setting: null, unit: 'YAL'},
                {name: 'defaultExchangeRate', setting: 'setDefaultExchangeRate', unit: 'руб за YAL'},
                {name: 'defaultMemberPeriodLimit', setting: 'setDefaultMemberPeriodLimit', unit: 'YAL'},
                {name: 'totalPeriodLimit', setting: 'setTotalPeriodLimit', unit: 'YAL'}
            ]
        }
    }
}
