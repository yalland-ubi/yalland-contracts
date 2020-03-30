/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 * 
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "./interfaces/ICoinToken.sol";
import "./GSNRecipientSigned.sol";


contract CoinToken is ICoinToken, ERC20, ERC20Pausable, ERC20Burnable, ERC20Detailed, Permissionable, GSNRecipientSigned {
  uint256 public constant INITIAL_SUPPLY = 0;

  string public constant MINTER_ROLE = "minter";
  string public constant BURNER_ROLE = "burner";
  string public constant PAUSER_ROLE = "pauser";
  string public constant FEE_MANAGER_ROLE = "fee_manager";

  uint256 public constant feePrecision = 1 szabo;
  // in percents
  uint256 public transferFee = 0;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  )
    public
    ERC20Detailed(_name, _symbol, _decimals)
    Permissionable()
  {
    _addRoleTo(msg.sender, MINTER_ROLE);
    _addRoleTo(msg.sender, BURNER_ROLE);
    _addRoleTo(msg.sender, PAUSER_ROLE);
    _addRoleTo(msg.sender, FEE_MANAGER_ROLE);
    // ROLE_MANAGER is assigned to the msg.sender in Permissionable()
  }

  modifier hasMintPermission() {
    require(hasRole(_msgSender(), MINTER_ROLE), "Only minter allowed");
    _;
  }
  
  modifier hasBurnPermission() {
    require(hasRole(_msgSender(), BURNER_ROLE), "Only burner allowed");
    _;
  }

  modifier hasFeeManagerPermission() {
    require(hasRole(_msgSender(), FEE_MANAGER_ROLE), "Only fee manager allowed");
    _;
  }

  // Uses Permissionable PAUSER_ROLE instead of PauserRole from OZ since
  // the last one has no explicit removeRole method.
  modifier onlyPauser() {
    require(hasRole(_msgSender(), PAUSER_ROLE), "Only pauser allowed");
    _;
  }

  function _handleRelayedCall(bytes memory _encodedFunction, address _caller)
    internal view returns (GSNRecipientSignatureErrorCodes) {
    return GSNRecipientSignatureErrorCodes.OK;
  }

  // MANAGER INTERFACE

  function mint(address account, uint256 amount) public hasMintPermission returns (bool) {
    _mint(account, amount);
    return true;
  }

  function burn(address account, uint256 amount) public hasBurnPermission {
    _burn(account, amount);
  }

  // USER INTERFACE

  function transfer(address _to, uint256 _value) public returns (bool) {
    uint256 newValue = takeFee(_msgSender(), _value);
    return super.transfer(_to, newValue);
  }

  function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
    uint256 newValue = takeFee(_from, _value);

    _transfer(_from, _to, newValue);
    _approve(_from, _msgSender(), allowance(_from, _msgSender()).sub(_value, "ERC20: transfer amount exceeds allowance"));
    return true;
  }

  // INTERNAL

  function takeFee(address from, uint256 _value) private returns(uint256) {
    uint256 _fee = getFeeForAmount(_value);

    if (_fee > 0) {
      _transfer(from, address(this), _fee);
    }

    return _value.sub(_fee);
  }

  // GETTERS
  
  function getFeeForAmount(uint256 amount) public view returns(uint256) {
    if (transferFee > 0) {
      return amount.div(100).mul(transferFee).div(feePrecision);
    } else {
      return 0;
    }
  }

  // OWNER INTERFACES

  function setTransferFee(uint256 _transferFee) public hasFeeManagerPermission {
    transferFee = _transferFee;
  }

  function withdrawFee() public hasFeeManagerPermission {
    address _this = address(this);
    uint256 _payout = balanceOf(_this);

    require(_payout > 0, "Nothing to withdraw");

    _transfer(_this, _msgSender(), _payout);
  }
}
