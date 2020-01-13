/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "../interfaces/ICoinToken.sol";


contract Minter is Ownable {
  ICoinToken public coinToken;
  bool public active;

  modifier onlyActive() {
    require(active == true, "Not active");

    _;
  }
  constructor (ICoinToken _coinToken) public {
    coinToken = _coinToken;
    active = true;
  }

  function mintBatch(address[] calldata _to, uint256[] calldata _amount) external onlyOwner onlyActive {
    require(_to.length == _amount.length, "Should have equal length");
    uint256 len = _to.length;
    for (uint256 i = 0; i < len; i++) {
      coinToken.mint(_to[i], _amount[i]);
    }
  }

  function deactivate() external onlyOwner {
    active = false;
  }
}
