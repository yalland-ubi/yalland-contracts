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

import * as _ from "lodash";

export default class FakeWorker {
    workerName: any;
    onmessage: any;

    constructor(workerName){
        this.workerName = workerName;
    }
    
    postMessage(data) {
        if(data.method) {
            const result = this[data.method](data.data, data.finishEvent);
            if(result && result.then) {
                result.then((asyncResult) => {
                    this.methodFinish(data, asyncResult);
                })
            } else if(!_.isUndefined(result)) {
                this.methodFinish(data, result);
            }
        } else {
            console.error('unrecognized worker event', event);
        }
    }
    
    sendEvent(eventName, eventData) {
        this.onmessage({
            data: {
                event: eventName,
                data: eventData
            }
        })
    }

    methodFinish(eventData, methodResult) {
        this.sendEvent(eventData.finishEvent, methodResult);
    }
}