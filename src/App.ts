/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import Vue from 'vue';
import * as Vuex from 'vuex';
import VueMaterial from 'vue-material'
import {Modal} from "./directives/AsyncModal";
import {Tabs, Tab} from "./directives/tabs";
import Notifications from 'vue-notification';

const _ = require('lodash');
const Web3 = require('web3');

import storePlugin from './services/store.plugin';
import httpPlugin from './services/http.plugin';
import workersPlugin from './services/workers.plugin';
import galtUserPlugin from './services/galtUser.plugin';
import internalWalletPlugin from './services/internalWallet.plugin';
import waitScreenPlugin from './services/waitScreen.plugin';
import sentryPlugin from './services/sentry.plugin';
import rpcScreenPlugin from './services/rpcScreen.plugin';
import localePlugin from './services/locale.plugin';
import contractsFactoryPlugin from './services/contractsFactory.plugin';
import backendPlugin from './services/backend.plugin';

import Locale from "./services/locale";
import GaltData from './services/galtData';

import Loader from "./directives/Loader/Loader";
import EditField from "./directives/EditField/EditField";
import UserMenu from "./directives/UserMenu/UserMenu";
import WaitScreen from "./directives/WaitScreen/WaitScreen";

import AlternativeServersModal from "./modals/AlternativeServersModal/AlternativeServersModal";
import HexCut from "./directives/HexCut/HexCut";
import MetamaskNotActive from "./directives/MetamaskNotActive/MetamaskNotActive";

Vue.use(Notifications);

Vue.use(httpPlugin);
Vue.use(Vuex as any);
Vue.use(storePlugin);
Vue.use(workersPlugin);
Vue.use(waitScreenPlugin);
Vue.use(rpcScreenPlugin);
Vue.use(internalWalletPlugin);
Vue.use(galtUserPlugin);
Vue.use(sentryPlugin);
Vue.use(localePlugin);
Vue.use(contractsFactoryPlugin);
Vue.use(backendPlugin);

Vue.component('modal', Modal);
Vue.component('tabs', Tabs);
Vue.component('tab', Tab);
Vue.component('loader', Loader);
Vue.component('edit-field', EditField);
Vue.component('hex-cut', HexCut);

Vue.use(VueMaterial);

Vue.filter('beautyNumber', GaltData.beautyNumber);

Vue.filter('beautyDate', GaltData.beautyDate);

Vue.filter('beautyPeriod', (period) => {return GaltData.beautyPeriod(period)});

function setElContentByLocale(el, key) {
    el.innerHTML = Locale.get(key);
}
Vue.directive('locale', {
    bind (el, binding) {
        el.dataset.localOnLoadId = Locale.onLoad(() => {
            setElContentByLocale(el, binding.value);
        }).toString();
        
        setElContentByLocale(el, binding.value);
    },
    update (el, binding) {
        setElContentByLocale(el, binding.value);
    },
    unbind (el, binding) {
        Locale.unbindOnLoad(el.dataset.localOnLoadId);
    }
});

Vue.directive('locale-placeholder', {
    bind (el: any, binding) {
        el.dataset.localOnLoadId = Locale.onLoad(() => {
            el.placeholder = Locale.get(binding.value) || '';
        }).toString();
        el.placeholder = Locale.get(binding.value) || '';
    },
    update (el: any, binding) {
        el.placeholder = Locale.get(binding.value) || '';
    },
    unbind: function (el, binding) {
        Locale.unbindOnLoad(el.dataset.localOnLoadId);
    }
});

Vue.filter('locale', Locale.get);

Vue.filter('ether', GaltData.weiToEther);

Vue.filter('hexToUtf8', function (str) {
    return Web3.utils.hexToUtf8(str || "0x0");
});

Vue.filter('tokenIdToHex', function (str) {
    return GaltData.tokenIdToHex(str || "");
});

Vue.filter('hexCut', function (str) {
    return str ? str.slice(0, 7) + "..." + str.slice(-4) : '';
});

