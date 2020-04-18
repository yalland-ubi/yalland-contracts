/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";


contract YALLTokenEthereum is
  Ownable,
  ERC20,
  ERC20Burnable,
  ERC20Detailed
{
  uint256 public constant INITIAL_SUPPLY = 0;

  event Mint(address indexed to, uint256 value);
  event SetMinter(address from, address to);

  address public minter;

  constructor()
    public
    ERC20Detailed("YALLEthereum", "YAL", uint8(18))
  {
  }

  modifier onlyMinter() {
    require(msg.sender == minter, "YALLTokenEthereum: Only minter allowed");

    _;
  }

  // OWNER INTERFACE

  function setMinter(address _minter) external onlyOwner {
    address previousMinter = minter;

    minter = _minter;

    emit SetMinter(previousMinter, _minter);
  }

  // MINTER INTERFACE

  function mint(address _account, uint256 _amount) external onlyMinter returns (bool) {
    _mint(_account, _amount);

    emit Mint(_account, _amount);

    return true;
  }
}
