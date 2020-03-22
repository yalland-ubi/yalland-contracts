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
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/ICoinToken.sol";
import "./GSNRecipientUserSignature.sol";


/**
 * @title YALDistributor contract
 * @author Galt Project
 * @notice Mints YAL tokens on request according pre-configured formula
 **/
contract YALDistributor is OwnableAndInitializable, GSNRecipientUserSignature {
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 public constant HUNDRED_PCT = 100 ether;

  event ActiveMemberCountChanged(uint256 activeMemberCount);
  event AddMember(bytes32 memberId, address memberAddress);
  event ChangeMemberAddress(bytes32 indexed memberId, address from, address to);
  event ChangeMyAddress(bytes32 indexed memberId, address from, address to);
  event ClaimFunds(bytes32 indexed memberId, address indexed addr, uint256 indexed periodId, uint256 amount);
  event ClaimVerifierReward(uint256 indexed periodId, address to);
  event EnableMember(bytes32 indexed memberId, address indexed memberAddress);
  event DisableMember(bytes32 indexed memberId, address indexed memberAddress);
  event PeriodChange(
    uint256 newPeriodId,
    uint256 volume,
    uint256 rewardPerMember,
    uint256 verifierReward,
    uint256 activeMemberCount
  );
  event Pause();
  event Unpause();
  event SetPeriodVolume(uint256 oldPeriodVolume, uint256 newPeriodVolume);
  event SetVerifier(address verifier);
  event SetVerifierRewardShare(uint256 rewardShare);

  struct Period {
    uint256 rewardPerMember;
    uint256 verifierReward;
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
  bool public paused;

  ICoinToken public token;
  uint256 public activeMemberCount;

  address public verifier;
  // 100% == 100 ether
  uint256 public verifierRewardShare;

  // credentialsHash => memberDetails
  mapping(bytes32 => Member) public member;
  mapping(address => bytes32) public memberAddress2Id;

  // periodId => periodDetails
  mapping(uint256 => Period) public period;

  EnumerableSet.AddressSet internal activeAddressesCache;

  modifier onlyVerifier() {
    require(msg.sender == verifier, "Only verifier allowed");

    _;
  }

  modifier whenNotPaused() {
    require(!paused, "Contract is paused");

    _;
  }

  // Mints tokens, assigns the verifier reward and caches reward per member
  modifier handlePeriodTransitionIfRequired() {
    uint256 currentPeriodId = getCurrentPeriodId();

    Period storage currentPeriod = period[currentPeriodId];

    if (currentPeriod.rewardPerMember == 0 && activeMemberCount > 0) {
      currentPeriod.verifierReward = periodVolume.mul(verifierRewardShare) / HUNDRED_PCT;

      // imbalance will be left at the contract
      // uint256 currentPeriodRewardPerMember = (periodVolume * (100 ether - verifierRewardShare)) / (activeMemberCount * 100 ether);
      uint256 currentPeriodRewardPerMember = (periodVolume.mul(HUNDRED_PCT.sub(verifierRewardShare))) / (activeMemberCount * HUNDRED_PCT);
      assert(currentPeriodRewardPerMember > 0);
      currentPeriod.rewardPerMember = currentPeriodRewardPerMember;

      emit PeriodChange(
        currentPeriodId,
        periodVolume,
        currentPeriodRewardPerMember,
        currentPeriod.verifierReward,
        activeMemberCount
      );
    }

    _;
  }

  constructor() public {
  }

  // @dev The Owner role will be assigned to tx.origin
  function initialize(
    // can be changed later:
    uint256 _periodVolume,
    address _verifier,
    uint256 _verifierRewardShare,

    // can't be changed later:
    address _token,
    uint256 _periodLength,
    uint256 _genesisTimestamp
  )
    external
    isInitializer
  {
    periodVolume = _periodVolume;
    verifier = _verifier;
    verifierRewardShare = _verifierRewardShare;

    token = ICoinToken(_token);
    periodLength = _periodLength;
    genesisTimestamp = _genesisTimestamp;
  }

  function _canExecuteRelayedCall(address _caller) internal view returns (bool) {
    return member[memberAddress2Id[_caller]].active;
  }

  // OWNER INTERFACE

  /*
   * @dev Changes a verifier address to a new one.
   * @param _verifier a new verifier address, address(0) if a verifier role is disabled
   */
  function setVerifier(address _verifier) external onlyOwner {
    verifier = _verifier;

    emit SetVerifier(_verifier);
  }

  /*
   * @dev Changes a verifier reward share to a new one.
   * @param _verifierRewardShare a new verifier reward share, 0 if there should be no reward for
   * a verifier; 100% == 100 ether
   */
  function setVerifierRewardShare(uint256 _verifierRewardShare) external onlyOwner {
    require(_verifierRewardShare < 100 ether, "Can't be >= 100%");

    verifierRewardShare = _verifierRewardShare;

    emit SetVerifierRewardShare(_verifierRewardShare);
  }

  /*
   * @dev Changes a periodVolume to a new value.
   * @param _periodVolume a new periodVolume value, 0 if the distribution should be disabled
   */
  function setPeriodVolume(uint256 _periodVolume) external onlyOwner {
    uint256 oldPeriodVolume = periodVolume;

    periodVolume = _periodVolume;

    emit SetPeriodVolume(oldPeriodVolume, _periodVolume);
  }

  /*
   * @dev Pauses contract.
   */
  function pause() external onlyOwner {
    require(paused == false, "Already paused");
    paused = true;
    emit Pause();
  }

  /*
   * @dev Pauses contract.
   */
  function unpause() external onlyOwner {
    require(paused == true, "Already unpaused");
    paused = false;
    emit Unpause();
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
    onlyVerifier
  {
    require(now < genesisTimestamp, "Can be called before genesis only");

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
    handlePeriodTransitionIfRequired
    onlyVerifier
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
    handlePeriodTransitionIfRequired
    onlyVerifier
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
    handlePeriodTransitionIfRequired
    onlyVerifier
  {
    uint256 len = _memberAddresses.length;

    require(len > 0, "Missing input members");

    for (uint256 i = 0; i < len; i++ ) {
      address addr = _memberAddresses[i];
      bytes32 memberId = memberAddress2Id[addr];
      Member storage member = member[memberId];
      require(member.active == false, "One of the members is active");
      require(member.createdAt != 0, "Member doesn't exist");

      member.active = true;
      member.lastEnabledAt = now;

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
    handlePeriodTransitionIfRequired
    onlyVerifier
  {
    uint256 len = _memberAddresses.length;

    require(len > 0, "Missing input members");

    for (uint256 i = 0; i < len; i++ ) {
      address addr = _memberAddresses[i];
      bytes32 memberId = memberAddress2Id[addr];
      Member storage member = member[memberId];
      require(member.active == true, "One of the members is inactive");
      require(member.createdAt != 0, "Member doesn't exist");

      member.active = false;
      member.lastDisabledAt = now;

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
  function changeMemberAddresses(address[] calldata _fromAddresses, address[] calldata _toAddresses) external onlyVerifier {
    uint256 len = _fromAddresses.length;
    require(len == _toAddresses.length, "Both ids and addresses array should have the same size");

    for(uint256 i = 0; i < len; i++) {
      _changeMemberAddress(_fromAddresses[i], _toAddresses[i]);
    }
  }

  /*
   * @dev Verifier changes a member address with a new one. MemberId remains the same.
   * @param _from address to change from
   * @param _to address to change to
   */
  function changeMemberAddress(address _from, address _to) external onlyVerifier {
    _changeMemberAddress(_from, _to);
  }

  /*
   * @dev Verifier claims their reward for the given period.
   * @param _periodId to claim reward for
   * @param _to address to send reward to
   */
  function claimVerifierReward(
    uint256 _periodId,
    address _to
  )
    external
    handlePeriodTransitionIfRequired
    whenNotPaused
    onlyVerifier
  {
    Period storage givenPeriod = period[_periodId];

    require(givenPeriod.verifierClaimedReward == false, "Already claimed for given period");

    givenPeriod.verifierClaimedReward = true;

    token.mint(_to, givenPeriod.verifierReward);

    emit ClaimVerifierReward(_periodId, _to);
  }

  // VERIFIER INTERNAL METHODS

  function _addMembers(bytes32[] memory _memberIds, address[] memory _memberAddresses) internal {
    uint256 len = _memberIds.length;

    require(len > 0, "Missing input members");
    require(len == _memberAddresses.length, "ID and address arrays length should match");

    for (uint256 i = 0; i < len; i++) {
      _addMember(_memberIds[i], _memberAddresses[i]);
    }

    _incrementActiveMemberCount(len);
  }

  function _addMember(bytes32 _memberId, address _memberAddress) internal {
    require(memberAddress2Id[_memberAddress] == bytes32(0), "The address already registered");

    memberAddress2Id[_memberAddress] = _memberId;

    Member storage member = member[_memberId];

    member.addr = _memberAddress;
    member.active = true;
    member.createdAt = now;

    activeAddressesCache.add(_memberAddress);

    emit AddMember(_memberId, _memberAddress);
  }

  function _changeMemberAddress(address _memberAddress, address _to) internal {
    bytes32 memberId = memberAddress2Id[_memberAddress];
    Member storage member = member[memberId];
    address from = member.addr;

    require(member.createdAt != 0, "Member doesn't exist");
    require(memberAddress2Id[_to] == bytes32(0), "Address is already taken by another member");

    member.addr = _to;

    memberAddress2Id[from] = bytes32(0);
    memberAddress2Id[_to] = memberId;

    activeAddressesCache.remove(from);
    activeAddressesCache.add(_to);

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

  // MEMBER INTERFACE

  /*
   * @dev Claims multiple member funds
   * @params _memberAddresses to claim funds for
   */
  function claimFundsMultiple(
    address[] calldata _memberAddresses
  )
    external
    handlePeriodTransitionIfRequired
    whenNotPaused
    onlyVerifier
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

  /*
   * @dev Claims member funds
   * @params _memberAddress to claim funds for
   */
  function claimFunds() external handlePeriodTransitionIfRequired whenNotPaused {
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
    bytes32 memberId = memberAddress2Id[_memberAddress];
    Member storage member = member[memberId];

    require(member.addr == _memberAddress, "Address doesn't match");
    require(member.active == true, "Not active member");

    require(member.createdAt < _currentPeriodStart, "Can't assign rewards for the creation period");
    require(member.claimedPeriods[_currentPeriodId] == false, "Already claimed for the current period");

    if (member.lastDisabledAt != 0 && _currentPeriodId != 0) {
      // last disabled at
      uint256 ld = member.lastDisabledAt;
      // last enabled at
      uint256 le = member.lastEnabledAt;
      uint256 previousPeriodStart = getPreviousPeriodBeginsAt();

      require(
        // both disabled and enabled in the current period
        (ld >= _currentPeriodStart && le >= _currentPeriodStart)
        // both disabled and enabled in the previous period
        || (ld >= previousPeriodStart && le >= previousPeriodStart && ld < _currentPeriodStart && le < _currentPeriodStart)
        // both disabled and enabled before the current period started
        || (ld < _currentPeriodStart && le < _currentPeriodStart),
        "One period should be skipped after re-enabling"
      );
    }

    member.claimedPeriods[_currentPeriodId] = true;

    member.totalClaimed = member.totalClaimed.add(_rewardPerMember);

    token.mint(_memberAddress, _rewardPerMember);

    emit ClaimFunds(memberId, _memberAddress, _currentPeriodId, _rewardPerMember);
  }

  /*
   * @dev A member changes his address with a new one. MemberId remains the same.
   * @param _to address to change to
   */
  function changeMyAddress(address _to) external whenNotPaused {
    address from = _msgSender();
    bytes32 memberId = memberAddress2Id[from];
    Member storage member = member[memberId];

    require(member.addr == _msgSender(), "Only the member allowed");
    require(member.createdAt != 0, "Member doesn't exist");
    require(memberAddress2Id[_to] == bytes32(0), "Address is already taken by another member");

    member.addr = _to;

    memberAddress2Id[from] = bytes32(0);
    memberAddress2Id[_to] = memberId;

    activeAddressesCache.remove(from);
    activeAddressesCache.add(_to);

    emit ChangeMyAddress(memberId, from, _to);
  }

  // VIEW METHODS

  function getCurrentPeriodId() public view returns (uint256) {
    uint256 blockTimestamp = block.timestamp;

    require(blockTimestamp > genesisTimestamp, "Contract not initiated yet");

    // return (blockTimestamp - genesisTimestamp) / periodLength;
    return (blockTimestamp.sub(genesisTimestamp)) / periodLength;
  }

  function getPreviousPeriodBeginsAt() public view returns (uint256) {
    uint256 currentPeriodId = getCurrentPeriodId();

    require(currentPeriodId > 0, "No previous period");

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

  function getActiveAddressList() external view returns (address[] memory) {
    return activeAddressesCache.enumerate();
  }

  function getActiveAddressSize() external view returns (uint256) {
    return activeAddressesCache.length();
  }

  function isCurrentPeriodClaimedByMember(bytes32 _memberId) external view returns (bool) {
    return member[_memberId].claimedPeriods[getCurrentPeriodId()];
  }

  function isCurrentPeriodClaimedByAddress(address _memberAddress) external view returns (bool) {
    return member[memberAddress2Id[_memberAddress]].claimedPeriods[getCurrentPeriodId()];
  }

  function isPeriodClaimedByMember(bytes32 _memberId, uint256 _periodId) external view returns (bool) {
    return member[_memberId].claimedPeriods[_periodId];
  }

  function isPeriodClaimedByAddress(address _memberAddress, uint256 _periodId) external view returns (bool) {
    return member[memberAddress2Id[_memberAddress]].claimedPeriods[_periodId];
  }
}
