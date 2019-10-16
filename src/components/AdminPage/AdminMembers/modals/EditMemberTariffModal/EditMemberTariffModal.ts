/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import {ModalItem} from '../../../../../directives/AsyncModal/index'
import GaltData from "../../../../../services/galtData";
const _ = require('lodash');

export default {
    template: require('./EditMemberTariffModal.html'),
    props: ['memberAddress'],
    components: {
        ModalItem
    },
    async created() {
        await this.getTariffs();
        this.$cityContract.getMember(this.memberAddress)
            .then((member) => {
                this.tariff = _.find(this.tariffs, {id: member.tariff});
            });
    },
    methods: {
        async getTariffs() {
            this.tariffs = await this.$cityContract.getActiveTariffs();
            return this.tariffs;
        },
        ok() {
            this.saving = true;
            
            this.$galtUser.changeMemberTariff(this.memberAddress, this.tariff.id)
                .then(() => {
                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.save.title"),
                        text: this.getLocale("success.save.description")
                    });
                    this.$root.$asyncModal.close('edit-member-tariff-modal', {
                        address: this.memberAddress,
                        tariff: this.tariff
                    });
                })
                .catch((e) => {
                    console.error(e);
                    
                    this.$notify({
                        type: 'error',
                        title: this.getLocale("error.save.title"),
                        text: this.getLocale("error.save.description")
                    });
                    this.saving = false;
                })
        },
        cancel() {
            this.$root.$asyncModal.close('edit-member-tariff-modal');
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    computed: {
        saveDisabled(){
            return this.saving || !this.tariff;
        }
    },
    watch: {},
    data: function () {
        return {
            localeKey: 'admin.members.edit_member_tariff',
            tariff: null,
            tariffs: [],
            saving: false
        }
    }
}
