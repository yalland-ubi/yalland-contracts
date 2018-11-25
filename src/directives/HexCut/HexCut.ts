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