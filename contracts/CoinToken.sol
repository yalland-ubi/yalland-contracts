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


contract CoinToken is
  ICoinToken,
  ERC20,
  ERC20Pausable,
  ERC20Burnable,
  ERC20Detailed,
  Checkpointable,
  Permissionable,
  GSNRecipientSigned
{
  uint256 public constant INITIAL_SUPPLY = 0;

  string public constant MINTER_ROLE = "minter";
  string public constant BURNER_ROLE = "burner";
  string public constant PAUSER_ROLE = "pauser";
  string public constant FEE_MANAGER_ROLE = "fee_manager";
  string public constant TRANSFER_WL_MANAGER_ROLE = "transfer_wl_manager";

  uint256 public constant HUNDRED_PCT = 100 ether;

  event SetTransferFee(address indexed feeManager, uint256 share);
  event SetOpsFee(address indexed feeManager, uint256 value);
  event SetDistributor(uint256 newDistributor);
  event SetWhitelistAddress(address addr, bool isActive);
  event TransferWithMemo(address indexed from, address indexed to, uint256 value, string memo);

  // in 100 % == 100 eth
  uint256 public transferFee = 0;
  // in YAL wei
  uint256 public opsFee = 0;
  YALDistributor public yalDistributor;

  mapping(address => bool) public opsWhitelist;

  constructor(
    address _yalDistributorAddress,
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  )
    public
    ERC20Detailed(_name, _symbol, _decimals)
    Permissionable()
    GSNRecipientSigned()
  {
    yalDistributor = YALDistributor(_yalDistributorAddress);

    // TODO: setup each role explicitly
    _addRoleTo(msg.sender, MINTER_ROLE);
    _addRoleTo(msg.sender, BURNER_ROLE);
    _addRoleTo(msg.sender, PAUSER_ROLE);
    _addRoleTo(msg.sender, FEE_MANAGER_ROLE);
    // ROLE_MANAGER is assigned to the msg.sender in Permissionable()
  }

  modifier onlyMinter() {
    require(hasRole(msg.sender, MINTER_ROLE), "Only minter allowed");
    _;
  }
  
  modifier onlyBurner() {
    require(hasRole(msg.sender, BURNER_ROLE), "Only burner allowed");
    _;
  }

  modifier onlyFeeManager() {
    require(hasRole(msg.sender, FEE_MANAGER_ROLE), "Only fee manager allowed");
    _;
  }

  modifier onlyTransferWLManager() {
    require(hasRole(msg.sender, TRANSFER_WL_MANAGER_ROLE), "Only transfer_wl_manager allowed");
    _;
  }

  modifier onlyRoleManager() {
    require(hasRole(msg.sender, ROLE_ROLE_MANAGER), "Only role manager allowed");
    _;
  }

  // Uses Permissionable PAUSER_ROLE instead of PauserRole from OZ since
  // the last one has no explicit removeRole method.
  modifier onlyPauser() {
    require(hasRole(msg.sender, PAUSER_ROLE), "Only pauser allowed");
    _;
  }

  function _handleRelayedCall(
    bytes memory _encodedFunction,
    address _caller
  )
    internal
    view
    returns (GSNRecipientSignatureErrorCodes)
  {
    bytes4 signature = getDataSignature(_encodedFunction);

    address payer;

    if (
      signature == CoinToken(0).transfer.selector
      || signature == CoinToken(0).transferFrom.selector
      || signature == CoinToken(0).approve.selector
      || signature == CoinToken(0).transferWithMemo.selector
    ) {
      payer = _caller;
    } else {
      return GSNRecipientSignatureErrorCodes.METHOD_NOT_SUPPORTED;
    }

    if (canPayForGsnCall(payer)) {
      return GSNRecipientSignatureErrorCodes.OK;
    } else {
      return GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE;
    }
  }

  function _preRelayedCall(bytes memory _context) internal returns (bytes32) {
    address from = abi.decode(_context, (address));

    _transfer(from, address(this), opsFee);
  }

  // MANAGER INTERFACE

  function mint(address _account, uint256 _amount) public whenNotPaused onlyMinter returns (bool) {
    _mint(_account, _amount);
    _updateAccountCache(_account);

    return true;
  }

  function burn(address _account, uint256 _amount) public whenNotPaused onlyBurner {
    _burn(_account, _amount);
    _updateAccountCache(_account);
  }

  function setWhitelistAddress(address _addr, bool _isActive) public onlyTransferWLManager {
    opsWhitelist[_addr] = _isActive;

    emit SetWhitelistAddress(_addr, _isActive);
  }

  function setDistributor(uint256 _yalDistributor) public onlyRoleManager {
    yalDistributor = YALDistributor(_yalDistributor);

    emit SetDistributor(_yalDistributor);
  }

  function setTransferFee(uint256 _transferFee) public onlyFeeManager {
    require(_transferFee < HUNDRED_PCT, "Invalid fee value");

    transferFee = _transferFee;

    emit SetTransferFee(msg.sender, _transferFee);
  }

  function setOpsFee(uint256 _opsFee) public onlyFeeManager {
    opsFee = _opsFee;

    emit SetOpsFee(msg.sender, _opsFee);
  }

  function withdrawFee() public onlyFeeManager {
    address _this = address(this);
    uint256 _payout = balanceOf(_this);

    require(_payout > 0, "Nothing to withdraw");

    _transfer(_this, _msgSender(), _payout);

    _updateValueAtNow(_cachedBalances[address(this)], balanceOf(address(this)));
    _updateValueAtNow(_cachedBalances[_msgSender()], balanceOf(_msgSender()));
  }

  // USER INTERFACE

  function approve(address _spender, uint256 _amount) public returns (bool) {
    _requireMemberIsValid(_msgSender());
    _requireMemberIsValid(_spender);

    if (msg.sender == getHubAddr()) {
      _updateValueAtNow(_cachedBalances[address(this)], balanceOf(address(this)));
      _updateValueAtNow(_cachedBalances[_msgSender()], balanceOf(_msgSender()));
    }

    return super.approve(_spender, _amount);
  }

  function transfer(address _to, uint256 _value) public returns (bool) {
    _requireMemberIsValid(_to);
    _requireMemberIsValid(_msgSender());

    uint256 newValue = _takeFee(_msgSender(), _value);
    bool result = super.transfer(_to, newValue);

    _updateTransferCache(_msgSender(), _to);

    return result;
  }

  function transferWithMemo(address _to, uint256 _value, string calldata _memo) external returns (bool) {
    emit TransferWithMemo(_msgSender(), _to, _value, _memo);
    return transfer(_to, _value);
  }

  function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
    _requireMemberIsValid(_from);
    _requireMemberIsValid(_to);
    _requireMemberIsValid(_msgSender());

    uint256 newValue = _takeFee(_from, _value);

    _transfer(_from, _to, newValue);
    _approve(_from, _msgSender(), allowance(_from, _msgSender()).sub(_value, "ERC20: transfer amount exceeds allowance"));

    _updateTransferCache(_from, _to);

    return true;
  }

  // INTERNAL
  function _requireMemberIsValid(address _member) internal {
    require(isMemberValid(_member), "Member is invalid");
  }

  function _updateAccountCache(address _account) internal {
    _updateValueAtNow(_cachedBalances[_account], balanceOf(_account));
    _updateValueAtNow(_cachedTotalSupply, totalSupply());
  }

  function _updateTransferCache(address _from, address _to) internal {
    _updateValueAtNow(_cachedBalances[_from], balanceOf(_from));
    _updateValueAtNow(_cachedBalances[_to], balanceOf(_to));
    _updateValueAtNow(_cachedBalances[address(this)], balanceOf(address(this)));
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

  function isMemberValid(address _member) public view returns(bool) {
    return yalDistributor.isActive(_member) || opsWhitelist[_member] == true;
  }

  function canPayForGsnCall(address _addr) public view returns (bool) {
    return balanceOf(_addr) >= opsFee;
  }
}
