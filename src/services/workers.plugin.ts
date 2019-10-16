/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import WorkerClient from "./workerClient";
import Web3Worker from './Web3Worker';

export default {
    install (Vue, options) {
        // TODO: make real worker
        const web3Worker = new Web3Worker();
        Vue.prototype.$web3Worker = new WorkerClient(web3Worker);
    }
}
