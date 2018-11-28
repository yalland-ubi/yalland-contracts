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
import AddMemberModal from "./modals/AddMemberModal/AddMemberModal";
import MemberPayout from "../../../directives/MemberPayout/MemberPayout";
const _ = require('lodash');

export default {
    name: 'admin-members',
    template: require('./AdminMembers.html'),
    components: { MemberPayout },
    props: [],
    mounted() {
        this.getAllMembers();
    },
    watch: {
        
    },
    methods: {
        async getAllMembers(){
            this.members = await this.$cityContract.getActiveMembers();
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
        editMember(member){
            this.$root.$asyncModal.open({
                id: 'edit-member-tariff-modal',
                component: EditMemberTariffModal,
                props: {
                    memberAddress: member.address,
                },
                onClose: (resultMember) => {
                    if(!resultMember) {
                        return;
                    }
                    this.updateMemberInfo(resultMember.address);
                }
            });
        },
        addMember(){
            let memberAddress = null;
            if(this.memberToFind && this.memberNotFound) {
                memberAddress = this.memberToFind;
            }

            this.$root.$asyncModal.open({
                id: 'add-member-modal',
                component: AddMemberModal,
                props: {
                    memberAddress: memberAddress,
                },
                onClose: (resultMember) => {
                    if(!resultMember) {
                        return;
                    }
                    this.getAllMembers();
                }
            });
        },
        kickMember(member){
            GaltData.confirmModal({
                title: this.$locale.get(this.localeKey + '.deactivate_confirm')
            }).then(() => {
                
                this.$galtUser.kickMember(member)
                    .then(() => {
                        this.getAllMembers();

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
            })
            
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    computed: {
        filteredMembers() {
            return this.members.filter((member) => {
                return member.address.indexOf(this.memberToFind) != -1 || member.tariffTitle.toLowerCase().indexOf(this.memberToFind.toLowerCase()) != -1;
            });
        }
    },
    data() {
        return {
            memberToFind: "",
            members: [],
            localeKey: 'admin.members',
            memberForChangeStatus: null,
            memberInfo: null,
            memberNotFound: false,
            memberError: false
        }
    }
}
