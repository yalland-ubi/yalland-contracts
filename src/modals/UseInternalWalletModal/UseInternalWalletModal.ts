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

import {ModalItem} from '../../directives/AsyncModal'
import GaltData from "../../services/galtData";

export default {
    template: require('./UseInternalWalletModal.html'),
    props: ['txCount', 'ethPerTx', 'contractName', 'subjectId', 'sentEthPromise'],
    components: {
        ModalItem
    },
    async created() {
        if(this.sentEthPromise && this.sentEthPromise.then) {
            this.waitForSentTransactionEth = true;
            
            this.sentEthPromise
                .then(() => {
                    this.waitForSentTransactionEth = false;
                    this.calculateNeedEthForTransaction();
                })
                .catch(() => {
                    this.waitForSentTransactionEth = false;
                    this.calculateNeedEthForTransaction();
                })
        } else {
            this.calculateNeedEthForTransaction();
        }
    },
    methods: {
        async calculateNeedEthForTransaction() {
            this.needEthForTransactions = this.txCount * this.ethPerTx;
            this.ethToInternalWallet = GaltData.roundToDecimal(this.needEthForTransactions - this.internal_wallet_eth_balance + 0.001);
        },
        copyInternalWalletPrivateToClipboard() {
            GaltData.copyToClipboard(this.$internalWallet.getPrivate());
            this.$notify({
                type: 'success',
                title: this.$locale.get('use_internal_wallet.success.export_private_key')
            });
        },
        async sendEthToInternal() {
            this.ethTransactionSent = true;
            const txHash = await this.$galtUser.sendEthFromUserWaller(this.internal_wallet, this.ethToInternalWallet);
            
            this.$web3Worker.callMethod('waitForTransactionResult', txHash).then(() => {

                GaltData.ethBalance(this.internal_wallet).then((ethBalance) => {
                    this.$store.commit('internal_wallet_eth_balance', ethBalance);
                    this.ethTransactionSent = false;
                });
            });
        },
        async ok() {
            if(this.contractName == 'SplitMerge') {
                const isApproved = await this.$galtUser.isApprovedSpace(this.internal_wallet, this.subjectId);

                if(isApproved) {
                    this.successClose();
                } else {
                    this.waitingForApprove = true;
                    this.$galtUser.approveAllSpace(this.internal_wallet,true).then(async () => {
                        await this.$galtUser.waitForApproveToSpaceToken(this.internal_wallet, this.subjectId);
                        this.successClose();
                    });
                }
            } else if(this.contractName == 'PlotManagerContract') {
                const isApproved = await this.$galtUser.isApprovedApplicationForOperator(this.internal_wallet, this.subjectId);

                if(isApproved) {
                    this.successClose();
                } else {
                    this.waitingForApprove = true;
                    this.$galtUser.approveApplicationForOperator(this.internal_wallet, this.subjectId).then(async () => {
                        await this.$galtUser.waitForApproveToApplication(this.internal_wallet, this.subjectId);
                        this.successClose();
                    });
                }
            } else {
                this.$notify({
                    type: 'error',
                    title: this.$locale.get('use_internal_wallet.error.something_wrong.title'),
                    text: this.$locale.get('use_internal_wallet.error.something_wrong.description', {value: this.contractName})
                });
            }
        },
        successClose(){
            this.$internalWallet.setActive(true);
            this.$galtUser.setInternalWalletActive(true);
            this.$root.$asyncModal.close('use-internal-wallet-modal', 'internal_wallet');
        },
        useMetaMask() {
            this.$root.$asyncModal.close('use-internal-wallet-modal', 'metamask');
        },
        cancel() {
            this.$root.$asyncModal.close('use-internal-wallet-modal', 'cancel');
        }
    },
    watch: {
        internal_wallet() {
            this.calculateNeedEthForTransaction();
        },
        internal_wallet_eth_balance() {
            this.calculateNeedEthForTransaction();
        }
    },
    data() {
        return {
            waitForSentTransactionEth: null,
            needEthForTransactions: null,
            ethToInternalWallet: null,
            ethTransactionSent: false,
            waitingForApprove: false
        }
    },
    computed: {
        descriptionParts() {
            this.$store.state.locale;
            return this.$locale.get('use_internal_wallet.description_parts');
        },
        internal_wallet() {
            return this.$store.state.internal_wallet;
        },
        internal_wallet_active() {
            return this.$store.state.internal_wallet_active;
        },
        internal_wallet_eth_balance() {
            return this.$store.state.internal_wallet_eth_balance;
        },
        internal_wallet_galt_balance() {
            return this.$store.state.internal_wallet_galt_balance;
        },
        internal_wallet_space_balance() {
            return this.$store.state.internal_wallet_space_balance;
        },
        enoughEthForTransactions() {
            return !this.waitForSentTransactionEth && this.internal_wallet_eth_balance >= this.needEthForTransactions;
        }
    }
}
