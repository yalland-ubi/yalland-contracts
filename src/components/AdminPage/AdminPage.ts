/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
