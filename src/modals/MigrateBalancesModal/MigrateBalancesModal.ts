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

const web3Utils = require('web3-utils');
const startsWith = require('lodash/startsWith');
const pIteration = require('p-iteration');

export default {
	template: require('./MigrateBalancesModal.html'),
	props: ['contract', 'method', 'subject', 'locale'],
	components: {
		ModalItem
	},
	created() {

	},
	methods: {
		async migrateBalances() {
			if(!this.$backend.isAuthorized()) {
				const authorized = await this.$backend.authorize(this.user_wallet);
				if(!authorized) {
					return this.$notify({
						type: 'error',
						title: 'Not authorized'
					})
				}
			}
			const postData = {
				old: this.addressesToMigrate.map(item => item.old),
				new: this.addressesToMigrate.map(item => item.new)
			};

			this.$backend.migrateAddresses(postData)
				.then((data) => {
					this.close();
				});
		},
		close() {
			this.$root.$asyncModal.close('migrate-balances-modal');
		}
	},
	watch: {
		csvContent() {
			this.addressesToMigrate = [];
			this.incorrectAddresses = [];
			this.notEnoughBalance = [];
			if (!this.csvContent) {
				return;
			}
			this.csvContent.split(/\r\n|\r|\n/g).forEach((line, index) => {
				const split = line.split(/[,;]+ {0,}/);
				const address1 = _.trim(split[0], ' ');
				const address2 = _.trim(split[1], ' ');
				if (!index && !startsWith(address1, '0x')) {
					return null;
				}
				let incorrect = false;
				if (!web3Utils.isAddress(address1)) {
					this.incorrectAddresses.push({'old': address1});
					incorrect = true;
				}
				if (!web3Utils.isAddress(address2)) {
					this.incorrectAddresses.push({'new': address2});
					incorrect = true;
				}

				if (!incorrect) {
					this.addressesToMigrate.push({'old': address1, 'new': address2, inGasTariff: false})
				}
			});

			this.checkingBalance = true;
			pIteration.forEach(this.addressesToMigrate, item => {
				return this.$root.$coinTokenContract.balanceOf(item.old).then(balance => {
					item.haveEnoughYal = balance > 0;
					if(!item.haveEnoughYal) {
						this.notEnoughBalance.push(item);
					}
				})
			}).then(() => {
				this.checkingBalance = false;
				this.addressesToMigrate = this.addressesToMigrate.filter(item => item.haveEnoughYal);
			})
		}
	},
	computed: {
		user_wallet() {
			return this.$store.state.user_wallet;
		},
	},
	data: function () {
		return {
			state: 'input',
			sending: false,
			checkingBalance: false,
			checkingGas: false,
			csvContent: '',
			addressesToMigrate: [],
			incorrectAddresses: [],
			notEnoughBalance: [],
			warning: ''
		}
	}
}
