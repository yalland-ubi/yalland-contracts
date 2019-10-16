/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
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
