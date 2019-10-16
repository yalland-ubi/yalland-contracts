/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
