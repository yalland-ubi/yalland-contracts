/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import * as _ from 'lodash';

export default {
  name: 'edit-field',
  props: [ 'value', 'state', 'readonly' ],
  watch: {
    value: function () {
      this.changed();
    }
  },
  methods: {
    changed(value){
      if(_.isUndefined(value))
        return;

      this.$emit('input', value);
    }
  },
  template: `<span>
      <input v-if="!readonly" type="text" :class="{'form-control': true, 'invalid':!state.valid}" v-bind:value="value" v-on:input="changed($event.target.value)">
      <span v-if="readonly">{{value}}</span>
      <loader v-if="state.loading"></loader>
      <span class="error">{{state.error_message}}</span>
    </span>
  `
}
