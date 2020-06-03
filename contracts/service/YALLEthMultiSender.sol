/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "@openzeppelin/contracts/ownership/Ownable.sol";

/**
 * @title YALLEthMultiSender contract
 * @author Galt Project
 **/
contract YALLEthMultiSender is Ownable {
  function sendMultiple(address payable[] calldata _tos, uint256[] calldata _amounts) external payable {
    uint256 len = _tos.length;
    require(len == _amounts.length, "_tos & _amounts lengths should match");
    uint256 accumulator = 0;

    for (uint256 i = 0; i < len; i++) {
      _tos[i].transfer(_amounts[i]);
      accumulator += _amounts[i];
    }

    require(msg.value == accumulator, "Attached and distributed values don't match");
  }

  function withdrawEth() external onlyOwner {
    msg.sender.transfer(address(this).balance);
  }
}
