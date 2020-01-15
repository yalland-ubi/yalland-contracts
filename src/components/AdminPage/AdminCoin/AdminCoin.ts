/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "../../../services/galtData";
import SpecifyAmountModal from "../../../modals/SpecifyAmountModal/SpecifyAmountModal";
import MigrateBalancesModal from "../../../modals/MigrateBalancesModal/MigrateBalancesModal";

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
        
        await this.$coinTokenContract.onReady();
        this.tokenAddress = this.$coinTokenContract.address;
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
        async editFee() {
            GaltData.specifyAmountModal({
                title: this.getLocale("edit_fee.title"),
                placeholder: this.getLocale("edit_fee.placeholder"),
                defaultValue: this.transferFee
            }).then(async (amount: any) => {
                await this.$galtUser.setCoinTransferFee(amount).then(() => {
                    this.getCoinData();

                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.edit_fee.title"),
                        text: this.getLocale("success.edit_fee.description", {value: amount})
                    });
                }).catch(() => {
                    this.$notify({
                        type: 'error',
                        title: this.getLocale("error.edit_fee.title"),
                        text: this.getLocale("error.edit_fee.description", {value: amount})
                    });
                });
            });
        },
        async mintCoin() {
            GaltData.specifyAmountModal({
                title: this.getLocale("mint_coin.title"),
                placeholder: this.getLocale("mint_coin.placeholder"),
                defaultValue: 0
            }).then(async (amount: any) => {
                await this.$galtUser.mintCoinToCity(amount).then(() => {
                    this.getCoinData();

                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.mint_coin.title"),
                        text: this.getLocale("success.mint_coin.description", {value: amount})
                    });
                }).catch(() => {
                    this.$notify({
                        type: 'error',
                        title: this.getLocale("error.mint_coin.title"),
                        text: this.getLocale("error.mint_coin.description", {value: amount})
                    });
                });
                
            });
        },
        migrateBalances() {
            this.$root.$asyncModal.open({
                id: 'migrate-balances-modal',
                component: MigrateBalancesModal
            });
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    computed: {
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
        is_migrate_manager() {
            return this.$store.state.is_migrate_manager;
        }
    },
    data() {
        return {
            localeKey: 'admin.coin',
            intervals: [],
            tokenAddress: null,
            totalSupply: null,
            cityBalance: null,
            transferFee: null,
            feePayout: null
        }
    }
}
