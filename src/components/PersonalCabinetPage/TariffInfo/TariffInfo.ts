/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "../../../services/galtData";
import MemberPayout from "../../../directives/MemberPayout/MemberPayout";

export default {
    name: 'tariff-info',
    template: require('./TariffInfo.html'),
    components: {MemberPayout},
    props: ['userWallet', 'tariffId'],
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
            if(!this.tariffId) {
                return;
            }
            const memberTariff = await this.$cityContract.getMemberTariff(this.userWallet, this.tariffId);
            if(!memberTariff.active) {
                this.tariff = null;
                return;
            }
            this.tariff = await this.$cityContract.getTariffById(this.tariffId);

            const currentTimeStamp = Math.floor(Date.now() / 1000);
            const availableCount = Math.floor((currentTimeStamp - memberTariff.lastTimestamp) / this.tariff.paymentPeriod);
            this.nextPayment = new Date((memberTariff.lastTimestamp + (availableCount + 1) * this.tariff.paymentPeriod) * 1000);
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
