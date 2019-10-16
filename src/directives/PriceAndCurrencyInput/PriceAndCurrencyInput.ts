/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
