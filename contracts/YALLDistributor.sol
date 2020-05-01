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
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./interfaces/IYALLToken.sol";
import "./interfaces/IYALLDistributor.sol";
import "./GSNRecipientSigned.sol";
import "./registry/YALLRegistryHelpers.sol";
import "./traits/ACLPausable.sol";


/**
 * @title YALLDistributor contract
 * @author Galt Project
 * @notice Mints YALL tokens on request according pre-configured formula
 **/
contract YALLDistributor is
  IYALLDistributor,
  Initializable,
  YALLRegistryHelpers,
  ACLPausable,
  GSNRecipientSigned
{
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 public constant HUNDRED_PCT = 100 ether;

  event ActiveMemberCountChanged(uint256 activeMemberCount);
  event AddMember(bytes32 memberId, address memberAddress);
  event ChangeMemberAddress(bytes32 indexed memberId, address from, address to);
  event ChangeMyAddress(bytes32 indexed memberId, address from, address to);
  event ClaimFunds(bytes32 indexed memberId, address indexed addr, uint256 indexed periodId, uint256 amount);
  event ClaimEmissionPoolReward(uint256 indexed periodId, address to);
  event EnableMember(bytes32 indexed memberId, address indexed memberAddress);
  event DisableMember(bytes32 indexed memberId, address indexed memberAddress);
  event PeriodChange(
    uint256 newPeriodId,
    uint256 volume,
    uint256 rewardPerMember,
    uint256 emissionPoolReward,
    uint256 activeMemberCount
  );
  event SetGsnFee(uint256 value);
  event SetPeriodVolume(uint256 oldPeriodVolume, uint256 newPeriodVolume);
  event SetEmissionPoolRewardShare(uint256 rewardShare);

  struct Period {
    uint256 rewardPerMember;
    uint256 emissionPoolReward;
    bool verifierClaimedReward;
  }

  struct Member {
    bool active;
    address addr;
    uint256 createdAt;
    uint256 lastEnabledAt;
    uint256 lastDisabledAt;
    uint256 totalClaimed;
    // periodId => claimed
    mapping(uint256 => bool) claimedPeriods;
  }

  uint256 public genesisTimestamp;
  uint256 public periodLength;
  uint256 public periodVolume;

  uint256 public activeMemberCount;

  // 100% == 100 ether
  uint256 public emissionPoolRewardShare;
  // in YALL wei
  uint256 public gsnFee;

  // credentialsHash => memberDetails
  mapping(bytes32 => Member) public member;
  mapping(address => bytes32) public memberAddress2Id;

  // periodId => periodDetails
  mapping(uint256 => Period) public period;

  EnumerableSet.AddressSet internal activeAddressesCache;

  // Mints tokens, assigns the verifier reward and caches reward per member
  modifier triggerTransition() {
    uint256 currentPeriodId = getCurrentPeriodId();

    Period storage currentPeriod = period[currentPeriodId];

    if (currentPeriod.rewardPerMember == 0 && activeMemberCount > 0) {
      currentPeriod.emissionPoolReward = periodVolume.mul(emissionPoolRewardShare) / HUNDRED_PCT;

      // imbalance will be left at the contract
      // uint256 currentPeriodRewardPerMember = (periodVolume * (100 ether - emissionPoolRewardShare)) / (activeMemberCount * 100 ether);
      uint256 currentPeriodRewardPerMember = (periodVolume.mul(HUNDRED_PCT.sub(emissionPoolRewardShare)))
        .div(activeMemberCount.mul(HUNDRED_PCT));

      assert(currentPeriodRewardPerMember > 0);
      currentPeriod.rewardPerMember = currentPeriodRewardPerMember;

      emit PeriodChange(
        currentPeriodId,
        periodVolume,
        currentPeriodRewardPerMember,
        currentPeriod.emissionPoolReward,
        activeMemberCount
      );
    }

    _;
  }

  constructor() public {
  }

  function initialize(
    // can be changed later:
    uint256 _periodVolume,
    uint256 _emissionPoolRewardShare,

    // can't be changed later:
    address _yallRegistry,
    uint256 _periodLength,
    uint256 _genesisTimestamp
  )
    external
    initializer
  {
    periodVolume = _periodVolume;
    emissionPoolRewardShare = _emissionPoolRewardShare;

    yallRegistry = YALLRegistry(_yallRegistry);
    periodLength = _periodLength;
    genesisTimestamp = _genesisTimestamp;

    _upgradeRelayHub(DEFAULT_RELAY_HUB);
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

    if (signature == YALLDistributor(0).claimFunds.selector) {
      if (isCurrentPeriodClaimedByAddress(_caller) == false) {
        return (GSNRecipientSignatureErrorCodes.OK, abi.encode(_caller, signature));
      } else {
        return (GSNRecipientSignatureErrorCodes.DENIED, "");
      }
    } else if (signature == YALLDistributor(0).changeMyAddress.selector) {
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

    if (signature == YALLDistributor(0).changeMyAddress.selector) {
      _yallTokenIERC20().transferFrom(from, address(this), gsnFee);
    }
  }

  // DISTRIBUTOR MANAGER INTERFACE

  /*
   * @dev Changes a verifier reward share to a new one.
   * @param _emissionPoolRewardShare a new verifier reward share, 0 if there should be no reward for
   * a verifier; 100% == 100 ether
   */
  function setEmissionPoolRewardShare(uint256 _emissionPoolRewardShare) external onlyDistributorManager {
    require(_emissionPoolRewardShare < 100 ether, "YALLDistributor: Can't be >= 100%");

    emissionPoolRewardShare = _emissionPoolRewardShare;

    emit SetEmissionPoolRewardShare(_emissionPoolRewardShare);
  }

  /*
   * @dev Changes a periodVolume to a new value.
   * @param _periodVolume a new periodVolume value, 0 if the distribution should be disabled
   */
  function setPeriodVolume(uint256 _periodVolume) external onlyDistributorManager {
    uint256 oldPeriodVolume = periodVolume;

    periodVolume = _periodVolume;

    emit SetPeriodVolume(oldPeriodVolume, _periodVolume);
  }

  // FEE MANAGER INTERFACE

  function setGsnFee(uint256 _gsnFee) public onlyFeeManager {
    gsnFee = _gsnFee;

    emit SetGsnFee(_gsnFee);
  }

  // FEE CLAIMER INTERFACE

  function withdrawFee() external onlyFeeClaimer {
    address tokenAddress = _yallTokenAddress();
    uint256 payout = IERC20(tokenAddress).balanceOf(address(this));

    require(payout > 0, "YALLDistributor: Nothing to withdraw");

    IERC20(tokenAddress).transfer(msg.sender, payout.sub(IYALLToken(tokenAddress).transferFee()));
  }

  // VERIFIER INTERFACE

  /*
   * @dev Adds multiple members. To be called before genesisTimestamp
   * @param _memberIds unique credential keccack256() hashes
   * @param _memberAddresses corresponding to _memberIds addresses
   */
  function addMembersBeforeGenesis(
    bytes32[] calldata _memberIds,
    address[] calldata _memberAddresses
  )
    external
    onlyDistributorVerifier
  {
    require(now < genesisTimestamp, "YALLDistributor: Can be called before genesis only");

    _addMembers(_memberIds, _memberAddresses);
  }

  /*
   * @dev Adds multiple members. To be called after genesisTimestamp
   * @param _memberIds unique credential keccack256() hashes
   * @param _memberAddresses corresponding to _memberIds addresses
   */
  function addMembers(
    bytes32[] calldata _memberIds,
    address[] calldata _memberAddresses
  )
    external
    triggerTransition
    onlyDistributorVerifier
  {
    _addMembers(_memberIds, _memberAddresses);
  }

  /*
   * @dev Adds a single member
   * @param _memberId a unique credential keccack256()
   * @param _memberAddress corresponding to _memberIds address
   */
  function addMember(
    bytes32 _memberId,
    address _memberAddress
  )
    external
    triggerTransition
    onlyDistributorVerifier
  {
    _addMember(_memberId, _memberAddress);

    _incrementActiveMemberCount(1);
  }

  /*
   * @dev Activates multiple members
   * @param _memberAddresses to enable
   */
  function enableMembers(
    address[] calldata _memberAddresses
  )
    external
    triggerTransition
    onlyDistributorVerifier
  {
    uint256 len = _memberAddresses.length;

    require(len > 0, "YALLDistributor: Missing input members");

    for (uint256 i = 0; i < len; i++) {
      address addr = _memberAddresses[i];
      bytes32 memberId = memberAddress2Id[addr];
      Member storage m = member[memberId];
      require(m.active == false, "YALLDistributor: One of the members is active");
      require(m.createdAt != 0, "YALLDistributor: Member doesn't exist");

      m.active = true;
      m.lastEnabledAt = now;

      activeAddressesCache.add(addr);

      emit EnableMember(memberId, addr);
    }

    _incrementActiveMemberCount(len);
  }

  /*
   * @dev Deactivates multiple members
   * @param _memberAddresses to disable
   */
  function disableMembers(
    address[] calldata _memberAddresses
  )
    external
    triggerTransition
    onlyDistributorVerifier
  {
    uint256 len = _memberAddresses.length;

    require(len > 0, "YALLDistributor: Missing input members");

    for (uint256 i = 0; i < len; i++) {
      address addr = _memberAddresses[i];
      bytes32 memberId = memberAddress2Id[addr];
      Member storage m = member[memberId];
      require(m.active == true, "YALLDistributor: One of the members is inactive");
      require(m.createdAt != 0, "YALLDistributor: Member doesn't exist");

      m.active = false;
      m.lastDisabledAt = now;

      activeAddressesCache.remove(addr);

      emit DisableMember(memberId, addr);
    }

    _decrementActiveMemberCount(len);
  }

  /*
   * @dev Verifier changes multiple member addresses with a new ones. MemberIds remain the same.
   * @param _fromAddresses to change from
   * @param _toAddresses to change to
   */
  function changeMemberAddresses(
    address[] calldata _fromAddresses,
    address[] calldata _toAddresses
  )
    external
    onlyDistributorVerifier
  {
    uint256 len = _fromAddresses.length;
    require(len == _toAddresses.length, "YALLDistributor: Both ids and addresses array should have the same size");

    for (uint256 i = 0; i < len; i++) {
      _changeMemberAddress(_fromAddresses[i], _toAddresses[i]);
    }
  }

  /*
   * @dev Verifier changes a member address with a new one. MemberId remains the same.
   * @param _from address to change from
   * @param _to address to change to
   */
  function changeMemberAddress(address _from, address _to) external onlyDistributorVerifier {
    _changeMemberAddress(_from, _to);
  }

  /*
   * @dev Acts on behalf of multiple fund members, distributes funds to their corresponding addresses
   * @params _memberAddresses to claim funds for
   */
  function claimFundsMultiple(
    address[] calldata _memberAddresses
  )
    external
    triggerTransition
    whenNotPaused
    onlyDistributorVerifier
  {
    uint256 currentPeriodId = getCurrentPeriodId();
    uint256 rewardPerMember = period[currentPeriodId].rewardPerMember;
    uint256 currentPeriodBeginsAt = getCurrentPeriodBeginsAt();

    uint256 len = _memberAddresses.length;

    for (uint256 i = 0; i < len; i++) {
      _claimFunds(
        _memberAddresses[i],
        rewardPerMember,
        currentPeriodId,
        currentPeriodBeginsAt
      );
    }
  }

  // VERIFIER INTERNAL INTERFACE

  function _addMembers(bytes32[] memory _memberIds, address[] memory _memberAddresses) internal {
    uint256 len = _memberIds.length;

    require(len > 0, "YALLDistributor: Missing input members");
    require(len == _memberAddresses.length, "YALLDistributor: ID and address arrays length should match");

    for (uint256 i = 0; i < len; i++) {
      _addMember(_memberIds[i], _memberAddresses[i]);
    }

    _incrementActiveMemberCount(len);
  }

  function _addMember(bytes32 _memberId, address _memberAddress) internal {
    require(memberAddress2Id[_memberAddress] == bytes32(0), "YALLDistributor: The address already registered");

    memberAddress2Id[_memberAddress] = _memberId;

    Member storage m = member[_memberId];

    m.addr = _memberAddress;
    m.active = true;
    m.createdAt = now;

    activeAddressesCache.add(_memberAddress);

    emit AddMember(_memberId, _memberAddress);
  }

  function _changeMemberAddress(address _from, address _to) internal {
    bytes32 memberId = memberAddress2Id[_from];
    Member storage m = member[memberId];
    address from = m.addr;

    require(m.createdAt != 0, "YALLDistributor: Member doesn't exist");
    require(memberAddress2Id[_to] == bytes32(0), "YALLDistributor: Address is already taken by another member");
    require(_from != _to, "YALLDistributor: Can't migrate to the same address");

    m.addr = _to;

    memberAddress2Id[from] = bytes32(0);
    memberAddress2Id[_to] = memberId;

    activeAddressesCache.remove(from);
    activeAddressesCache.add(_to);

    uint256 memberBalance = _yallTokenIERC20().balanceOf(from);
    if (memberBalance > 0) {
      IYALLToken token = _yallToken();
      token.burn(_from, memberBalance);
      token.mint(_to, memberBalance);
    }

    emit ChangeMemberAddress(memberId, from, _to);
  }

  function _incrementActiveMemberCount(uint256 _n) internal {
    uint256 newActiveMemberCount = activeMemberCount.add(_n);
    activeMemberCount = newActiveMemberCount;

    emit ActiveMemberCountChanged(newActiveMemberCount);
  }

  function _decrementActiveMemberCount(uint256 _n) internal {
    uint256 newActiveMemberCount = activeMemberCount.sub(_n);
    activeMemberCount = newActiveMemberCount;

    emit ActiveMemberCountChanged(newActiveMemberCount);
  }

  // EMISSION CLAIMER INTERFACE

  /*
   * @dev Emission claimer claims their reward for the given period.
   * @param _periodId to claim reward for
   * @param _to address to send reward to
   */
  function claimEmissionPoolReward(
    uint256 _periodId,
    address _to
  )
    external
    triggerTransition
    whenNotPaused
    onlyDistributorEmissionClaimer
  {
    Period storage givenPeriod = period[_periodId];

    require(givenPeriod.verifierClaimedReward == false, "YALLDistributor: Already claimed for given period");

    givenPeriod.verifierClaimedReward = true;

    emit ClaimEmissionPoolReward(_periodId, _to);

    _yallToken().mint(_to, givenPeriod.emissionPoolReward);
  }

  // MEMBER INTERFACE

  /*
   * @dev Claims member funds
   * @params _memberAddress to claim funds for
   */
  function claimFunds() external triggerTransition whenNotPaused {
    uint256 currentPeriodId = getCurrentPeriodId();

    _claimFunds(
      _msgSender(),
      period[currentPeriodId].rewardPerMember,
      currentPeriodId,
      getCurrentPeriodBeginsAt()
    );
  }

  function _claimFunds(
    address _memberAddress,
    uint256 _rewardPerMember,
    uint256 _currentPeriodId,
    uint256 _currentPeriodStart
  )
    internal
  {
    _requireCanClaimFunds(
      _memberAddress,
      _currentPeriodId,
      _currentPeriodStart
    );

    bytes32 memberId = memberAddress2Id[_memberAddress];
    Member storage m = member[memberId];

    m.claimedPeriods[_currentPeriodId] = true;

    m.totalClaimed = m.totalClaimed.add(_rewardPerMember);

    emit ClaimFunds(memberId, _memberAddress, _currentPeriodId, _rewardPerMember);

    _yallToken().mint(_memberAddress, _rewardPerMember);
  }

  function _requireCanClaimFunds(
    address _memberAddress,
    uint256 _currentPeriodId,
    uint256 _currentPeriodStart
  )
    internal
    view
  {
    bytes32 memberId = memberAddress2Id[_memberAddress];
    Member storage m = member[memberId];

    require(m.active == true, "YALLDistributor: Not active member");
    require(m.addr == _memberAddress, "YALLDistributor: Address doesn't match");

    require(m.createdAt < _currentPeriodStart, "YALLDistributor: Can't assign rewards for the creation period");
    require(m.claimedPeriods[_currentPeriodId] == false, "YALLDistributor: Already claimed for the current period");

    if (m.lastDisabledAt != 0 && _currentPeriodId != 0) {
      // last disabled at
      uint256 ld = m.lastDisabledAt;
      // last enabled at
      uint256 le = m.lastEnabledAt;
      uint256 previousPeriodStart = getPreviousPeriodBeginsAt();

      require(
        // both disabled and enabled in the current period
        (ld >= _currentPeriodStart && le >= _currentPeriodStart)
        // both disabled and enabled in the previous period
        // TODO: check that this line is still required
        || (ld >= previousPeriodStart && le >= previousPeriodStart && ld < _currentPeriodStart && le < _currentPeriodStart)
        // both disabled and enabled before the current period started
        || (ld < _currentPeriodStart && le < _currentPeriodStart),
        "YALLDistributor: One period should be skipped after re-enabling"
      );
    }
  }

  /*
   * @dev A member changes his address with a new one. MemberId remains the same.
   * @param _to address to change to
   */
  function changeMyAddress(address _to) external whenNotPaused {
    bytes32 memberId = memberAddress2Id[_msgSender()];
    Member storage m = member[memberId];
    require(m.addr == _msgSender(), "YALLDistributor: Only the member allowed");

    _changeMemberAddress(_msgSender(), _to);

    emit ChangeMyAddress(memberId, _msgSender(), _to);
  }

  // PERMISSIONLESS INTERFACE

  /*
   * @dev Anyone can trigger period transition
   */
  function handlePeriodTransitionIfRequired() external triggerTransition {
    // solhint-disable-previous-line no-empty-blocks
  }

  // GETTERS

  function getCurrentPeriodId() public view returns (uint256) {
    uint256 blockTimestamp = block.timestamp;

    require(blockTimestamp > genesisTimestamp, "YALLDistributor: Contract not initiated yet");

    // return (blockTimestamp - genesisTimestamp) / periodLength;
    return (blockTimestamp.sub(genesisTimestamp)) / periodLength;
  }

  function getPreviousPeriodBeginsAt() public view returns (uint256) {
    uint256 currentPeriodId = getCurrentPeriodId();

    require(currentPeriodId > 0, "YALLDistributor: No previous period");

    // return ((getCurrentPeriod() - 1) * periodLength) + genesisTimestamp;
    return ((currentPeriodId - 1).mul(periodLength)).add(genesisTimestamp);
  }

  function getNextPeriodBeginsAt() public view returns (uint256) {
    // return ((getCurrentPeriod() + 1) * periodLength) + genesisTimestamp;
    return ((getCurrentPeriodId() + 1).mul(periodLength)).add(genesisTimestamp);
  }

  function getCurrentPeriodBeginsAt() public view returns (uint256) {
    // return (getCurrentPeriod() * periodLength) + genesisTimestamp;
    return (getCurrentPeriodId().mul(periodLength)).add(genesisTimestamp);
  }

  function requireCanClaimFundsByAddress(address _memberAddress) external view whenNotPaused {
    _requireCanClaimFunds(
      _memberAddress,
      getCurrentPeriodId(),
      getCurrentPeriodBeginsAt()
    );
  }

  function getActiveAddressList() external view returns (address[] memory) {
    return activeAddressesCache.enumerate();
  }

  function getActiveAddressSize() external view returns (uint256) {
    return activeAddressesCache.length();
  }

  function isCurrentPeriodClaimedByMember(bytes32 _memberId) external view returns (bool) {
    return member[_memberId].claimedPeriods[getCurrentPeriodId()];
  }

  function isCurrentPeriodClaimedByAddress(address _memberAddress) public view returns (bool) {
    return member[memberAddress2Id[_memberAddress]].claimedPeriods[getCurrentPeriodId()];
  }

  function isPeriodClaimedByMember(bytes32 _memberId, uint256 _periodId) external view returns (bool) {
    return member[_memberId].claimedPeriods[_periodId];
  }

  function isPeriodClaimedByAddress(address _memberAddress, uint256 _periodId) external view returns (bool) {
    return member[memberAddress2Id[_memberAddress]].claimedPeriods[_periodId];
  }

  function isActive(address _addr) external view returns (bool) {
    return member[memberAddress2Id[_addr]].active;
  }

  function getTotalClaimed(bytes32 _memberId) external view returns (uint256) {
    return member[_memberId].totalClaimed;
  }

  function getMemberAddress(bytes32 _memberId) external view returns (address) {
    return member[_memberId].addr;
  }

  function getMemberByAddress(address _memberAddress) external view returns (
    bytes32 id,
    bool active,
    address addr,
    uint256 createdAt,
    uint256 lastEnabledAt,
    uint256 lastDisabledAt,
    uint256 totalClaimed
  ) {
    bytes32 memberId = memberAddress2Id[_memberAddress];
    Member storage m = member[memberId];
    return (
      memberId,
      m.active,
      m.addr,
      m.createdAt,
      m.lastEnabledAt,
      m.lastDisabledAt,
      m.totalClaimed
    );
  }
}
