/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import GaltData from "./galtData";

const axios = require('axios');
const config = require('../../config');

export default {
	install(Vue, options: any = {}) {
		let apiKey;
		const $http = axios.create({});

		Vue.prototype.$backend = {
			init() {
				if (localStorage.getItem('apiKey')) {
					this.setApiKey(localStorage.getItem('apiKey'))
				}
			},
			async authorize(userWallet) {
				try {
					const authMessage = await this.generateAuthMessage(userWallet);
					const fieldName = 'key';

					const signature = await GaltData.signMessage(authMessage.message, userWallet, fieldName);

					await this.loginAuthMessage(authMessage.id, userWallet, signature, { fieldName });
					return true;
				} catch (e) {
					console.error(e);
					return false;
				}
			},
			setApiKey(_apiKey) {
				apiKey = _apiKey;

				$http.defaults.headers.post['Authorization'] = 'Bearer ' + apiKey;
				$http.defaults.headers.get['Authorization'] = 'Bearer ' + apiKey;

				localStorage.setItem('apiKey', _apiKey);
			},
			isAuthorized() {
				return !!apiKey;
			},
			generateAuthMessage: function (accountAddress) {
				return axios.post(config.helpersBackendUrl + 'v1/generate-auth-message', {
					accountAddress,
					accountProvider: 'ethereum'
				}).then(res => res.data);
			},
			loginAuthMessage: function (authMessageId, address, signature, params) {
				return axios.post(config.helpersBackendUrl + 'v1/login-by-auth-message', {
					authMessageId,
					address,
					signature,
					params
				}).then(res => {
					this.setApiKey(res.data.result);
					return res.data;
				});
			},
			handleError(err) {
				// if not authorized: clear api key
				if(err.message.indexOf('403') !== -1) {
					this.setApiKey('');
				}
				throw err;
			},
			initExportTxs: function (postData) {
				return axios
					.post(config.helpersBackendUrl + 'v1/admin/init-export-txs/', postData)
					.then(res => res.data)
					.catch(e => this.handleError(e));
			},
			migrateAddresses: function (postData) {
				return axios
					.post(config.helpersBackendUrl + 'v1/admin/migrate-addresses/', postData)
					.then(res => res.data)
					.catch(e => this.handleError(e));
			}
		};
	}
}
