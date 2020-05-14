/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./interfaces/IYALLDistributor.sol";
import "./interfaces/IYALLToken.sol";
import "./registry/YALLRegistryHelpers.sol";
import "./traits/ACLPausable.sol";
import "./interfaces/IYALLExchange.sol";
import "./traits/NumericIdCounter.sol";


/**
 * @title YALLExchangeCore contract
 * @author Galt Project
 * @notice YALLExchange Data Structure
 **/
contract YALLExchangeCore is
  IYALLExchange,
  Initializable,
  YALLRegistryHelpers,
  ACLPausable,
  NumericIdCounter
{
  using SafeMath for uint256;

  uint256 public constant RATE_DIVIDER = 100 ether;

  event CloseOrder(uint256 indexed orderId, address operator);
  event CancelOrder(uint256 indexed orderId, address operator, string reason);
  event CreateOrder(uint256 indexed orderId, bytes32 indexed memberId, uint256 yallAmount, uint256 buyAmount);
  event SetDefaultExchangeRate(address indexed fundManager, uint256 defaultExchangeRate);
  event SetCustomExchangeRate(address indexed fundManager, bytes32 indexed memberId, uint256 memberExchangeRate);
  event SetTotalPeriodLimit(address indexed fundManager, uint256 defaultPeriodLimit);
  event SetDefaultMemberPeriodLimit(address indexed fundManager, uint256 memberPeriodLimit);
  event SetCustomPeriodLimit(address indexed fundManager, bytes32 indexed memberId, uint256 memberPeriodLimit);
  event SetGsnFee(address indexed fundManager, uint256 value);
  event VoidOrder(uint256 indexed orderId, address operator);

  struct Order {
    OrderStatus status;
    bytes32 memberId;
    uint256 yallAmount;
    uint256 buyAmount;
    uint256 createdAt;
    uint256 createdAtPeriod;
    string paymentDetails;
  }

  struct Member {
    uint256 customExchangeRate;
    uint256 customPeriodLimit;

    uint256 totalExchanged;
    uint256 totalVoided;

    // periodId => yallToken exchanged
    mapping(uint256 => uint256) yallExchangedByPeriod;
  }

  uint256 internal idCounter;

  uint256 public defaultExchangeRate;
  uint256 public defaultMemberPeriodLimit;
  uint256 public totalPeriodLimit;
  uint256 public gsnFee;

  // Caches
  uint256 public totalExchangedYall;

  // memberId => details
  mapping(bytes32 => Member) public members;

  // orderId => details
  mapping(uint256 => Order) public orders;

  // periodId => totalExchanged
  mapping(uint256 => uint256) public yallExchangedByPeriod;

  constructor() public {
  }
}
