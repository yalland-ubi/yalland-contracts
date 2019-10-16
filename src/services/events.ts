/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
