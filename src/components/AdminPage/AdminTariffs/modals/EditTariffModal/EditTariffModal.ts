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

import {ModalItem} from '../../../../../directives/AsyncModal/index'
import GaltData from "../../../../../services/galtData";
const _ = require('lodash');

export default {
    template: require('./EditTariffModal.html'),
    props: ['applicationTypeName'],
    components: {
        ModalItem
    },
    created() {
        this.getValidatorsRoles();
    },
    methods: {
        getCurrencies() {
            this.currencies = _.map(this.$locale.get('currency'), (currencyTitle, currencyName) => {
                return {
                    name: currencyTitle,
                    address: currencyName == 'galt' ? this.$galtTokenContract.address : currencyName,
                    toString: function () {
                        return this.name ? this.name + "(" + this.address + ")" : this.address;
                    },
                    toLowerCase: function () {
                        return this.toString();
                    }
                };
            });
            return this.currencies;
        },
        ok() {
            this.saving = true;
            
            this.$galtUser.setApplicationRoles(this.validatorsRoles, this.applicationTypeName)
                .then(() => {
                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.save.title"),
                        text: this.getLocale("success.save.description")
                    });
                    this.$root.$asyncModal.close('edit-roles-modal', this.validatorsRoles);
                })
                .catch((e) => {
                    console.error(e);
                    
                    this.$notify({
                        type: 'error',
                        title: this.getLocale("error.save.title"),
                        text: this.getLocale("error.save.description")
                    });
                    this.saving = false;
                })
        },
        cancel() {
            this.$root.$asyncModal.close('edit-roles-modal');
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    computed: {
        deleteDisabled(){
            return this.deleted || this.deleting;
        },
        saveDisabled(){
            return !this.deleted || this.saving || !this.validatorsRoles.length || this.validatorsRoles.some((role) => !role.rewardShare) || this.validatorsRoles.some((role) => !role.name) || this.shareSumNot100;
        },
        shareSumNot100(){
            let sum = 0;
            this.validatorsRoles.forEach((role) => {
                sum += parseInt(role.rewardShare);
            });
            return sum != 100;
        }
    },
    watch: {},
    data: function () {
        return {
            localeKey: 'admin.validators_roles.edit_roles',
            validatorsRoles: [],
            deleted: false,
            deleting: false,
            saving: false
        }
    }
}
