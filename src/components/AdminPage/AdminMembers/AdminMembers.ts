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
const pIteration = require('p-iteration');

export default {
    name: 'admin-members',
    template: require('./AdminMembers.html'),
    components: {MemberPayout},
    props: [],
    mounted() {
        this.getAllMembers();
    },
    watch: {},
    methods: {
        async getAllMembers() {
            this.membersCount = await this.$cityContract.getActiveMembersCount();
            this.members = await this.$cityContract.getActiveMembers();
            this.loaded = true;
        },
        async claimToAll() {
            this.$waitScreen.show();
            
            const currentTimestamp = Date.now() / 1000;
            
            const membersToClaim = await pIteration.filter(this.members, async (member: any) => {
                if (!member.resolved) {
                    await member.resolvePromise;
                }
                
                return !member.lastTimestamp || currentTimestamp > member.lastTimestamp + member.tariffObject.paymentPeriod;
            });
            
            const txPrice = await GaltData.gasPrice(150000);
            
            const mode = await GaltData.useInternalWalletModal('City', this.$cityContract.address, membersToClaim.length, txPrice).catch(() => {
                this.$waitScreen.hide();
            });
            
            if(!mode) {
                return;
            }

            const operationId = this.$galtUser.claimPaymentForMultipleMembers(membersToClaim);
            
            this.$waitScreen.setOperationId(operationId);

            this.$web3Worker.callMethod('waitForOperationMined', operationId).then(async (operationState) => {
                if(mode == 'internal_wallet') {
                    await this.$galtUser.releaseInternalWallet('City');
                }

                this.$waitScreen.hide();

                this.$notify({
                    type: 'success',
                    title: this.getLocale('success.claim_to_all.title'),
                    text: this.getLocale('success.claim_to_all.description')
                });
            })
        },
        fetchMemberToFind() {
            if (!this.memberToFind) {
                return;
            }
            if(_.find(this.members, (member) => member.address.toLowerCase() === this.memberToFind.toLowerCase())) {
                return;
            }
            this.$cityContract.getMember(this.memberToFind)
                .then((member) => {
                    if (!member.active) {
                        this.memberNotFound = true;
                        return;
                    }
                    this.members.push(member);
                    this.members = _.clone(this.members);
                })
                .catch(() => {
                    this.memberError = true;
                })
        },
        updateMemberInfo(memberAddress) {
            this.members.some(member => {
                if (member.address == memberAddress) {
                    this.$cityContract.getMember(member.address)
                        .then((getMember) => {
                            _.extend(member, getMember);
                        })
                        .catch(() => {
                        })
                }
                return member.address == memberAddress;
            })
        },
        editMember(member) {
            this.$root.$asyncModal.open({
                id: 'edit-member-tariff-modal',
                component: EditMemberTariffModal,
                props: {
                    memberAddress: member.address,
                },
                onClose: (resultMember) => {
                    if (!resultMember) {
                        return;
                    }
                    this.updateMemberInfo(resultMember.address);
                }
            });
        },
        addMember() {
            let memberAddress = null;
            if (this.memberToFind && this.memberNotFound) {
                memberAddress = this.memberToFind;
            }

            this.$root.$asyncModal.open({
                id: 'add-member-modal',
                component: AddMemberModal,
                props: {
                    memberAddress: memberAddress,
                },
                onClose: (resultMember) => {
                    if (!resultMember) {
                        return;
                    }
                    this.getAllMembers();
                }
            });
        },
        kickMember(member) {
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
                return _.includes(member.address.toLowerCase(), this.memberToFind.toLowerCase()) || _.includes(member.tariffTitle.toLowerCase(), this.memberToFind.toLowerCase());
            });
        },
        is_city_manager() {
            return this.is_fee_manager || this.is_rate_manager || this.is_member_join_manager || this.is_member_leave_manager;
        },
        is_fee_manager() {
            return this.$store.state.is_fee_manager;
        },
        is_rate_manager() {
            return this.$store.state.is_rate_manager;
        },
        is_member_join_manager() {
            return this.$store.state.is_member_join_manager;
        },
        is_member_leave_manager() {
            return this.$store.state.is_member_leave_manager;
        }
    },
    data() {
        return {
            memberToFind: "",
            membersCount: null,
            loaded: false,
            members: [],
            localeKey: 'admin.members',
            memberForChangeStatus: null,
            memberInfo: null,
            memberNotFound: false,
            memberError: false,
            showAll: false,
            countPerShow: 10,
            showCount: 10
        }
    }
}
