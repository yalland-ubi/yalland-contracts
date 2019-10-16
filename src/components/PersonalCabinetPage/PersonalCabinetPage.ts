/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GeneralInfo from "./GeneralInfo/GeneralInfo";
import TariffInfo from "./TariffInfo/TariffInfo";

export default {
    name: 'personal-cabinet-page',
    template: require('./PersonalCabinetPage.html'),
    components: {GeneralInfo, TariffInfo},
    async created() {
        this.getMemberInfo();
    },
    mounted() {
        
    },
    beforeDestroy() {
        this.intervals.forEach(intervalId => clearInterval(intervalId));
    },
    methods: {
        async getMemberInfo() {
            if(!this.user_wallet) {
                this.memberInfo = null;
                return;
            }
            this.memberInfo = await this.$cityContract.getMember(this.user_wallet);
        }
    },
    watch: {
        async user_wallet() {
            this.getMemberInfo();
        }
    },
    data() {
        return {
            localeKey: 'personal_cabinet',
            intervals: [],
            memberInfo: null
        };
    },
    computed: {
        user_wallet() {
            return this.$store.state.user_wallet;
        },
        is_galt_dex_fee_manager() {
            return this.$store.state.is_galt_dex_fee_manager;
        },
        is_plot_manager_fee_manager() {
            return this.$store.state.is_plot_manager_fee_manager;
        }
    },
}
