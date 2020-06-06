/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "./traits/YALLFeeWithdrawable.sol";
import "./registry/YALLRegistry.sol";

contract YALLFeeCollector is YALLFeeWithdrawable {
  // ಠ_ಠ
  constructor(address _yallRegistry) public {
    yallRegistry = YALLRegistry(_yallRegistry);
  }
}
