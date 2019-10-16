/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import * as _ from 'lodash';

export default class WorkerClient {
    worker: any;
    methodCallsCount: number = 0;
    listenEvents: {
        [eventName: string] : {
            [eventId: number] : any
        }
    } = {};
    
    listenEventsCount: {
        [eventName: string] : number
    } = {};

    constructor(worker) {
        this.worker = worker;

        this.worker.onmessage = event => {
            const eventName = event.data.event;
            const eventData = event.data.data;

            if(this.listenEvents[eventName]) {
                _.forEach(this.listenEvents[eventName], (eventCallback) => {
                    eventCallback(eventData);
                });
            } else {
                // console.error('No registered callbacks for event', event);
            }
        };
    }

    callMethod(methodName, data) {
        this.methodCallsCount++;

        const methodId = this.methodCallsCount;
        const finishEvent = methodName + '_' + methodId;

        const finishPromise = new Promise((resolve, reject) => {
            this.onEvent(finishEvent, (data) => {
                if(data && data.error) {
                    reject(data.error)
                } else {
                    resolve(data)
                }
            });
        });

        // https://stackoverflow.com/a/42376465/6053486
        const postMessageOptions = JSON.parse(JSON.stringify({
            method: methodName,
            data: data,
            id: methodId,
            finishEvent: finishEvent
        }));
        
        // console.log('postMessage', postMessageOptions);
        this.worker.postMessage(postMessageOptions);

        return finishPromise;
    }

    onEvent(eventName, callback) {
        if(!this.listenEvents[eventName]) {
            this.listenEvents[eventName] = {};
            this.listenEventsCount[eventName] = 0;
        }
        
        const eventId = ++this.listenEventsCount[eventName];
        this.listenEvents[eventName][eventId] = callback;
        return eventId;
    }

    clearEvent(eventName, eventId) {
        delete this.listenEvents[eventName][eventId];
    }
}
