/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import Vue from 'vue'
import Router from 'vue-router'
import AdminPage from "../components/AdminPage/AdminPage";
import PersonalCabinetPage from "../components/PersonalCabinetPage/PersonalCabinetPage";

Vue.use(Router);

export default new Router({
    //mode: 'history',
    routes: [
        {
            path: '/cabinet',
            name: 'cabinet',
            component: PersonalCabinetPage
        },
        {
            path: '/admin',
            name: 'admin',
            component: AdminPage
        },
        {
            path: '*', redirect: '/cabinet'
        }
    ]
})
