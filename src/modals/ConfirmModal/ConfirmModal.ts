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
    template: require('./ConfirmModal.html'),
    props: ['title'],
    components: {
        ModalItem
    },
    created() {

    },
    methods: {
        ok() {
            this.$root.$asyncModal.close('confirm-modal', true);
        },
        cancel() {
            this.$root.$asyncModal.close('confirm-modal');
        }
    },
    watch: {},
    data: function () {
        return {

        }
    }
}
