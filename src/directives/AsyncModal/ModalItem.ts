/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

export default {
    name: 'modal-item',
    template: require('./ModalItem.html'),
    props: {
        id: [Number, String],
        header: String,
        footer: Boolean,
        disabled: Boolean,
        confirmText: String,
        cancelText: String,
        transition: {
            type: String,
            default: 'fade'
        }
    },
    methods: {
        closeModal() {
            this.$modal.close()
        },
        confirmModal() {
            if (this.disabled)
                return;
            this.$emit('confirm')
        }
    }
}
