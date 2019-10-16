/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "../../../services/galtData";
import EditMemberTariffModal from "./modals/EditMemberTariffModal/EditMemberTariffModal";
import AddMemberModal from "./modals/AddMemberModal/AddMemberModal";
import MemberPayout from "../../../directives/MemberPayout/MemberPayout";
import {EventBus, TARIFF_UPDATE} from "../../../services/events";

const _ = require('lodash');
const pIteration = require('p-iteration');

export default {
    name: 'admin-members',
    template: require('./AdminMembers.html'),
    components: {MemberPayout},
    props: [],
    async mounted() {
        this.curTariffId = localStorage.getItem('AdminMembers.curTariffId');
        await this.getTariffs();
        this.getTariffMembers();

        EventBus.$on(TARIFF_UPDATE, () => {
            this.getTariffs();
        });
    },
    watch: {
        curTariffId() {
            if(!this.curTariffId) {
                return;
            }
            localStorage.setItem('AdminMembers.curTariffId', this.curTariffId);
            this.getTariffMembers();
        }
    },
    methods: {
        async getTariffs() {
            this.tariffs = await this.$cityContract.getAllTariffs();
            if(!this.curTariffId && this.tariffs.length) {
                this.curTariffId = this.tariffs[0].id;
            }
            return this.tariffs;
        },
        async getTariffMembers() {
            this.loaded = false;
            if(!this.curTariffId) {
                this.membersCount = 0;
                this.members = [];
                this.loaded = true;
                return;
            }
            this.membersCount = await this.$cityContract.getTariffActiveMembersCount(this.curTariffId);
            this.members = await this.$cityContract.getTariffActiveMembers(this.curTariffId);
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

            const operationId = this.$galtUser.claimPaymentForMultipleMembers(membersToClaim, this.curTariffId);
            
            this.$waitScreen.setOperationId(operationId);

            this.loaded = false;
            this.members = [];
            this.$web3Worker.callMethod('waitForOperationMined', operationId).then(async (operationState) => {
                if(mode == 'internal_wallet') {
                    await this.$galtUser.releaseInternalWallet('City');
                }

                this.getTariffMembers();
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
                    this.getTariffMembers();
                }
            });
        },
        kickMember(member) {
            GaltData.confirmModal({
                title: this.$locale.get(this.localeKey + '.deactivate_confirm')
            }).then(() => {

                this.loaded = false;
                this.$galtUser.kickTariffMember(member, this.curTariffId)
                    .then(() => {
                        this.getTariffMembers();

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
            curTariffId: null,
            tariffs: [],
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
