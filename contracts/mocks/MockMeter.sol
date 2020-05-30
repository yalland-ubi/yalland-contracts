/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "../registry/YALLRegistry.sol";


contract MockMeter {
  event GasUsedEvent(uint256 gasUsed);

  function constantCall() external returns (bytes32) {
    uint256 before = gasleft();
    bytes32 blah = YALLRegistry(0).YALL_FEE_COLLECTOR_KEY();
    emit GasUsedEvent(before - gasleft());
    return blah;
  }
}
