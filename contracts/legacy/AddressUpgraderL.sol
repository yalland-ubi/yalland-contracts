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
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "./CoinTokenL.sol";


contract AddressUpgraderL is Permissionable {
  using SafeMath for uint256;

  string public constant SUPERUSER_ROLE = "superuser";

  event MigrateMyAddress(address indexed from, address indexed to);
  event ChangeAddress(address indexed from, address indexed to, address superuser);

  address public erc20Token;

  modifier onlySuperuser() {
    require(hasRole(msg.sender, SUPERUSER_ROLE), "Only superuser allowed");
    _;
  }

  constructor(address _erc20Token) public Permissionable() {
    erc20Token = _erc20Token;
  }

  function migrateUserAddress(address _from, address payable _to) external onlySuperuser {
    _migrate(_from, _to);
    emit ChangeAddress(_from, _to, msg.sender);
  }

  function migrateMultipleUserAddresses(
    address[] calldata _from,
    address payable[]  calldata _to
  )
    external
    onlySuperuser
  {
    require(_from.length == _to.length, "To/From lengths mismatch");

    uint256 len = _from.length;

    for (uint256 i = 0; i < len; i++) {
      _migrate(_from[i], _to[i]);
      emit ChangeAddress(_from[i], _to[i], msg.sender);
    }
  }

  // INTERNAL

  function _migrate(address _from, address payable _to) internal {
    require(_to != address(0), "_to can't be 0x0 address");

    uint256 balance = IERC20(erc20Token).balanceOf(_from);
    require(balance > 0, "Cant migrate 0 balance");

    // burn
    CoinTokenL(erc20Token).burn(_from, balance);

    //mint
    CoinTokenL(erc20Token).mint(_to, balance);
  }
}
