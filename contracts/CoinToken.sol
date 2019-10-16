/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 * 
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol";

contract CoinToken is MintableToken, PausableToken, BurnableToken, RBAC {
  // solium-disable-next-line uppercase
  string public name;

  // solium-disable-next-line uppercase
  string public symbol;

  // solium-disable-next-line uppercase
  uint8 public constant decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 0;

  string public constant MINTER_ROLE = "minter";
  string public constant BURNER_ROLE = "burner";
  string public constant FEE_MANAGER_ROLE = "fee_manager";

  uint256 public constant feePrecision = 1 szabo;
  uint256 public transferFee = 0;

  constructor(string _name, string _symbol) public MintableToken() {
    name = _name;
    symbol = _symbol;
    
    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
    emit Transfer(address(0), msg.sender, INITIAL_SUPPLY);

    super.addRole(msg.sender, MINTER_ROLE);
    super.addRole(msg.sender, BURNER_ROLE);
    super.addRole(msg.sender, FEE_MANAGER_ROLE);
  }
  
  modifier hasMintPermission() {
    require(hasRole(msg.sender, MINTER_ROLE), "Only minter");
    _;
  }
  
  modifier hasBurnPermission() {
    require(hasRole(msg.sender, BURNER_ROLE), "Only burner");
    _;
  }

  modifier hasFeeManagerPermission() {
    require(hasRole(msg.sender, FEE_MANAGER_ROLE), "Only fee manager");
    _;
  }

  function addRoleTo(address _operator, string _role) public onlyOwner {
    super.addRole(_operator, _role);
  }

  function removeRoleFrom(address _operator, string _role) public onlyOwner {
    super.removeRole(_operator, _role);
  }

  function transfer(address _to, uint256 _value) public returns (bool) {
    uint256 _newValue = takeFee(msg.sender, _value);
    return super.transfer(_to, _newValue);
  }

  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    uint256 _newValue = takeFee(_from, _value);
    return super.transferFrom(_from, _to, _newValue);
  }
  
  function takeFee(address from, uint256 _value) private returns(uint256) {
    uint256 _fee = getFeeForAmount(_value);

    balances[address(this)] = balances[address(this)].add(_fee);
    balances[from] = balances[from].sub(_fee);
    
    return _value.sub(_fee);
  }
  
  function getFeeForAmount(uint256 amount) public view returns(uint256) {
    if (transferFee > 0) {
      return amount.div(100).mul(transferFee).div(feePrecision);
    } else {
      return 0;
    }
  }
  
  function setTransferFee(uint256 _transferFee) public hasFeeManagerPermission {
    transferFee = _transferFee;
  }

  function withdrawFee() public hasFeeManagerPermission {
    require(balances[address(this)] > 0, "Nothing to withdraw");
    
    uint256 _payout = balances[address(this)];
    
    balances[msg.sender] = balances[msg.sender].add(_payout);
    balances[address(this)] = 0;

    emit Transfer(address(this), msg.sender, _payout);
  }
}
