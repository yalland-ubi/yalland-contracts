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
    props: ['tariff'],
    components: {
        ModalItem
    },
    created() {
        this.editTariff = _.clone(this.tariff);
    },
    methods: {
        getCurrencies() {
            this.currencies = _.map(this.$locale.get('currency'), (currencyTitle, currencyName) => {
                return {
                    name: currencyTitle,
                    address: currencyName == 'coin' ? this.$coinTokenContract.address : currencyName,
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
            
            const promise = this.editTariff.id ? this.$galtUser.editTariff(this.editTariff) : this.$galtUser.createTariff(this.editTariff);

            promise
                .then(() => {
                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.save.title"),
                        text: this.getLocale("success.save.description")
                    });
                    this.$root.$asyncModal.close('edit-tariff-modal');
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
            this.$root.$asyncModal.close('edit-tariff-modal');
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    computed: {
        saveDisabled(){
            return this.saving || !this.editTariff.title || !this.editTariff.paymentPeriod || !this.editTariff.payment || !this.editTariff.currency;
        }
    },
    watch: {},
    data: function () {
        return {
            localeKey: 'admin.tariffs.edit_tariff',
            currencies: [],
            editTariff: null,
            deleted: false,
            deleting: false,
            saving: false
        }
    }
}
