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
    template: require('./EditMemberTariffModal.html'),
    props: ['validatorAddress'],
    components: {
        ModalItem
    },
    created() {
        if(this.validatorAddress) {
            this.resultValidator.address = this.validatorAddress;

            this.$cityContract.getMember(this.validatorAddress)
                .then((validator) => {
                    if(!validator.roles.length) {
                        this.addressDisabled = false;
                        return;
                    }
                    this.resultValidator = validator;
                })
                .catch(() => {
                    this.addressDisabled = false;
                })
        }
        
        this.getApplicationRoles();
    },
    methods: {
        async getApplicationRoles() {
            const rolesNames = await this.$galtUser.getApplicationRoles();
            this.applicationRoles = await this.$locale.setTitlesByNamesInList(rolesNames.map((role) => {return {name: role}}), 'admin_validation_roles.');
        },
        ok() {
            this.saving = true;
            
            this.$galtUser.editValidator(this.resultValidator)
                .then(() => {
                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.save.title"),
                        text: this.getLocale("success.save.description")
                    });
                    this.$root.$asyncModal.close('edit-validator-modal', this.resultValidator);
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
            this.$root.$asyncModal.close('edit-validator-modal');
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    computed: {
        saveDisabled(){
            return this.saving || !this.resultValidator.address || !this.resultValidator.position || !this.resultValidator.roles.length || this.resultValidator.roles.some((role) => !role);
        }
    },
    watch: {},
    data: function () {
        return {
            localeKey: 'admin.validators.edit_validator',
            resultValidator: {
                address: "",
                name: "",
                position: "",
                descriptionHashes: [],
                roles: [],
            },
            applicationRoles: [],
            saving: false
        }
    }
}
