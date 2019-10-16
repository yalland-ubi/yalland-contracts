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
    template: require('./SpecifySelectOptionModal.html'),
    props: ['title', 'placeholder', 'titleValueList', 'defaultValue'],
    components: {
        ModalItem
    },
    created() {
        this.selected = this.defaultValue;
    },
    methods: {
        ok() {
            this.$root.$asyncModal.close('specify-select-option-modal', this.selected);
        },
        cancel() {
            this.$root.$asyncModal.close('specify-select-option-modal');
        }
    },
    watch: {},
    data: function () {
        return {
            selected: null
        }
    }
}
