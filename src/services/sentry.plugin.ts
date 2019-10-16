/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
