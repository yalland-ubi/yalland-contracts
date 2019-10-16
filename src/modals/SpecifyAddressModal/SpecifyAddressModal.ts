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
    template: require('./SpecifyAddressModal.html'),
    props: ['contract', 'method', 'subject', 'locale'],
    components: {
        ModalItem
    },
    created() {

    },
    methods: {
        ok() {
            this.$root.$asyncModal.close('specify-address-modal', this.address);
        },
        cancel() {
            this.$root.$asyncModal.close('specify-address-modal');
        }
    },
    watch: {},
    data: function () {
        return {
            address: null
        }
    }
}
