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
        this.getCurrencies();
        
        this.editTariff = _.clone(this.tariff);

        this.periodUnits = [
            {value: 'hours', name: this.getLocale('payment_period.unit_hours')},
            {value: 'days', name: this.getLocale('payment_period.unit_days')}
        ];
        
        if(this.editTariff.id) {
            if(this.editTariff.currency == 0) {
                this.editTariff.currency = this.currencies[0];
            } else {
                this.editTariff.currency = _.find(this.currencies, (currency) => {
                    return currency.address.toLowerCase() === this.editTariff.currencyAddress.toLowerCase();
                });
            }

            if(this.tariff.paymentPeriod >= this.dayUnit) {
                this.editTariff.paymentPeriodUnit = 'days';
                this.editTariff.paymentPeriod /= this.dayUnit;
            } else {
                this.editTariff.paymentPeriodUnit = 'hours';
                this.editTariff.paymentPeriod /= this.hourUnit;
            }
        }
    },
    methods: {
        getCurrencies() {
            this.currencies = _.map(this.$locale.get('currency'), (currencyTitle, currencyName) => {
                return {
                    name: currencyTitle,
                    address: currencyName == 'yal' ? this.$coinTokenContract.address : currencyName,
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
            
            const tariffToSave = {
                id: this.editTariff.id,
                title: this.editTariff.title,
                payment: this.editTariff.payment,
                mintForPeriods: this.editTariff.mintForPeriods || 0,
                paymentPeriod: this.editTariff.paymentPeriodUnit == 'days' ? this.editTariff.paymentPeriod * this.dayUnit : this.editTariff.paymentPeriod * this.hourUnit,
                currency: this.editTariff.currency
            };
            
            const promise = this.editTariff.id ? this.$galtUser.editTariff(tariffToSave) : this.$galtUser.createTariff(tariffToSave);

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
            return this.saving || !this.editTariff.title || !this.editTariff.paymentPeriod || !this.editTariff.payment || !this.editTariff.currency || (this.editTariff.currency.address !== 'eth' && !this.editTariff.mintForPeriods);
        }
    },
    watch: {},
    data: function () {
        return {
            localeKey: 'admin.tariffs.edit_tariff',
            currencies: [],
            periodUnits: [],
            dayUnit: 60 * 60 * 24,
            hourUnit: 60 * 60,
            editTariff: null,
            deleted: false,
            deleting: false,
            saving: false
        }
    }
}
