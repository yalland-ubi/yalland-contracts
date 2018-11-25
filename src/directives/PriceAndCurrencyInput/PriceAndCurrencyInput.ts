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

import * as _ from 'lodash';
import GaltData from "../../services/galtData";

export default {
    name: 'price-and-currency-input',
    template: require('./PriceAndCurrencyInput.html'),
    props: ['value', 'disabled', 'invalidPrice', 'label'],
    async created(){
        this.$set(this.value, 'priceCurrency', 'eth');
        this.$set(this.value, 'price', 0);
        
        this.changePrice();
        
        this.onLoadId = this.$locale.onLoad(() => {
            this.getCurrencies();
        });
    },

    beforeDestroy() {
        this.$locale.unbindOnLoad(this.onLoadId);
    },
    methods: {
        changePrice() {
            this.$emit('input', this.value);
            this.$emit('change', this.value);
            
            this.$emit('update:invalidPrice', !this.value.price);
        },
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
        }
    },
    watch: {
        'selectedCurrency': async function(){
            this.value.priceCurrency = this.selectedCurrency.address || this.selectedCurrency;
            this.changePrice();
        }
    },
    data() {
        return {
            localeKey: 'price_and_currency_input',
            onLoadId: null,
            currencies: [],
            selectedCurrency: null
        }
    }
}
