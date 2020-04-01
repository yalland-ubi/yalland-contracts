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
import "./Checkpointable.sol";
import "./YALDistributor.sol";


contract CoinToken is ICoinToken, ERC20, ERC20Pausable, ERC20Burnable, ERC20Detailed, Checkpointable, Permissionable, GSNRecipientSigned {
  uint256 public constant INITIAL_SUPPLY = 0;

  string public constant MINTER_ROLE = "minter";
  string public constant BURNER_ROLE = "burner";
  string public constant PAUSER_ROLE = "pauser";
  string public constant TRANSFER_FROM_CALLER_ROLE = "transfer_from_caller";
  string public constant FEE_MANAGER_ROLE = "fee_manager";

  uint256 public constant HUNDRED_PCT = 100 ether;

  event SetTransferFee(address indexed feeManager, uint256 value);
  event SetDistributor(uint256 newDistributor);

  // 100 % == 100 eth
  uint256 public transferFee = 0;
  YALDistributor public yalDistributor;

  constructor(
    address _yalDistributorAddress,
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  )
    public
    ERC20Detailed(_name, _symbol, _decimals)
    Permissionable()
  {
    yalDistributor = YALDistributor(_yalDistributorAddress);

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

  function mint(address _account, uint256 _amount) public hasMintPermission returns (bool) {
    _mint(_account, _amount);
    _updateAccountCache(_account);

    return true;
  }

  function burn(address _account, uint256 _amount) public hasBurnPermission {
    _burn(_account, _amount);
    _updateAccountCache(_account);
  }

  // USER INTERFACE

  function approve(address _spender, uint256 _amount) public returns (bool) {
    require(yalDistributor.isActive(_msgSender()), "Member is inactive");

    return super.approve(_spender, _amount);
  }

  function transfer(address _to, uint256 _value) public returns (bool) {
//    require(yalDistributor.areTwoActive(_msgSender(), _to), "One of the members is inactive");

    uint256 newValue = _takeFee(_msgSender(), _value);
    bool result = super.transfer(_to, newValue);

    _updateTransferCache(_msgSender(), _to);

    return result;
  }

  function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
//    require(yalDistributor.areTwoActive(_from, _to), "One of members is inactive");
    address[3] memory toCheck = [_from, _to, msg.sender];
    _requireParticipantsAreValid(toCheck);

    uint256 newValue = _takeFee(_from, _value);

    _transfer(_from, _to, newValue);
    _approve(_from, _msgSender(), allowance(_from, _msgSender()).sub(_value, "ERC20: transfer amount exceeds allowance"));

    _updateTransferCache(_from, _to);

    return true;
  }

  // INTERNAL
  function _requireParticipantsAreValid(address[] memory _addr) internal {

  }

  function _updateAccountCache(address _account) internal {
    _updateValueAtNow(_cachedBalances[_account], balanceOf(_account));
    _updateValueAtNow(_cachedTotalSupply, totalSupply());
  }

  function _updateTransferCache(address _from, address _to) internal {
    _updateValueAtNow(_cachedBalances[_from], balanceOf(_from));
    _updateValueAtNow(_cachedBalances[_to], balanceOf(_to));
    _updateValueAtNow(_cachedBalances[address(this)], balanceOf(address(this)));
    _updateValueAtNow(_cachedTotalSupply, totalSupply());
  }

  function _takeFee(address from, uint256 _value) private returns(uint256) {
    uint256 _fee = getFeeForAmount(_value);

    if (_fee > 0) {
      _transfer(from, address(this), _fee);
    }

    return _value.sub(_fee);
  }

  // GETTERS
  
  function getFeeForAmount(uint256 amount) public view returns(uint256) {
    if (transferFee > 0) {
      return amount.mul(transferFee) / HUNDRED_PCT;
    } else {
      return 0;
    }
  }

  // OWNER INTERFACES

  function setDistributor(uint256 _yalDistributor) public onlyRole('role_manager') {
    yalDistributor = YALDistributor(_yalDistributor);

    emit SetDistributor(_yalDistributor);
  }

  function setTransferFee(uint256 _transferFee) public hasFeeManagerPermission {
    require(_transferFee < HUNDRED_PCT, "Invalid fee value");

    transferFee = _transferFee;

    emit SetTransferFee(msg.sender, _transferFee);
  }

  function withdrawFee() public hasFeeManagerPermission {
    address _this = address(this);
    uint256 _payout = balanceOf(_this);

    require(_payout > 0, "Nothing to withdraw");

    _transfer(_this, _msgSender(), _payout);

    _updateValueAtNow(_cachedBalances[address(this)], balanceOf(address(this)));
    _updateValueAtNow(_cachedBalances[_msgSender()], balanceOf(_msgSender()));
    _updateValueAtNow(_cachedTotalSupply, totalSupply());
  }
}
