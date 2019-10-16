/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "../../../services/galtData";
import EditTariffModal from "./modals/EditTariffModal/EditTariffModal";
import {EventBus, TARIFF_UPDATE} from "../../../services/events";

export default {
    name: 'admin-validators-roles',
    template: require('./AdminTariffs.html'),
    props: [],
    async mounted() {
        this.getTariffs();
        // this.applicationsTypes = await this.$locale.setTitlesByNamesInList(GaltData.getApplicationsTypesList(), "application_contracts_types.");
    },
    watch: {
        applicationTypeName() {
            this.getTariffs();
        }
    },
    methods: {
        async getTariffs(){
            this.tariffs = await this.$cityContract.getAllTariffs();
        },
        editTariff(tariff){
            this.$root.$asyncModal.open({
                id: 'edit-tariff-modal',
                component: EditTariffModal,
                props: {
                    tariff: tariff
                },
                onClose: (resultValidator) => {
                    this.getTariffs();
                    EventBus.$emit(TARIFF_UPDATE);
                }
            });
        }, 
        activateTariff(tariff) {
            GaltData.confirmModal({
                title: this.$locale.get(this.localeKey + '.activate_confirm')
            }).then(async () => {
                await this.$galtUser.activateTariff(tariff);
                this.getTariffs();
                EventBus.$emit(TARIFF_UPDATE);
                
                this.$notify({
                    type: 'success',
                    title: this.getLocale("success.activate.title"),
                    text: this.getLocale("success.activate.description")
                });
            })
        },
        deactivateTariff(tariff) {
            GaltData.confirmModal({
                title: this.$locale.get(this.localeKey + '.deactivate_confirm')
            }).then(async () => {
                await this.$galtUser.deactivateTariff(tariff);
                this.getTariffs();
                EventBus.$emit(TARIFF_UPDATE);
                
                this.$notify({
                    type: 'success',
                    title: this.getLocale("success.deactivate.title"),
                    text: this.getLocale("success.deactivate.description")
                });
            })
        },
        addTariff(){
            this.$root.$asyncModal.open({
                id: 'edit-tariff-modal',
                component: EditTariffModal,
                props: {
                    tariff: {}
                },
                onClose: (resultValidator) => {
                    this.getTariffs();
                    EventBus.$emit(TARIFF_UPDATE);
                }
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
        }
    },
    data() {
        return {
            localeKey: 'admin.tariffs',
            tariffs: []
        }
    }
}
