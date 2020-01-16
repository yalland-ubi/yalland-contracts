/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */
import GaltData from "../../services/galtData";

const pIteration = require('p-iteration');
const axios = require('axios');
const config = require('../../../config');

export default {
	name: 'export-txs',
	template: require('./ExportTxs.html'),
	components: {},
	created() {
		if (localStorage.getItem('lastExports')) {
			this.lastExports = JSON.parse(localStorage.getItem('lastExports'));
		}

		this.availabilityCheck();
		setInterval(() => {
			this.availabilityCheck();
		}, 10 * 1000)
	},
	mounted() {

	},
	beforeDestroy() {

	},
	methods: {
		async setBlock(name) {
			this[name + 'Block'] = await GaltData.blockNumber();
		},
		async runExport() {
			if(!this.$backend.isAuthorized()) {
				try {
					const authMessage = await this.$backend.generateAuthMessage(this.user_wallet);
					const fieldName = 'key';

					const signature = await GaltData.signMessage(authMessage.message, this.user_wallet, fieldName);

					await this.$backend.loginAuthMessage(authMessage.id, this.user_wallet, signature, { fieldName });
				} catch (e) {
					console.error(e);
					this.$notify({
						type: 'error',
						title: 'Not authorized',
						text: e.message
					})
				}
			}
			const postData = {
				fromBlock: this.fromBlock,
				toBlock: this.toBlock,
				filters: null
			};

			if (this.enableFilters) {
				postData.filters = {
					to: this.filters.to,
					value: this.filters.value ? GaltData.etherToWei(this.filters.value) : null
				}
			}
			this.$backend.initExportTxs(postData)
				.then((data) => {
					this.addExport(data.result);
				});
		},
		addExport(exportName) {
			this.lastExports.unshift(exportName);
			localStorage.setItem('lastExports', JSON.stringify(this.lastExports));
			this.availabilityCheck();
		},
		availabilityCheck() {
			pIteration.forEach(this.lastExports, async (filename) => {
				if (this.exportAvailability[filename]) {
					return;
				}
				const isExists = await axios.get(config.helpersBackendUrl + 'file-exists/' + filename)
					.then((response) => {
						return response.data.result;
					});

				this.$set(this.exportAvailability, filename, isExists);
			})
		},
		getDateStrByTimestamp(timestamp) {
			return new Date(timestamp * 1000).toISOString().slice(0, 19).replace('T', '_');
		}
	},
	watch: {
		async 'toBlock'() {
			this.toBlockDate = this.getDateStrByTimestamp(await GaltData.getBlockTimeStamp(this.toBlock))
		},
		async 'fromBlock'() {
			this.fromBlockDate = this.getDateStrByTimestamp(await GaltData.getBlockTimeStamp(this.fromBlock))
		}
	},
	computed: {
		user_wallet() {
			return this.$store.state.user_wallet;
		},
		runExportDisabled() {
			return !this.fromBlock || !this.toBlock;
		}
	},
	data() {
		return {
			lastExports: [],
			exportAvailability: {},
			fromBlock: '',
			fromBlockDate: '',
			toBlock: '',
			toBlockDate: '',
			helpersBackendUrl: config.helpersBackendUrl,
			enableFilters: false,
			filters: {
				to: '',
				value: ''
			}
		};
	}
}
