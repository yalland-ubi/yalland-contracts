/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import Vue from 'vue';
import * as Vuex from 'vuex';

Vue.use(Vuex as any);

export default new Vuex.Store({
    state: {
        locale: null,
        locale_loaded: false,
        user_wallet: null,
        is_rate_manager: false,
        is_member_join_manager: false,
        is_member_leave_manager: false,
        is_fee_manager: false,
        is_role_manager: false,
        is_migrate_manager: false,
        user_eth_balance: null,
        user_space_balance: null,
        user_coin_balance: null,

        internal_wallet: null,
        internal_wallet_active: null,
        internal_wallet_eth_balance: null,
        internal_wallet_galt_balance: null,
        internal_wallet_space_balance: null
    },
    mutations: {
        locale(state, locale) {
            state.locale = locale;
        },
        locale_loaded(state, locale_loaded) {
            state.locale_loaded = locale_loaded;
        },
        user_wallet(state, user_wallet) {
            state.user_wallet = user_wallet;
        },
        user_eth_balance(state, user_eth_balance) {
            state.user_eth_balance = user_eth_balance;
        },
        user_space_balance(state, user_space_balance) {
            state.user_space_balance = user_space_balance;
        },
        user_coin_balance(state, user_coin_balance) {
            state.user_coin_balance = user_coin_balance;
        },
        is_rate_manager(state, is_rate_manager) {
            state.is_rate_manager = is_rate_manager;
        },
        is_migrate_manager(state, is_migrate_manager) {
            state.is_migrate_manager = is_migrate_manager;
        },
        is_member_join_manager(state, is_member_join_manager) {
            state.is_member_join_manager = is_member_join_manager;
        },
        is_member_leave_manager(state, is_member_leave_manager) {
            state.is_member_leave_manager = is_member_leave_manager;
        },
        is_fee_manager(state, is_fee_manager) {
            state.is_fee_manager = is_fee_manager;
        },

        internal_wallet(state, internal_wallet) {
            state.internal_wallet = internal_wallet;
        },
        internal_wallet_active(state, internal_wallet_active) {
            state.internal_wallet_active = internal_wallet_active;
        },
        internal_wallet_eth_balance(state, internal_wallet_eth_balance) {
            state.internal_wallet_eth_balance = internal_wallet_eth_balance;
        },
        internal_wallet_galt_balance(state, internal_wallet_galt_balance) {
            state.internal_wallet_galt_balance = internal_wallet_galt_balance;
        },
        internal_wallet_space_balance(state, internal_wallet_space_balance) {
            state.internal_wallet_space_balance = internal_wallet_space_balance;
        }
    }
});
