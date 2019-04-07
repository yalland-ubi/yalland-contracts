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

import Vue from 'vue';

export const EventBus = new Vue();

export const TARIFF_UPDATE = 'tariff-update';

export const WAIT_SCREEN_SHOW = 'wait-screen-show';
export const WAIT_SCREEN_HIDE = 'wait-screen-hide';
export const WAIT_SCREEN_CHANGE_TEXT = 'wait-screen-change-text';
export const WAIT_SCREEN_SET_OPERATION_ID = 'wait-screen-set-operation-id';

export function GetEventName(eventName, componentName) {
    return eventName + (componentName == 'main' ? '' : '-' + componentName);
}
