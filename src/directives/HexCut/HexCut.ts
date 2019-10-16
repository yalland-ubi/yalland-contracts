/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "../../services/galtData";

export default {
    name: 'hex-cut',
    template: require('./HexCut.html'),
    props: ['hex', 'to'],
    created() {
        this.cutHex();
    },
    watch: {
        async hex() {
            this.cutHex();
        }
    },
    methods: {
        cutHex(){
            if(!this.hex) {
                this.hexCut = "";
                return;
            }
            this.hexCut = this.hex.slice(0, 7) + "..." + this.hex.slice(-4);
        },
        copyToClipboard() {
            GaltData.copyToClipboard(this.hex);

            this.$notify({
                type: 'success',
                title: this.$locale.get('hex_cut.address_copied_to_clipboard')
            });
        }
    },
    data() {
        return {
            hexCut: null
        }
    }
}
