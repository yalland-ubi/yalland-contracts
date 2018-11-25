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
import * as moment from 'moment';

export class Helper {
  static uuidv4() {
    return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    )
  }

  static openWindow(url, title, callback) {
    const auth_window = window.open(url, title, 'width=900,height=600');

    const pollTimer = window.setInterval(function () {
      if (!auth_window || auth_window.closed !== false) { // !== is required for compatibility with Opera
        window.clearInterval(pollTimer);
        onWindowClose();
      }
    }, 200);

    function onWindowClose() {

      callback();
    }
  }

  static updateUserProgress(user, progress) {
    user[progress.Type + '_progress'] = progress;
  }

  static updateUserProgressesList(user) {
    if (user.UserProgresses && user.UserProgresses.length) {
      user.UserProgresses.forEach((progress) => {
        Helper.updateUserProgress(user, progress);
      })
    }
  }

  static humanDate(date){
    return moment(date).format("D MMMM YYYY H:mm:ss");
  }
}
