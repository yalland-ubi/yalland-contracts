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

import AdminMembers from "./AdminMembers/AdminMembers";
import AdminTariffs from "./AdminTariffs/AdminTariffs";
import AdminCoin from "./AdminCoin/AdminCoin";

export default {
    name: 'admin-page',
    template: require('./AdminPage.html'),
    components: {AdminMembers, AdminTariffs, AdminCoin},
    created() {

    },
    mounted() {
        
    },
    beforeDestroy() {
        this.intervals.forEach(intervalId => clearInterval(intervalId));
    },
    methods: {
        
    },
    watch: {
        
    },
    data() {
        return {
            intervals: []
        };
    },
    computed: {
        user_wallet() {
            return this.$store.state.user_wallet;
        },
        is_city_manager() {
            return this.is_fee_manager || this.is_rate_manager || this.is_member_join_manager || this.is_member_leave_manager;
        },
        is_fee_manager() {
            return this.$store.state.is_fee_manager;
        },
        is_rate_manager() {
            return this.$store.state.is_rate_manager;
        },
        is_member_join_manager() {
            return this.$store.state.is_member_join_manager;
        },
        is_member_leave_manager() {
            return this.$store.state.is_member_leave_manager;
        },
    },
}
