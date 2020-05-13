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
import "./GSNRecipientSigned.sol";
import "./registry/YALLRegistryHelpers.sol";
import "./traits/ACLPausable.sol";
import "./interfaces/IYALLExchange.sol";


/**
 * @title YALLExchange contract
 * @author Galt Project
 * @notice Exchange YALL to another currency
 **/
contract YALLExchange is
  IYALLExchange,
  Initializable,
  YALLRegistryHelpers,
  ACLPausable,
  GSNRecipientSigned
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

  function initialize(
    address _yallRegistry,
    uint256 _defaultExchangeRate
  )
    external
    initializer
  {
    require(_defaultExchangeRate > 0, "YALLExchange: Default rate can't be 0");
    require(_yallRegistry != address(0), "YALLExchange: YALLRegistry address can't be 0");

    yallRegistry = YALLRegistry(_yallRegistry);

    defaultExchangeRate = _defaultExchangeRate;

    _upgradeRelayHub(DEFAULT_RELAY_HUB);

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

    if (signature == YALLExchange(0).createOrder.selector) {
      IERC20 t = _yallTokenIERC20();

      if (t.balanceOf(_caller) >= gsnFee && t.allowance(_caller, address(this)) >= gsnFee) {
        return (GSNRecipientSignatureErrorCodes.OK, abi.encode(_caller, signature));
      } else {
        return (GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE, "");
      }
    } else {
      return (GSNRecipientSignatureErrorCodes.METHOD_NOT_SUPPORTED, "");
    }
  }

  function _preRelayedCall(bytes memory _context) internal returns (bytes32) {
    (address from, bytes4 signature) = abi.decode(_context, (address, bytes4));

    if (signature == YALLExchange(0).createOrder.selector) {
      _yallTokenIERC20().transferFrom(from, address(this), gsnFee);
    }
  }

  // EXCHANGE MANAGER INTERFACE

  /**
   * @dev Sets a default exchange rate
   * @param _defaultExchangeRate 100% == 100 ETH
   */
  function setDefaultExchangeRate(uint256 _defaultExchangeRate) external onlyExchangeFundManager {
    require(_defaultExchangeRate > 0, "YALLExchange: Default rate can't be 0");

    defaultExchangeRate = _defaultExchangeRate;

    emit SetDefaultExchangeRate(msg.sender, _defaultExchangeRate);
  }

  /**
   * @dev Sets a particular member exchange rate by its id
   * @param _memberId to set exchange rate for
   * @param _customExchangeRate 100% == 100 ETH; set to 0 to disable custom rate and use the default one
   */
  function setCustomExchangeRate(bytes32 _memberId, uint256 _customExchangeRate) external onlyExchangeFundManager {
    members[_memberId].customExchangeRate = _customExchangeRate;

    emit SetCustomExchangeRate(msg.sender, _memberId, _customExchangeRate);
  }

  /**
   * @dev Sets a total period exchange limit for all users
   * @param _totalPeriodLimit in YALL
   */
  function setTotalPeriodLimit(uint256 _totalPeriodLimit) external onlyExchangeFundManager {
    totalPeriodLimit = _totalPeriodLimit;

    emit SetTotalPeriodLimit(msg.sender, _totalPeriodLimit);
  }

  /**
   * @dev Sets a member exchange limit for a period
   * @param _defaultMemberPeriodLimit in YALL; set to 0 to disable member limit
   */
  function setDefaultMemberPeriodLimit(uint256 _defaultMemberPeriodLimit) external onlyExchangeFundManager {
    defaultMemberPeriodLimit = _defaultMemberPeriodLimit;

    emit SetDefaultMemberPeriodLimit(msg.sender, _defaultMemberPeriodLimit);
  }

  /**
   * @dev Sets a particular member exchange limit for a period
   * @param _memberId to set limit for
   * @param _customPeriodLimit in YALL; set to 0 to disable custom limit and use the default one
   */
  function setCustomPeriodLimit(bytes32 _memberId, uint256 _customPeriodLimit) external onlyExchangeFundManager {
    members[_memberId].customPeriodLimit = _customPeriodLimit;

    emit SetCustomPeriodLimit(msg.sender, _memberId, _customPeriodLimit);
  }

  // FEE MANAGER INTERFACE

  /**
   * @dev Sets a default GSN fee
   */
  function setGsnFee(uint256 _gsnFee) external onlyFeeManager {
    gsnFee = _gsnFee;

    emit SetGsnFee(msg.sender, _gsnFee);
  }

  // FEE CLAIMER INTERFACE

  /**
   * @dev Withdraws almost all YALL tokens
   * It keeps a small percent of tokens to reduce gas cost for further transfer operations with this address using GSN.
   */
  function withdrawYALLs() external onlyFeeClaimer {
    address tokenAddress = _yallTokenAddress();
    uint256 payout = IERC20(tokenAddress).balanceOf(address(this));

    require(payout > 0, "YALLExchange: Nothing to withdraw");

    // NOTICE: will keep a small amount of YALL tokens
    IERC20(tokenAddress).transfer(msg.sender, payout.sub(IYALLToken(tokenAddress).transferFee()));
  }

  // OPERATOR INTERFACE

  /**
   * @dev An operator successfully closes an exchange order
   * @param _orderId to close
   * @param _paymentDetails like bank tx number
   */
  function closeOrder(uint256 _orderId, string calldata _paymentDetails) external onlyExchangeOperator {
    Order storage o = orders[_orderId];

    require(o.status == OrderStatus.OPEN, "YALLExchange: Order should be open");

    o.status = OrderStatus.CLOSED;
    o.paymentDetails = _paymentDetails;

    emit CloseOrder(_orderId, msg.sender);

    _yallTokenIERC20().transfer(msg.sender, o.yallAmount);
  }

  /**
   * @dev An operator cancels an order failed due some reason
   * @param _orderId to cancel
   * @param _cancelReason description
   */
  function cancelOrder(uint256 _orderId, string calldata _cancelReason) external onlyExchangeOperator {
    Order storage o = orders[_orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.OPEN, "YALLExchange: Order should be open");

    o.status = OrderStatus.CANCELLED;

    m.totalExchanged = m.totalExchanged.sub(o.yallAmount);
    m.yallExchangedByPeriod[o.createdAtPeriod] = m.yallExchangedByPeriod[o.createdAtPeriod].sub(o.yallAmount);

    yallExchangedByPeriod[o.createdAtPeriod] = yallExchangedByPeriod[o.createdAtPeriod].sub(o.yallAmount);
    totalExchangedYall = totalExchangedYall.sub(o.yallAmount);

    emit CancelOrder(_orderId, msg.sender, _cancelReason);

    _yallTokenIERC20().transfer(_getMemberAddress(o.memberId), o.yallAmount);
  }

  // SUPER OPERATOR INTERFACE

  /**
   * @dev A super operator voids an already closed order and refunds deposited YALLs
   * @param _orderId to void
   */
  function voidOrder(uint256 _orderId) external onlyExchangeSuperOperator {
    Order storage o = orders[_orderId];
    address memberAddress = _getMemberAddress(o.memberId);
    uint256 yallAmount = o.yallAmount;

    require(o.status == OrderStatus.CLOSED, "YALLExchange: Order should be closed");

    totalExchangedYall = totalExchangedYall.sub(yallAmount);
    members[o.memberId].totalExchanged = members[o.memberId].totalExchanged.sub(yallAmount);

    o.status = OrderStatus.VOIDED;
    emit VoidOrder(_orderId, msg.sender);

    _yallTokenIERC20().transferFrom(msg.sender, memberAddress, yallAmount);
  }

  // USER INTERFACE

  /**
   * @dev A user creates a new order with a specified amount to exchange
   * @param _yallAmount to exchange
   */
  function createOrder(uint256 _yallAmount) external whenNotPaused {
    require(_yallAmount > 0, "YALLExchange: YALL amount can't be 0");

    address memberAddress = _msgSender();

    require(_isActiveAddress(memberAddress), "YALLExchange: Member isn't active");

    IYALLDistributor yallDistributor = _yallDistributor();
    bytes32 memberId = yallDistributor.memberAddress2Id(memberAddress);
    uint256 currentPeriod = yallDistributor.getCurrentPeriodId();

    // Limit #1 check
    requireLimit1NotReached(memberId, _yallAmount);

    // Limit #2 check
    requireLimit2NotReached(memberId, _yallAmount, currentPeriod);

    // Limit #3 check
    requireLimit3NotReached(_yallAmount, currentPeriod);

    uint256 buyAmount = calculateBuyAmount(memberId, _yallAmount);

    uint256 orderId = nextId();
    Order storage o = orders[orderId];
    Member storage m = members[memberId];

    require(o.status == OrderStatus.NULL, "YALLExchange: Invalid status");

    o.memberId = memberId;
    o.status = OrderStatus.OPEN;
    o.createdAt = now;
    o.buyAmount = buyAmount;
    o.yallAmount = _yallAmount;
    o.createdAtPeriod = currentPeriod;

    m.totalExchanged = m.totalExchanged.add(_yallAmount);
    m.yallExchangedByPeriod[currentPeriod] = m.yallExchangedByPeriod[currentPeriod].add(_yallAmount);

    yallExchangedByPeriod[currentPeriod] = yallExchangedByPeriod[currentPeriod].add(_yallAmount);
    totalExchangedYall = totalExchangedYall.add(_yallAmount);

    emit CreateOrder(orderId, memberId, _yallAmount, buyAmount);

    _yallTokenIERC20().transferFrom(_msgSender(), address(this), _yallAmount);
  }

  // INTERNAL

  function nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }

  function _isActiveAddress(address _addr) internal view returns(bool) {
    return _yallDistributor().isActive(_addr);
  }

  function _getTotalClaimed(bytes32 _memberId) internal view returns(uint256) {
    return _yallDistributor().getTotalClaimed(_memberId);
  }

  function _getMemberAddress(bytes32 _memberId) internal view returns(address) {
    return _yallDistributor().getMemberAddress(_memberId);
  }

  function requireLimit1NotReached(bytes32 _memberId, uint256 _yallAmount) internal view {
    require(
      checkExchangeFitsLimit1(_memberId, _yallAmount),
      "YALLExchange: exceeds Limit #1 (member volume)"
    );
  }

  function requireLimit2NotReached(bytes32 _memberId, uint256 _yallAmount, uint256 _periodId) internal view {
    require(
      checkExchangeFitsLimit2(_memberId, _yallAmount, _periodId) == true,
      "YALLExchange: exceeds Limit #2 (member period limit)"
    );
  }

  function requireLimit3NotReached(uint256 _yallAmount, uint256 _periodId) internal view {
    require(
      checkExchangeFitsLimit3(_yallAmount, _periodId) == true,
      "YALLExchange: exceeds Limit #3 (total period limit)"
    );
  }

  // GETTERS

  function calculateBuyAmount(bytes32 _memberId, uint256 _yallAmount) public view returns(uint256) {
    return _yallAmount
      .mul(calculateMemberExchangeRate(_memberId))
      .div(RATE_DIVIDER);
  }

  function calculateMemberExchangeRate(bytes32 _memberId) public view returns(uint256) {
    uint256 rate = members[_memberId].customExchangeRate;

    if (rate == 0) {
      return defaultExchangeRate;
    }

    return rate;
  }

  function calculateMaxYallToSell(bytes32 _memberId) public view returns(uint256) {
    uint256 totalClaimed = _getTotalClaimed(_memberId);
    Member storage m = members[_memberId];

    return totalClaimed
      .sub(m.totalExchanged)
      .add(m.totalVoided);
  }

  function calculateMaxYallToSellByAddress(address _memberAddress) external view returns(uint256) {
    return calculateMaxYallToSell(_yallDistributor().memberAddress2Id(_memberAddress));
  }

  function checkExchangeFitsLimit1(
    bytes32 _memberId,
    uint256 _yallAmount
  )
    public
    view
    returns (bool)
  {
    return _yallAmount <= calculateMaxYallToSell(_memberId);
  }

  function checkExchangeFitsLimit2(
    bytes32 _memberId,
    uint256 _yallAmount,
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

    return limit == 0 || m.yallExchangedByPeriod[_periodId].add(_yallAmount) <= limit;
  }

  function checkExchangeFitsLimit3(
    uint256 _yallAmount,
    uint256 _periodId
  )
    public
    view
    returns (bool)
  {
    return totalPeriodLimit == 0 || yallExchangedByPeriod[_periodId].add(_yallAmount) <= totalPeriodLimit;
  }

  function getCustomExchangeRate(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].customExchangeRate;
  }

  function getCustomPeriodLimit(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].customPeriodLimit;
  }

  function getMemberYallExchangedInCurrentPeriod(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].yallExchangedByPeriod[_yallDistributor().getCurrentPeriodId()];
  }

  function getMemberYallExchangedByPeriod(bytes32 _memberId, uint256 _periodId) external view returns (uint256) {
    return members[_memberId].yallExchangedByPeriod[_periodId];
  }
}
