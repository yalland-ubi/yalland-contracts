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
import EditTariffModal from "./modals/EditTariffModal/EditTariffModal";

export default {
    name: 'admin-validators-roles',
    template: require('./AdminTariffs.html'),
    props: [],
    async mounted() {
        this.getValidatorsRoles();
        // this.applicationsTypes = await this.$locale.setTitlesByNamesInList(GaltData.getApplicationsTypesList(), "application_contracts_types.");
    },
    watch: {
        applicationTypeName() {
            this.getValidatorsRoles();
        }
    },
    methods: {
        async getValidatorsRoles(){
            this.tariffs = await this.$cityContract.getAllTariffs();
        },
        addTariff(){
            this.$root.$asyncModal.open({
                id: 'edit-tariff-modal',
                component: EditTariffModal,
                props: {
                    tariff: {}
                },
                onClose: (resultValidator) => {
                    this.getValidatorsRoles();
                }
            });
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    data() {
        return {
            localeKey: 'admin.tariffs',
            tariffs: []
        }
    }
}
