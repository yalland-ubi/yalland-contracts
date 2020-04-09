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
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/IYALDistributor.sol";
import "./GSNRecipientSigned.sol";
import "./OwnedAccessControl.sol";


/**
 * @title YALExchange contract
 * @author Galt Project
 * @notice Exchange YAL to another currency
 **/
contract YALExchange is OwnableAndInitializable, OwnedAccessControl, GSNRecipientSigned {
  using SafeMath for uint256;

  event CloseOrder(uint256 indexed orderId, address operator);
  event CancelOrder(uint256 indexed orderId, address operator, string reason);
  event CreateOrder(uint256 indexed orderId, bytes32 indexed memberId, uint256 yalAmount, uint256 buyAmount);
  event SetDefaultExchangeRate(address indexed fundManager, uint256 defaultExchangeRate);
  event SetMemberExchangeRate(address indexed fundManager, bytes32 indexed memberId, uint256 memberExchangeRate);
  event SetDefaultPeriodLimit(address indexed fundManager, uint256 defaultPeriodLimit);
  event SetMemberPeriodLimit(address indexed fundManager, bytes32 indexed memberId, uint256 memberPeriodLimit);
  event VoidOrder(uint256 indexed orderId, address operator);

  enum OrderStatus {
    NULL,
    OPEN,
    CLOSED,
    CANCELLED,
    VOIDED
  }

  struct Order {
    OrderStatus status;
    bytes32 memberId;
    uint256 yalAmount;
    uint256 buyAmount;
    uint256 createdAt;
    string paymentDetails;
  }

  struct Member {
    uint256 exchangeRate;
    uint256 totalExchanged;
    uint256 totalVoided;
    uint256 totalOpen;
    uint256 periodLimit;

    // periodId => yal exchanged
    mapping(uint256 => uint256) yalExchangedByPeriod;
  }

  string public constant FUND_MANAGER_ROLE = "fund_manager";
  string public constant OPERATOR_ROLE = "operator";
  string public constant SUPER_OPERATOR_ROLE = "super_operator";

  uint256 public constant RATE_DIVIDER = 100 ether;

  uint256 internal idCounter;
  IERC20 public yalToken;
  IYALDistributor public yalDistributor;

  uint256 public defaultExchangeRate;
  uint256 public defaultPeriodLimit;

  // Caches
  uint256 public totalExchangedYal;

  // memberId => details
  mapping(bytes32 => Member) public members;

  // orderId => details
  mapping(uint256 => Order) public orders;

  modifier onlyFundManager() {
    require(hasRole(msg.sender, FUND_MANAGER_ROLE), "Only fund manager role allowed");

    _;
  }

  modifier onlyOperator() {
    require(hasRole(msg.sender, OPERATOR_ROLE), "Only operator role allowed");

    _;
  }

  modifier onlySuperOperator() {
    require(hasRole(msg.sender, SUPER_OPERATOR_ROLE), "Only super operator role allowed");

    _;
  }

  constructor() public {
  }

  function initialize(
    address _initialOwner,
    address _yalDistributor,
    address _yalToken
  )
    initializeWithOwner(_initialOwner)
    external
  {
    yalDistributor = IYALDistributor(_yalDistributor);
    yalToken = IERC20(_yalToken);
  }


  // FUND MANAGER INTERFACE
  function setDefaultExchangeRate(uint256 _defaultExchangeRate) external onlyFundManager {
    require(_defaultExchangeRate > 0, "Default rate can't be 0");

    defaultExchangeRate = _defaultExchangeRate;

    emit SetDefaultExchangeRate(msg.sender, _defaultExchangeRate);
  }

  // set to 0 to disable custom rate and use the default
  function setMemberExchangeRate(bytes32 _memberId, uint256 _memberExchangeRate) external onlyFundManager {
    members[_memberId].exchangeRate = _memberExchangeRate;

    emit SetMemberExchangeRate(msg.sender, _memberId, _memberExchangeRate);
  }

  // set to 0 for no limits
  function setDefaultPeriodLimit(uint256 _defaultPeriodLimit) external onlyFundManager {
    defaultPeriodLimit = _defaultPeriodLimit;

    emit SetDefaultPeriodLimit(msg.sender, _defaultPeriodLimit);
  }

  function withdrawYALs() public onlyFundManager {
    uint256 _payout = yalToken.balanceOf(address(this));

    require(_payout > 0, "Nothing to withdraw");

    yalToken.transfer(msg.sender, _payout);
  }

  // set to 0 to disable custom per member limit and use the default
  function setMemberPeriodLimit(bytes32 _memberId, uint256 _memberPeriodLimit) external onlyFundManager {
    members[_memberId].periodLimit = _memberPeriodLimit;

    emit SetMemberPeriodLimit(msg.sender, _memberId, _memberPeriodLimit);
  }

  // OPERATOR INTERFACE

  function closeOrder(uint256 _orderId, string calldata _paymentDetails) external onlyOperator {
    Order storage o = orders[_orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.OPEN, "Order should be open");

    uint256 currentPeriod = yalDistributor.getCurrentPeriodId();

    uint256 limit = m.periodLimit;
    if (limit == 0) {
      limit = defaultPeriodLimit;
    }

    if (limit > 0) {
      require(
        m.yalExchangedByPeriod[currentPeriod].add(o.yalAmount) <= limit,
        "Exchange amount exceeds the period limit"
      );
    }

    m.yalExchangedByPeriod[currentPeriod] = m.yalExchangedByPeriod[currentPeriod].add(o.yalAmount);

    o.status = OrderStatus.OPEN;
    o.paymentDetails = _paymentDetails;

    totalExchangedYal = totalExchangedYal.add(o.yalAmount);
    m.totalExchanged = m.totalExchanged.add(o.yalAmount);
    m.totalOpen = m.totalOpen.sub(o.yalAmount);

    emit CloseOrder(_orderId, msg.sender);

    yalToken.transferFrom(address(this), msg.sender, o.yalAmount);
  }

  function cancelOrder(uint256 _orderId, string calldata _cancelReason) external onlyOperator {
    Order storage o = orders[_orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.OPEN, "Order should be open");

    o.status = OrderStatus.CANCELLED;

    m.totalOpen = m.totalOpen.sub(o.yalAmount);

    emit CancelOrder(_orderId, msg.sender, _cancelReason);

    yalToken.transferFrom(address(this), yalDistributor.getMemberAddress(o.memberId), o.yalAmount);
  }

  // SUPER OPERATOR INTERFACE

  function voidOrder(uint256 _orderId) external onlySuperOperator {
    Order storage o = orders[_orderId];
    address memberAddress = yalDistributor.getMemberAddress(o.memberId);
    uint256 yalAmount = o.yalAmount;

    require(o.status == OrderStatus.CLOSED, "Order should be closed");

    totalExchangedYal = totalExchangedYal.sub(yalAmount);
    members[o.memberId].totalExchanged = members[o.memberId].totalExchanged.sub(yalAmount);

    o.status = OrderStatus.VOIDED;
    emit VoidOrder(_orderId, msg.sender);

    yalToken.transferFrom(msg.sender, memberAddress, yalAmount);
  }

  // USER INTERFACE

  function createOrder(uint256 _yalAmount) external {
    require(_yalAmount > 0, "YAL amount can't be 0");

    address memberAddress = _msgSender();

    require(yalDistributor.isActive(memberAddress));

    bytes32 memberId = yalDistributor.memberAddress2Id(memberAddress);

    require(_yalAmount <= calculateMaxYalToSell(memberId), "YAL amount exceeds the limit");

    uint256 rate = members[memberId].exchangeRate;

    if (rate == 0) {
      rate = defaultExchangeRate;
    }

    uint256 buyAmount = _yalAmount.mul(rate).div(RATE_DIVIDER);

    uint256 orderId = nextId();
    Order storage o = orders[orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.NULL, "Invalid status");

    o.memberId = memberId;
    o.status = OrderStatus.OPEN;
    o.createdAt = now;
    o.buyAmount = buyAmount;

    m.totalOpen = m.totalOpen.add(_yalAmount);

    emit CreateOrder(orderId, memberId, _yalAmount, buyAmount);

    yalToken.transferFrom(msg.sender, address(this), _yalAmount);
  }

  // INTERNAL

  function nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }

  // GETTERS

  function calculateMaxYalToSell(bytes32 _memberId) public view returns(uint256) {
    uint256 totalClaimed = yalDistributor.getTotalClaimed(_memberId);
    Member storage m = members[_memberId];

    return totalClaimed
      .sub(m.totalExchanged)
      .sub(m.totalOpen)
      .add(m.totalVoided);
  }
}
