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
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "./interfaces/IYALLDistributor.sol";
import "./GSNRecipientSigned.sol";
import "./registry/YALLRegistry.sol";
import "./interfaces/IYALLToken.sol";
import "./registry/YALLRegistryHelpers.sol";


contract YALLToken is
  IYALLToken,
  ERC20,
  ERC20Pausable,
  ERC20Detailed,
  YALLRegistryHelpers,
  GSNRecipientSigned
{
  uint256 public constant INITIAL_SUPPLY = 0;

  uint256 public constant HUNDRED_PCT = 100 ether;

  event SetTransferFee(address indexed feeManager, uint256 share);
  event SetGsnFee(address indexed feeManager, uint256 value);
  event SetDistributor(uint256 newDistributor);
  event SetWhitelistAddress(address addr, bool isActive);
  event TransferWithMemo(address indexed from, address indexed to, uint256 value, string memo);
  event Mint(address indexed minter, address indexed to, uint256 value);
  event Burn(address indexed burner, address indexed from, uint256 value);

  // in 100 % == 100 eth
  uint256 public transferFee = 0;
  // in YALL wei
  uint256 public gsnFee = 0;

  mapping(address => bool) public opsWhitelist;

  constructor(
    address _yallRegistry,
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  )
    public
    ERC20Detailed(_name, _symbol, _decimals)
    GSNRecipientSigned()
  {
    yallRegistry = YALLRegistry(_yallRegistry);
  }

  function _handleRelayedCall(
    bytes memory _encodedFunction,
    address _caller
  )
    internal
    view
    returns (GSNRecipientSignatureErrorCodes, bytes memory)
  {
    bytes4 signature = getDataSignature(_encodedFunction);

    address payer;

    if (
      signature == YALLToken(0).transfer.selector
      || signature == YALLToken(0).transferFrom.selector
      || signature == YALLToken(0).approve.selector
      || signature == YALLToken(0).transferWithMemo.selector
    ) {
      payer = _caller;
    } else {
      return (GSNRecipientSignatureErrorCodes.METHOD_NOT_SUPPORTED, "");
    }

    if (canPayForGsnCall(payer)) {
      return (GSNRecipientSignatureErrorCodes.OK, abi.encode(_caller));
    } else {
      return (GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE, "");
    }
  }

  function _preRelayedCall(bytes memory _context) internal returns (bytes32) {
    address from = abi.decode(_context, (address));

    _transfer(from, address(this), gsnFee);
  }

  // MANAGER INTERFACE

  function mint(address _account, uint256 _amount) public whenNotPaused onlyMinter returns (bool) {
    _mint(_account, _amount);

    emit Mint(msg.sender, _account, _amount);

    return true;
  }

  function burn(address _account, uint256 _amount) public whenNotPaused onlyBurner {
    _burn(_account, _amount);

    emit Burn(msg.sender, _account, _amount);
  }

  function setWhitelistAddress(address _addr, bool _isActive) public onlyTransferWLManager {
    opsWhitelist[_addr] = _isActive;

    emit SetWhitelistAddress(_addr, _isActive);
  }

  function setTransferFee(uint256 _transferFee) public onlyFeeManager {
    require(_transferFee < HUNDRED_PCT, "Invalid fee value");

    transferFee = _transferFee;

    emit SetTransferFee(msg.sender, _transferFee);
  }

  function setGsnFee(uint256 _gsnFee) public onlyFeeManager {
    gsnFee = _gsnFee;

    emit SetGsnFee(msg.sender, _gsnFee);
  }

  function withdrawFee() public onlyFeeClaimer {
    address _this = address(this);
    uint256 _payout = balanceOf(_this);

    require(_payout > 0, "Nothing to withdraw");

    _transfer(_this, _msgSender(), _payout);
  }

  // USER INTERFACE

  function approve(address _spender, uint256 _amount) public returns (bool) {
    _requireMemberIsValid(_msgSender());
    _requireMemberIsValid(_spender);

    return super.approve(_spender, _amount);
  }

  function transfer(address _to, uint256 _value) public returns (bool) {
    _requireMemberIsValid(_to);
    _requireMemberIsValid(_msgSender());

    bool result = super.transfer(_to, _value);

    _chargeTransferFee(_msgSender(), _value);

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

    bool result = super.transferFrom(_from, _to, _value);

    _chargeTransferFee(_msgSender(), _value);

    return result;
  }

  // INTERNAL
  function _requireMemberIsValid(address _member) internal view {
    require(isMemberValid(_member), "YALLToken: Member is invalid");
  }

  function _chargeTransferFee(address from, uint256 _value) private {
    uint256 _fee = getTransferFee(_value);

    if (_fee > 0) {
      require(balanceOf(from) >= _fee, "YALLToken: insufficient balance for paying a fee");
      _transfer(from, address(this), _fee);
    }
  }

  // GETTERS
  
  function getTransferFee(uint256 amount) public view returns(uint256) {
    if (transferFee > 0) {
      return amount.mul(transferFee) / HUNDRED_PCT;
    } else {
      return 0;
    }
  }

  function isMemberValid(address _member) public view returns(bool) {
    return IYALLDistributor(yallRegistry.getYallDistributorAddress()).isActive(_member) || opsWhitelist[_member] == true;
  }

  function canPayForGsnCall(address _addr) public view returns (bool) {
    return balanceOf(_addr) >= gsnFee;
  }
}
