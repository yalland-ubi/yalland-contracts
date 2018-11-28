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
    name: 'general-info',
    template: require('./GeneralInfo.html'),
    props: ['userWallet'],
    async mounted() {
        this.$store.watch(
            (state) => state.user_wallet,
            (user_wallet) => this.getGeneralInfo());
        
        this.getGeneralInfo();

        const interval = setInterval(async () => {
            this.getGeneralInfo();
        }, 10000);
        
        this.intervals.push(interval);
    },
    beforeDestroy() {
        this.intervals.forEach(intervalId => clearInterval(intervalId));
    },
    watch: {
        
    },
    methods: {
        async getGeneralInfo() {
            GaltData.ethBalance(this.userWallet).then(ethBalance => {
                this.ethBalance = ethBalance;
            });
            this.$coinTokenContract.balanceOf(this.userWallet).then(galtBalance => {
                this.coinBalance = galtBalance;
            });
            this.participant = await this.$cityContract.isMember(this.userWallet);
        }
    },
    data() {
        return {
            localeKey: 'personal_cabinet.general_info',
            intervals: [],
            ethBalance: null,
            coinBalance: null,
            participant: null
        }
    }
}
