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

import GaltData from "./galtData";
const config = require("../../config");
const _ = require('lodash');

export default class Locale {
    static $store: any;
    static lang: string;
    static loaded = false;
    
    static onLoadEvents: {[eventId: number]: any} = {};
    static onLoadEventsCount = 0;

    static async init(_store) {
        Locale.lang = localStorage.getItem('lang') || config.defaultLang;
        Locale.$store = _store;
        await Locale.loadLocale();
    }
    
    static async loadLocale(){
        Locale.loaded = false;
        return GaltData.getLocale(Locale.lang).then((_locale) => {
            Locale.$store.commit('locale', _locale);
            for(let id in this.onLoadEvents) {
                if(this.onLoadEvents[id]) {
                    this.onLoadEvents[id]();
                }
            }
            Locale.loaded = true;
            return _locale;
        });
    }
    
    static get(key: string, options?: any) {
        if(_.isArray(key)) {
            options = key[1];
            key = key[0];
        }
        
        let keyParts = key.split('.');
        keyParts = keyParts.map(_.snakeCase);
        key = keyParts.join('.');
        
        let result;
        if(options) {
            result = _.template(_.get(Locale.$store.state.locale, key))(options) || '';
        } else {
            result = _.get(Locale.$store.state.locale, key) || '';
        }
        if(!result && Locale.loaded) {
            console.error('[' + Locale.lang + '] Locale not found: ' + key);
            result = key;
        }
        return result;
    }
    
    static async changeLang(_lang: string) {
        Locale.lang = _lang;
        localStorage.setItem('lang', _lang);
        await Locale.loadLocale();
    }
    
    static onLoad(callback) {
        const id = ++this.onLoadEventsCount;
        this.onLoadEvents[id] = callback;
        return id;
    }
    
    static unbindOnLoad(id) {
        delete this.onLoadEvents[id];
    }
    
    static async setTitlesByNamesInList(list, prefix?, options?){
        await Locale.waitForLoad();
        return list.map((item) => {
            item.title = Locale.get(prefix + item.name, options) || item.name;
            return item;
        })
    }
    static async waitForLoad() {
        return new Promise((resolve, reject) => {
            if(Locale.loaded){
                resolve();
            } else {
                const onLoadId = Locale.onLoad(() => {
                    resolve();
                    Locale.unbindOnLoad(onLoadId);
                })
            }
        });
    }
}