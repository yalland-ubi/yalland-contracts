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
    template: require('./SpecifyPrecisionModal.html'),
    props: ['precision'],
    components: {
        ModalItem
    },
    created() {
        this.newPrecision = this.precision;
    },
    methods: {
        ok() {
            this.$root.$asyncModal.close('specify-precision-modal', this.newPrecision);
        },
        cancel() {
            this.$root.$asyncModal.close('specify-precision-modal');
        }
    },
    watch: {},
    data: function () {
        return {
            newPrecision: null
        }
    }
}