export default {
    name: 'app',
    template: require('./App.html'),
    components: {UserMenu, WaitScreen, MetamaskNotActive},
    async created() {
        GaltData.init(this);
        
        this.$galtUser.init(this.$internalWallet, this.$contracts, this.$store);
        this.$backend.init();
        
        this.$galtUser.releaseInternalWallet();
        
        this.$locale.init(this.$store).then(() => {
            this.$store.commit('locale_loaded', true);
            this.language = this.$locale.lang;
        });
        this.$locale.onLoad(() => {
            this.$store.commit('locale_loaded', true);
            this.language = this.$locale.lang;
        });

        // TODO: move root variables to plugins
        this.$root.$cointTokenContract = this.$cointTokenContract;
        this.$root.$cityContract = this.$cityContract;
        
        await this.initServerWeb3();
        
        this.initContracts();

        this.$store.watch(
            (state) => state.user_wallet,
            (user_wallet) => this.getUserData());

        this.getUserData();
        
        setInterval(this.getUserData.bind(this), 10000);
        
        this.$locale.waitForLoad().then(() => {
            this.$waitScreen.setDefaultText(this.$locale.get('wait_screen.default_title'), this.$locale.get('wait_screen.default_tip'));
            this.$rpcScreen.setDefaultText(this.$locale.get('rpc_screen.not_correct'), this.$locale.get('rpc_screen.you_can_use_tip'));
            this.$rpcScreen.setVideoYoutubeId(this.$locale.get('rpc_screen.youtube_video_id'));
        });
        
        this.$web3Worker.callMethod('setWeb3', GaltData.callMethodsRpcServer());
        
        this.$web3Worker.onEvent('txFailed', (tx) => {
            this.$sentry.exception(tx.error);
        });
        this.$web3Worker.onEvent('txError', (tx) => {
            this.$sentry.exception(tx.error);
        });

        (global as any).$dev = {
            addCityRole: (address, role) => {
                return this.$galtUser.addCityRole(address, role);
            },
            sendCityContractMethod: (methodName, args = []) => {
                return this.$galtUser.sendCityContractMethod(methodName, args);
            },
            sendUpgraderContractMethod: (methodName, args = []) => {
                return this.$galtUser.sendUpgraderContractMethod(methodName, args);
            },
            sendTokenContractMethod: (methodName, args = []) => {
                return this.$galtUser.sendTokenContractMethod(methodName, args);
            },
            sendTariffAdderContractMethod: (methodName, args = []) => {
                return this.$galtUser.sendTariffAdderContractMethod(methodName, args);
            }
        }
    },

    mounted() {
        this.$root.$asyncModal = this.$refs.modal;
        this.$root.$asyncSubModal = this.$refs.sub_modal;
    },
    
    beforeDestroy() {
        this.destroyWebsocket();
    },

    methods: {
        setUserWallet(walletAddress) {
            if(walletAddress) {
                this.showMetamaskNotActive = false;
            } else {
                this.showMetamaskNotActive = true;
            }
            this.$store.commit('user_wallet', walletAddress);
            this.$sentry.setUserAddress(walletAddress);
            this.$galtUser.setAddress(walletAddress);
            // this.checkInternalWalletForReleased();
        },
        
        async initWeb3() {
            // Checking if Web3 has been injected by the browser (Mist/MetaMask)
          if (window['ethereum']) {
            try {
              // Request account access if needed
              await window['ethereum'].enable();
              this.$root.$web3 = new Web3(window['ethereum']);
            } catch (error) {
              console.error('init web3 error', error);
            }
          }
          // Legacy dapp browsers...
          else if (typeof window['web3'] !== 'undefined') {
                this.$root.$web3 = new Web3(window['web3'].currentProvider);
            } else {
                this.showMetamaskNotActive = true;
                this.$rpcScreen.show(GaltData.rpcServer(), GaltData.altRpcServers());
            }
            
            if(!this.$root.$web3) {
                return;
            }

            this.$root.$web3.eth.getAccounts((error, accounts) => {
                this.setUserWallet(accounts[0]);
            });

            this.$root.$web3.eth.net.getId().then((rpcServerId) => {
                if(window['web3'] && rpcServerId == GaltData.rpcServerId()) {
                    if(this.$rpcScreen.isShowed()) {
                        this.$rpcScreen.hide();
                    }
                } else {
                    if(!this.$rpcScreen.isShowed()) {
                        this.$rpcScreen.show(GaltData.rpcServer(), GaltData.altRpcServers());
                    }
                }
            });

            setInterval(() => {
                this.$root.$web3.eth.getAccounts((error, accounts) => {
                    if (this.user_wallet && accounts[0] && accounts[0].toLowerCase() === this.user_wallet.toLowerCase())
                        return;
                    this.setUserWallet(accounts[0]);
                });
            }, 1000);

            this.$store.commit('internal_wallet', this.$galtUser.getInternalWallet());
            this.$store.commit('internal_wallet_active', this.$galtUser.getInternalWalletActive());

            this.$galtUser.onInternalWalletSet((walletAddress) => {
                this.$store.commit('internal_wallet', walletAddress);
                this.getInternalWalletData();
            });
            this.$galtUser.onInternalWalletActivated((active) => {
                this.$store.commit('internal_wallet_active', active);
            });

            this.getInternalWalletData();

            setInterval(this.getInternalWalletData.bind(this), 10000);
        },
        
        async initServerWeb3(){
            this.$root.$rpcServer = GaltData.rpcServer();
            
            let provider;
            if(_.includes(GaltData.rpcServer(), "ws://")) {
                provider = new Web3.providers.WebsocketProvider(GaltData.rpcServer());
                provider.on('error', async (e) => {
                    console.warn('websocket reconnect', e);
                    await this.initServerWeb3();
                    this.initContracts();
                });
                provider.on('end', async (e) => {
                    console.warn('websocket reconnect', e);
                    await this.initServerWeb3();
                    this.initContracts();
                });
            } else {
                provider = new Web3.providers.HttpProvider(GaltData.rpcServer());
            }
            
            this.$root.$serverWeb3 = new Web3(provider);

            await this.$root.$serverWeb3.eth.getBlockNumber().catch(async () => {
                const altServers = GaltData.altRpcServers();
                if(!altServers[0]) {
                    return;
                }
                this.$root.$rpcServer = altServers[0];
                this.$root.$serverWeb3 = new Web3(new Web3.providers.HttpProvider(altServers[0]));

                await this.$root.$serverWeb3.eth.getBlockNumber().catch(() => {
                    if(!altServers[1]) {
                        return;
                    }
                    this.$root.$rpcServer = altServers[1];
                    this.$root.$serverWeb3 = new Web3(new Web3.providers.HttpProvider(altServers[1]));
                })
            });
        },
        
        serverNotRespondingMessage(contractName) {
            return (options) => {
                this.$notify({
                    type: 'error',
                    title: "Сервер не отвечает",
                    text: `Контракт ${contractName} с адресом ${options.contractAddress} не отвечает на вызов ${options.methodName}`
                });
            }
        },

        async initContracts(contractsConfig) {
            GaltData.getContractsConfig().then(async (contractsConfig) => {
                if (!this.$root.$web3) {
                    if (document.readyState === "complete") {
                        await this.initWeb3();
                        this.$contractsFactory.init(this, contractsConfig);
                    } else {
                        window.addEventListener('load', async () => {
                            await this.initWeb3();
                            this.$contractsFactory.init(this, contractsConfig);
                        })
                    }
                }
            });
        },

        getUserData() {
            if(!this.user_wallet) {
                return;
            }

            this.$galtUser.coinBalance().then(galtBalance => {
                if(galtBalance == this.user_coin_balance) {
                    return;
                }
                this.$store.commit('user_coin_balance', galtBalance);
            });

            this.$galtUser.ethBalance().then(ethBalance => {
                if(ethBalance == this.user_eth_balance) {
                    return;
                }
                this.$store.commit('user_eth_balance', ethBalance);
            });

            this.$galtUser.hasRateManagerRole().then((has) => {
                if(has == this.is_rate_manager) {
                    return;
                }
                this.$store.commit('is_rate_manager', has);
            });

            this.$galtUser.hasMemberJoinManagerRole().then((has) => {
                if(has == this.is_member_join_manager) {
                    return;
                }
                this.$store.commit('is_member_join_manager', has);
            });

            this.$galtUser.hasMemberLeaveManagerRole().then((has) => {
                if(has == this.is_member_leave_manager) {
                    return;
                }
                this.$store.commit('is_member_leave_manager', has);
            });

            this.$galtUser.hasFeeManagerRole().then((has) => {
                if(has == this.is_fee_manager) {
                    return;
                }
                this.$store.commit('is_fee_manager', has);
            });
            this.$galtUser.hasRoleManagerRole().then((has) => {
                console.log('hasRoleManagerRole', has);
                if(has == this.is_role_manager) {
                    return;
                }
                this.$store.commit('is_role_manager', has);
            });
            this.$galtUser.hasMigrateManagerRole().then((has) => {
                console.log('hasMigrateManagerRole', has);
                if(has == this.is_migrate_manager) {
                    return;
                }
                this.$store.commit('is_migrate_manager', has);
            });
        },

        getInternalWalletData() {
            if(!this.internal_wallet) {
                this.$store.commit('internal_wallet_eth_balance', 0);
                this.$store.commit('internal_wallet_galt_balance', 0);
                this.$store.commit('internal_wallet_space_balance', 0);
                return;
            }
            GaltData.ethBalance(this.internal_wallet).then((ethBalance) => {
                this.$store.commit('internal_wallet_eth_balance', ethBalance);
            });
            this.$coinTokenContract.balanceOf(this.internal_wallet).then((ethBalance) => {
                this.$store.commit('internal_wallet_galt_balance', ethBalance);
            });
        },
        //
        // async checkInternalWalletForReleased() {
        //     const isSpaceApproved = await this.$galtUser.checkAndReleaseApprovedSpaceFromInternal();
        //     if(isSpaceApproved) {
        //         this.$waitScreen.show();
        //         this.$waitScreen.changeCenterText(this.$locale.get('wait_screen.release_rights.space'));
        //         this.$waitScreen.changeCenterSubText(this.$locale.get('wait_screen.release_rights.tip'));
        //         await this.$galtUser.waitForReleaseApprovedSpaceFromInternal();
        //         this.$waitScreen.hide();
        //     }
        //
        //     const isApplicationApproved = await this.$galtUser.checkAndReleaseApprovedApplicationFromInternal();
        //     if(isApplicationApproved) {
        //         this.$waitScreen.show();
        //         this.$waitScreen.changeCenterText(this.$locale.get('wait_screen.release_rights.plot_manager'));
        //         this.$waitScreen.changeCenterSubText(this.$locale.get('wait_screen.release_rights.tip'));
        //         await this.$galtUser.waitForReleaseApprovedApplicationFromInternal();
        //         this.$waitScreen.hide();
        //     }
        // },
        destroyWebsocket() {
            if (this.$root.$web3socket) {
                this.$root.$web3socket.onclose = null;
                this.$root.$web3socket.close();
            }
        },
        toggleMenu () {
            this.menuVisible = !this.menuVisible;
            if(!this.menuVisible) {
                setTimeout(() => {
                    this.menuMinimized = true;
                }, 200)
            } else {
                this.menuMinimized = false;
            }
        },
        alternativeServers(){
            this.$root.$asyncModal.open({
                id: 'alternative-servers-modal',
                component: AlternativeServersModal
            });
        },
        changeLanguage(lang){
            if(lang == this.$locale.lang) {
                return;
            }
            this.$store.commit('locale_loaded', false);
            this.$locale.changeLang(lang);
        },
        showChangeLog(){
            GaltData.changelogModal();
        }
    },
    
    computed: {
        user_wallet() {
            return this.$store.state.user_wallet;
        },
        user_coin_balance() {
            return this.$store.state.user_coin_balance;
        },
        is_city_manager() {
            return this.is_fee_manager || this.is_rate_manager || this.is_member_join_manager || this.is_member_leave_manager;
        },
        is_fee_manager() {
            return this.$store.state.is_fee_manager;
        },
        is_role_manager() {
            return this.$store.state.is_role_manager;
        },
        is_rate_manager() {
            return this.$store.state.is_rate_manager;
        },
        is_member_join_manager() {
            return this.$store.state.is_member_join_manager;
        },
        is_member_leave_manager() {
            return this.$store.state.is_member_leave_manager;
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
        altServersExists() {
            return GaltData.altRpcServers().length;
        },
        languageList() {
            this.$store.state.locale;
            return this.$locale.get('navbar.language.list');
        }
    },
    data() {
        return {
            version: GaltData.version(),
            showMetamaskNotActive: false,
            registryOwner: null,
            language: null,
            ownerOfParcels: [],
            rpcServer: GaltData.rpcServer(),
            menuVisible: false,
            menuMinimized: true
        }
    },
}
