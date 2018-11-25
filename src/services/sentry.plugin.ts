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

import { init, configureScope, captureMessage, captureException } from '@sentry/browser';

export default {
    install (Vue, options: any = {}) {
        init({
            dsn: 'https://530492fa9a944e3fa1a72629d3024c93@sentry.io/1276529',
            environment: process.env.NODE_ENV
        });
        
        Vue.prototype.$sentry = {
            setUserAddress: function(address) {
                // https://github.com/getsentry/sentry-javascript/tree/master/packages/browser
                configureScope(scope => {
                    // scope.setExtra('battery', 0.7);
                    // scope.setTag('user_mode', 'admin');
                    scope.setUser({ id: address });
                    // scope.clear();
                });
            },
            message: function(text) {
                captureMessage(text);
            },
            exception: function (e) {
                captureException(e);
            }
        };
    }
}
