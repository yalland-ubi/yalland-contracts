/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "../registry/YALLRegistryCore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC20Managed {
  IERC20 public erc20;

  event GasUsedEvent(uint256 gasUsed);

  constructor(address _erc20) public {
    erc20 = IERC20(_erc20);
  }

  function approve(address _to, uint256 _amount) external {
    erc20.approve(_to, _amount);
  }

  function transferFrom(
    address _from,
    address _to,
    uint256 _amount
  ) external {
    uint256 before = gasleft();
    erc20.transferFrom(_from, _to, _amount);
    emit GasUsedEvent(before - gasleft());
  }
}
