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

import axios from 'axios';

export default class Http {
    // static base_url = process.env.NODE_ENV === 'development' ? 'http://localhost:8090/api/v1/' : '/api/v1/';

    static vueInstance;
    static beingAuth;

    static get(uri, params?) {
        return Http.request('get', uri, {params: params});
    }
    static post(uri, data) {
        return Http.request('post', uri, data);
    }
    static put(uri, data) {
        return Http.request('put', uri, data);
    }
    static remove(uri) {
        return Http.request('remove', uri);
    }

    static request(method, uri, data?){
      return axios[method](uri, data).then((response) => {
        return response;
      }, function (error) {
        if(!Http.vueInstance)
          return;

        if(!error.response) {
          error.response = {status: 500};
        }
        switch (error.response.status) {
          case 200:
            if(method !== 'post')
              return;

            // Http.vueInstance.$notify({
            //   type: 'success',
            //   title: 'Success!',
            //   text: 'Action success!'
            // });
            break;

          // case 400:
          //   Http.vueInstance.$notify({
          //     type: 'error',
          //     title: Locale.get("invalid_request"),
          //     text: Locale.get("invalid_request_data")
          //   });
          //
          //   break;
          //
          // case 401:
          //   if(uri !== 'current_user' && uri !== 'current_world' && uri !== 'available_action/add_pixel')
          //     Http.vueInstance.$notify({
          //       type: 'error',
          //       title: Locale.get("need_auth"),
          //       text: Locale.get("please_sign_in")
          //     });
          //
          //   if(Http.beingAuth){
          //     Http.vueInstance.$router.go({
          //       path: Http.vueInstance.$router.path,
          //       query: {
          //         t: + new Date()
          //       }
          //     });
          //   }
          //   break;
          //
          // case 403:
          //   Http.vueInstance.$notify({
          //     type: 'error',
          //     title: Locale.get("not_permitted"),
          //     text: Locale.get("dont_have_permission")
          //   });
          //   break;
          //
          // case 423:
          //   Http.vueInstance.$notify({
          //     type: 'error',
          //     title: Locale.get("locked"),
          //     text: Locale.get("locked_message")
          //   });
          //   break;
          //
          // case 500:
          //   Http.vueInstance.$notify({
          //     type: 'error',
          //     title: Locale.get("oops"),
          //     text: Locale.get("server_error")
          //   });
          //   break;
        }
      });
    }

    static current_user(){
      return Http.get('current_user').then(function (response) {
        if(response.status === 200){
          Http.beingAuth = true;
        }

        return response;
      })
    }

    static initAuthCheck(vue){
      Http.vueInstance = vue;
    }
}
