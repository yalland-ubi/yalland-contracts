/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const ethers = require('ethers');

export default {
    install (Vue, options: any = {}) {
        let internalWalletAddress;
        let internalWalletPrivate;

        let active = localStorage.getItem('internalWalletActive') == '1';

        if(localStorage.getItem('internalWalletAddress') && localStorage.getItem('internalWalletPrivate')) {
            internalWalletAddress = localStorage.getItem('internalWalletAddress');
            internalWalletPrivate = localStorage.getItem('internalWalletPrivate');
        } else {
            generateNew();
        }

        function generateNew() {
            const newAccount = ethers.Wallet.createRandom();
            internalWalletAddress = newAccount.address;
            internalWalletPrivate = newAccount.privateKey;

            localStorage.setItem('internalWalletAddress', internalWalletAddress);
            localStorage.setItem('internalWalletPrivate', internalWalletPrivate);
        }

        Vue.prototype.$internalWallet = {
            getAddress: function() {
                return internalWalletAddress;
            },
            getPrivate: function() {
                return internalWalletPrivate;
            },
            generateNew: generateNew,
            setActive: function(_active) {
                active = _active;
                localStorage.setItem('internalWalletActive', _active ? "1" : "0");
            },
            getActive: function() {
                return active;
            }
        };
    }
}
