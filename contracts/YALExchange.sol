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
import "./interfaces/ICoinToken.sol";
import "./GSNRecipientSigned.sol";
import "./traits/OwnedAccessControl.sol";
import "./traits/PauserRole.sol";


/**
 * @title YALExchange contract
 * @author Galt Project
 * @notice Exchange YAL to another currency
 **/
contract YALExchange is OwnableAndInitializable, OwnedAccessControl, PauserRole, GSNRecipientSigned {
  using SafeMath for uint256;

  event CloseOrder(uint256 indexed orderId, address operator);
  event CancelOrder(uint256 indexed orderId, address operator, string reason);
  event CreateOrder(uint256 indexed orderId, bytes32 indexed memberId, uint256 yalAmount, uint256 buyAmount);
  event SetDefaultExchangeRate(address indexed fundManager, uint256 defaultExchangeRate);
  event SetCustomExchangeRate(address indexed fundManager, bytes32 indexed memberId, uint256 memberExchangeRate);
  event SetTotalPeriodLimit(address indexed fundManager, uint256 defaultPeriodLimit);
  event SetDefaultMemberPeriodLimit(address indexed fundManager, uint256 memberPeriodLimit);
  event SetCustomPeriodLimit(address indexed fundManager, bytes32 indexed memberId, uint256 memberPeriodLimit);
  event SetGsnFee(address indexed fundManager, uint256 value);
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
    uint256 createdAtPeriod;
    string paymentDetails;
  }

  struct Member {
    uint256 customExchangeRate;
    uint256 customPeriodLimit;

    uint256 totalExchanged;
    uint256 totalVoided;

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
  uint256 public defaultMemberPeriodLimit;
  uint256 public totalPeriodLimit;
  uint256 public gsnFee;

  // Caches
  uint256 public totalExchangedYal;

  // memberId => details
  mapping(bytes32 => Member) public members;

  // orderId => details
  mapping(uint256 => Order) public orders;

  // periodId => totalExchanged
  mapping(uint256 => uint256) public yalExchangedByPeriod;

  modifier onlyFundManager() {
    require(hasRole(msg.sender, FUND_MANAGER_ROLE), "YALExchange: Only fund manager role allowed");

    _;
  }

  modifier onlyOperator() {
    require(hasRole(msg.sender, OPERATOR_ROLE), "YALExchange: Only operator role allowed");

    _;
  }

  modifier onlySuperOperator() {
    require(hasRole(msg.sender, SUPER_OPERATOR_ROLE), "YALExchange: Only super operator role allowed");

    _;
  }

  constructor() public {
  }

  function initialize(
    address _initialOwner,
    address _yalDistributor,
    address _yalToken,
    uint256 _defaultExchangeRate
  )
    initializeWithOwner(_initialOwner)
    external
  {
    require(_defaultExchangeRate > 0, "YALExchange: Default rate can't be 0");
    require(_yalDistributor != address(0), "YALExchange: YALDistributor address can't be 0");
    require(_yalToken != address(0), "YALExchange: YALToken address can't be 0");

    yalDistributor = IYALDistributor(_yalDistributor);
    yalToken = IERC20(_yalToken);

    defaultExchangeRate = _defaultExchangeRate;

    emit SetDefaultExchangeRate(msg.sender, _defaultExchangeRate);
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

    if (signature == YALExchange(0).createOrder.selector) {

      if (yalToken.balanceOf(_caller) >= gsnFee && yalToken.allowance(_caller, address(this)) >= gsnFee) {
        return (GSNRecipientSignatureErrorCodes.OK, abi.encode(_caller, signature));
      } else {
        return (GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE, "");
      }
    } else {
      return (GSNRecipientSignatureErrorCodes.METHOD_NOT_SUPPORTED, "");
    }
  }

  function _preRelayedCall(bytes memory _context) internal returns (bytes32) {
    (address from, bytes4 signature) = abi.decode(_context, (address,bytes4));

    if (signature == YALExchange(0).createOrder.selector) {
      yalToken.transferFrom(from, address(this), gsnFee);
    }
  }

  // FUND MANAGER INTERFACE

  /**
   * @dev Sets a default exchange rate
   * @param _defaultExchangeRate 100% == 100 ETH
   */
  function setDefaultExchangeRate(uint256 _defaultExchangeRate) external onlyFundManager {
    require(_defaultExchangeRate > 0, "YALExchange: Default rate can't be 0");

    defaultExchangeRate = _defaultExchangeRate;

    emit SetDefaultExchangeRate(msg.sender, _defaultExchangeRate);
  }

  /**
   * @dev Sets a particular member exchange rate by its id
   * @param _memberId to set exchange rate for
   * @param _customExchangeRate 100% == 100 ETH; set to 0 to disable custom rate and use the default one
   */
  function setCustomExchangeRate(bytes32 _memberId, uint256 _customExchangeRate) external onlyFundManager {
    members[_memberId].customExchangeRate = _customExchangeRate;

    emit SetCustomExchangeRate(msg.sender, _memberId, _customExchangeRate);
  }

  /**
   * @dev Sets a total period exchange limit for all users
   * @param _totalPeriodLimit in YAL
   */
  function setTotalPeriodLimit(uint256 _totalPeriodLimit) external onlyFundManager {
    totalPeriodLimit = _totalPeriodLimit;

    emit SetTotalPeriodLimit(msg.sender, _totalPeriodLimit);
  }

  /**
   * @dev Sets a member exchange limit for a period
   * @param _defaultMemberPeriodLimit in YAL; set to 0 to disable member limit
   */
  function setDefaultMemberPeriodLimit(uint256 _defaultMemberPeriodLimit) external onlyFundManager {
    defaultMemberPeriodLimit = _defaultMemberPeriodLimit;

    emit SetDefaultMemberPeriodLimit(msg.sender, _defaultMemberPeriodLimit);
  }

  /**
   * @dev Sets a particular member exchange limit for a period
   * @param _memberId to set limit for
   * @param _customPeriodLimit in YAL; set to 0 to disable custom limit and use the default one
   */
  function setCustomPeriodLimit(bytes32 _memberId, uint256 _customPeriodLimit) external onlyFundManager {
    members[_memberId].customPeriodLimit = _customPeriodLimit;

    emit SetCustomPeriodLimit(msg.sender, _memberId, _customPeriodLimit);
  }

  /**
   * @dev Sets a default GSN fee
   */
  function setGsnFee(uint256 _gsnFee) public onlyFundManager {
    gsnFee = _gsnFee;

    emit SetGsnFee(msg.sender, _gsnFee);
  }

  /**
   * @dev Withdraws almost all YAL tokens
   * It keeps a small percent of tokens to reduce gas cost for further transfer operations with this address using GSN.
   */
  function withdrawYALs() public onlyFundManager {
    uint256 _payout = yalToken.balanceOf(address(this));

    require(_payout > 0, "YALExchange: Nothing to withdraw");

    // NOTICE: will keep a small amount of YAL tokens
    yalToken.transfer(msg.sender, _payout.sub(ICoinToken(address(yalToken)).transferFee()));
  }

  // OPERATOR INTERFACE

  /**
   * @dev An operator successfully closes an exchange order
   * @param _orderId to close
   * @param _paymentDetails like bank tx number
   */
  function closeOrder(uint256 _orderId, string calldata _paymentDetails) external onlyOperator {
    Order storage o = orders[_orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.OPEN, "YALExchange: Order should be open");

    o.status = OrderStatus.CLOSED;
    o.paymentDetails = _paymentDetails;

    emit CloseOrder(_orderId, msg.sender);

    yalToken.transfer(msg.sender, o.yalAmount);
  }

  /**
   * @dev An operator cancels an order failed due some reason
   * @param _orderId to cancel
   * @param _cancelReason description
   */
  function cancelOrder(uint256 _orderId, string calldata _cancelReason) external onlyOperator {
    Order storage o = orders[_orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.OPEN, "YALExchange: Order should be open");

    o.status = OrderStatus.CANCELLED;

    m.totalExchanged = m.totalExchanged.sub(o.yalAmount);
    m.yalExchangedByPeriod[o.createdAtPeriod] = m.yalExchangedByPeriod[o.createdAtPeriod].sub(o.yalAmount);

    yalExchangedByPeriod[o.createdAtPeriod] = yalExchangedByPeriod[o.createdAtPeriod].sub(o.yalAmount);
    totalExchangedYal = totalExchangedYal.sub(o.yalAmount);

    emit CancelOrder(_orderId, msg.sender, _cancelReason);

    yalToken.transfer(yalDistributor.getMemberAddress(o.memberId), o.yalAmount);
  }

  // SUPER OPERATOR INTERFACE

  /**
   * @dev A super operator voids an already closed order and refunds deposited YALs
   * @param _orderId to void
   */
  function voidOrder(uint256 _orderId) external onlySuperOperator {
    Order storage o = orders[_orderId];
    address memberAddress = yalDistributor.getMemberAddress(o.memberId);
    uint256 yalAmount = o.yalAmount;

    require(o.status == OrderStatus.CLOSED, "YALExchange: Order should be closed");

    totalExchangedYal = totalExchangedYal.sub(yalAmount);
    members[o.memberId].totalExchanged = members[o.memberId].totalExchanged.sub(yalAmount);

    o.status = OrderStatus.VOIDED;
    emit VoidOrder(_orderId, msg.sender);

    yalToken.transferFrom(msg.sender, memberAddress, yalAmount);
  }

  // USER INTERFACE

  /**
   * @dev A user creates a new order with a specified amount to exchange
   * @param _yalAmount to exchange
   */
  function createOrder(uint256 _yalAmount) external whenNotPaused {
    require(_yalAmount > 0, "YALExchange: YAL amount can't be 0");

    address memberAddress = _msgSender();

    require(yalDistributor.isActive(memberAddress), "YALExchange: Member isn't active");

    bytes32 memberId = yalDistributor.memberAddress2Id(memberAddress);
    uint256 currentPeriod = yalDistributor.getCurrentPeriodId();

    // Limit #1 check
    require(_yalAmount <= calculateMaxYalToSell(memberId), "YALExchange: YAL amount exceeds Limit #1");

    // Limit #2 check
    requireLimit2NotReached(memberId, _yalAmount, currentPeriod);

    // Limit #3 check
    requireLimit3NotReached(memberId, _yalAmount, currentPeriod);

    uint256 buyAmount = calculateBuyAmount(memberId, _yalAmount);

    uint256 orderId = nextId();
    Order storage o = orders[orderId];
    Member storage m = members[memberId];

    require(o.status == OrderStatus.NULL, "YALExchange: Invalid status");

    o.memberId = memberId;
    o.status = OrderStatus.OPEN;
    o.createdAt = now;
    o.buyAmount = buyAmount;
    o.yalAmount = _yalAmount;
    o.createdAtPeriod = currentPeriod;

    m.totalExchanged = m.totalExchanged.add(_yalAmount);
    m.yalExchangedByPeriod[currentPeriod] = m.yalExchangedByPeriod[currentPeriod].add(_yalAmount);

    yalExchangedByPeriod[currentPeriod] = yalExchangedByPeriod[currentPeriod].add(_yalAmount);
    totalExchangedYal = totalExchangedYal.add(_yalAmount);

    emit CreateOrder(orderId, memberId, _yalAmount, buyAmount);

    yalToken.transferFrom(_msgSender(), address(this), _yalAmount);
  }

  function calculateBuyAmount(bytes32 _memberId, uint256 _yalAmount) public returns(uint256) {
    return _yalAmount
      .mul(calculateMemberExchangeRate(_memberId, _yalAmount))
      .div(RATE_DIVIDER);
  }

  function calculateMemberExchangeRate(bytes32 _memberId, uint256 _yalAmount) public returns(uint256) {
    uint256 rate = members[_memberId].customExchangeRate;

    if (rate == 0) {
      return defaultExchangeRate;
    }

    return rate;
  }

  // INTERNAL

  function nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }

  function requireLimit1NotReached(bytes32 _memberId, uint256 _yalAmount) internal {
    require(
      checkExchangeFitsLimit1(_memberId, _yalAmount),
      "YALExchange: exceeds Limit #1 (member volume)"
    );
  }

  function requireLimit2NotReached(bytes32 _memberId, uint256 _yalAmount, uint256 _periodId) internal {
    require(
      checkExchangeFitsLimit2(_memberId, _yalAmount, _periodId) == true,
      "YALExchange: exceeds Limit #2 (member period limit)"
    );
  }

  function requireLimit3NotReached(bytes32 _memberId, uint256 _yalAmount, uint256 _periodId) internal {
    require(
      checkExchangeFitsLimit3(_memberId, _yalAmount, _periodId) == true,
      "YALExchange: exceeds Limit #3 (total period limit)"
    );
  }

  // GETTERS

  function calculateMaxYalToSell(bytes32 _memberId) public view returns(uint256) {
    uint256 totalClaimed = yalDistributor.getTotalClaimed(_memberId);
    Member storage m = members[_memberId];

    return totalClaimed
      .sub(m.totalExchanged)
      .add(m.totalVoided);
  }

  function checkExchangeFitsLimit1(
    bytes32 _memberId,
    uint256 _yalAmount
  )
    public
    view
    returns (bool)
  {
    return _yalAmount <= calculateMaxYalToSell(_memberId);
  }

  function checkExchangeFitsLimit2(
    bytes32 _memberId,
    uint256 _yalAmount,
    uint256 _periodId
  )
    public
    view
    returns (bool)
  {
    Member storage m = members[_memberId];

    uint256 limit = m.customPeriodLimit;
    if (limit == 0) {
      limit = defaultMemberPeriodLimit;
    }

    if (limit != 0 && m.yalExchangedByPeriod[_periodId].add(_yalAmount) <= limit) {
      return true;
    }

    return false;
  }

  function checkExchangeFitsLimit3(
    bytes32 _memberId,
    uint256 _yalAmount,
    uint256 _periodId
  )
    public
    view
    returns (bool)
  {
    return yalExchangedByPeriod[_periodId].add(_yalAmount) <= totalPeriodLimit;
  }

  function getCustomExchangeRate(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].customExchangeRate;
  }

  function getCustomPeriodLimit(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].customPeriodLimit;
  }

  function getMemberYallExchangedInCurrentPeriod(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].yalExchangedByPeriod[yalDistributor.getCurrentPeriodId()];
  }

  function getMemberYallExchangedByPeriod(bytes32 _memberId, uint256 _periodId) external view returns (uint256) {
    return members[_memberId].yalExchangedByPeriod[_periodId];
  }
}
