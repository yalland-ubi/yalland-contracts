/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import {ModalItem} from '../../directives/AsyncModal'

export default {
    template: require('./SpecifyAmountModal.html'),
    props: ['title', 'placeholder', 'defaultValue'],
    components: {
        ModalItem
    },
    created() {
        this.amount = this.defaultValue;
    },
    methods: {
        ok() {
            this.$root.$asyncModal.close('specify-amount-modal', this.amount);
        },
        cancel() {
            this.$root.$asyncModal.close('specify-amount-modal');
        }
    },
    watch: {},
    data: function () {
        return {
            amount: null
        }
    }
}
