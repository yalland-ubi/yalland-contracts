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

import GaltData from "../../../services/galtData";
import EditMemberTariffModal from "./modals/EditMemberTariffModal/EditMemberTariffModal";
const _ = require('lodash');

export default {
    name: 'admin-members',
    template: require('./AdminMembers.html'),
    props: [],
    mounted() {
        this.getAllMembers();
    },
    watch: {
        
    },
    methods: {
        async getAllMembers(){
            this.members = await this.$cityContract.getAllMembers();
            this.filteredMembers = this.members;
        },
        fetchMemberToFind(){
            if(!this.memberToFind) {
                return;
            }
            this.$cityContract.getMember(this.memberToFind)
                .then((member) => {
                    if(!member.roles.length) {
                        this.memberNotFound = true;
                        return;
                    }
                    this.members.push(member);
                    this.findMember();
                })
                .catch(() => {
                    this.memberError = true;
                })
        },
        updateMemberInfo(memberAddress) {
            this.members.some(member => {
                if(member.address == memberAddress) {
                    this.$cityContract.getMember(member.address)
                        .then((getMember) => { _.extend(member, getMember); })
                        .catch(() => {})
                }
                return member.address == memberAddress;
            })
        },
        editMember(memberAddress?){
            if(!memberAddress && this.memberNotFound) {
                memberAddress = this.memberToFind;
            }
            
            // this.$root.$asyncModal.open({
            //     id: 'edit-member-tariff-modal',
            //     component: EditMemberTariffModal,
            //     props: {
            //         memberAddress: memberAddress,
            //     },
            //     onClose: (resultMember) => {
            //         if(!resultMember) {
            //             return;
            //         }
            //         this.updateMemberInfo(resultMember.address);
            //     }
            // });
        },
        deactivateMember(memberAddress){
            this.$galtUser.deactivateMember(memberAddress)
                .then(() => {
                    this.updateMemberInfo(memberAddress);
                    
                    this.$notify({
                        type: 'success',
                        title: this.getLocale("success.deactivate.title"),
                        text: this.getLocale("success.deactivate.description")
                    });
                })
                .catch((e) => {
                    console.error(e);
                    
                    this.$notify({
                        type: 'error',
                        title: this.getLocale("error.deactivate.title"),
                        text: this.getLocale("error.deactivate.description")
                    });
                })
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    data() {
        return {
            memberToFind: "",
            members: [],
            filteredMembers: [],
            localeKey: 'admin.members',
            memberForChangeStatus: null,
            memberInfo: null,
            memberNotFound: false,
            memberError: false
        }
    }
}
