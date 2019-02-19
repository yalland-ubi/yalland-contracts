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
import MemberPayout from "../../../directives/MemberPayout/MemberPayout";

export default {
    name: 'tariff-info',
    template: require('./TariffInfo.html'),
    components: {MemberPayout},
    props: ['userWallet'],
    async mounted() {
        this.$store.watch(
            (state) => state.user_wallet,
            (user_wallet) => this.getTariffInfo());
        
        this.getTariffInfo();
    },
    watch: {
        
    },
    methods: {
        async getTariffInfo() {
            const member = await this.$cityContract.getMember(this.userWallet);
            if(!member.active) {
                this.tariff = null;
                return;
            }
            if(!member.tariff) {
                this.tariff = null;
                this.nextPayment = null;
                return;
            }
            this.tariff = await this.$cityContract.getTariffById(member.tariff);

            const currentTimeStamp = Math.floor(Date.now() / 1000);
            const availableCount = Math.floor((currentTimeStamp - member.lastTimestamp) / this.tariff.paymentPeriod);
            this.nextPayment = new Date((member.lastTimestamp + (availableCount + 1) * this.tariff.paymentPeriod) * 1000);
        }
    },
    data() {
        return {
            localeKey: 'personal_cabinet.tariff_info',
            tariff: null,
            nextPayment: null
        }
    }
}
