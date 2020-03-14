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
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/lifecycle/Pausable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/ICoinToken.sol";


/**
 * @title YALDistributor contract
 * @author Galt Project
 * @notice Mints YAL tokens on request according pre-configured formula
 **/
contract YALDistributor is Ownable, Pausable {
  using SafeMath for uint256;

  uint256 public constant HUNDREED_PCT = 100 ether;

  event ActiveMemberCountChanged(uint256 activeMemberCount);
  event AddMember(bytes32 memberId, address memberAddress);
  event ChangeMemberAddress(bytes32 indexed memberId, address from, address to);
  event ChangeMyAddress(bytes32 indexed memberId, address from, address to);
  event SetPeriodVolume(uint256 oldPeriodVolume, uint256 newPeriodVolume);
  event SetVerifier(address verifier);
  event SetVerifierRewardShare(uint256 rewardShare);

  struct Period {
    uint256 rewardPerMember;
    uint256 verifierReward;
  }

  struct Member {
    bool active;
    uint256 createdAt;
    uint256 lastEnabledAt;
    uint256 lastDisabledAt;
    address addr;
    // periodId => claimed
    mapping(uint256 => bool) claimedPeriods;
  }

  uint256 public genesisTimestamp;
  uint256 public periodLength;
  uint256 public periodVolume;

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

  modifier onlyVerifier() {
    require(msg.sender == verifier, "Only verifier allowed");

    _;
  }

  // Mints tokens, assigns the verifier reward and caches reward per member
  modifier handlePeriodTransitionIfRequired() {
    uint256 currentPeriodId = getCurrentPeriodId();

    Period storage currentPeriod = period[currentPeriodId];

    if (currentPeriod.rewardPerMember == 0 && activeMemberCount > 0) {
      currentPeriod.verifierReward = periodVolume.mul(verifierRewardShare) / HUNDREED_PCT;

      // imbalance will be left at the contract
      // uint256 currentPeriodRewardPerMember = (periodVolume * (100 ether - verifierRewardShare)) / activeMemberCount;
      uint256 currentPeriodRewardPerMember = (periodVolume.mul(HUNDREED_PCT.sub(verifierRewardShare))) / (activeMemberCount * HUNDREED_PCT);
      assert(currentPeriodRewardPerMember > 0);
      currentPeriod.rewardPerMember = currentPeriodRewardPerMember;
    }

    _;
  }

  constructor(
    // can be changed later:
    uint256 _periodVolume,
    address _verifier,
    uint256 _verifierRewardShare,

    // can't be changed later:
    address _token,
    uint256 _periodLength,
    uint256 _genesisTimestamp
  )
    public
  {
    periodVolume = _periodVolume;
    verifier = _verifier;
    verifierRewardShare = _verifierRewardShare;

    token = ICoinToken(_token);
    periodLength = _periodLength;
    genesisTimestamp = _genesisTimestamp;
  }

  // OWNER INTERFACE

  /*
   * @dev Changes a verifier address to a new one.
   * @params _verifier a new verifier address, address(0) if a verifier role is disabled
   */
  function setVerifier(address _verifier) external onlyOwner {
    verifier = _verifier;

    emit SetVerifier(_verifier);
  }

  /*
   * @dev Changes a verifier reward share to a new one.
   * @params _verifierRewardShare a new verifier reward share, 0 if there should be no reward for
   * a verifier; 100% == 100 ether
   */
  function setVerifierRewardShare(uint256 _verifierRewardShare) external onlyOwner {
    require(_verifierRewardShare < 100 ether, "Can't be >= 100%");

    verifierRewardShare = _verifierRewardShare;

    emit SetVerifierRewardShare(_verifierRewardShare);
  }

  /*
   * @dev Changes a periodVolume to a new value.
   * @params _periodVolume a new periodVolume value, 0 if the distribution shuold be disabled
   */
  function setPeriodVolume(uint256 _periodVolume) external onlyOwner {
    uint256 oldPeriodVolume = periodVolume;

    periodVolume = _periodVolume;

    emit SetPeriodVolume(oldPeriodVolume, _periodVolume);
  }

  // VERIFIER INTERFACE

  /*
   * @dev Adds multple members. To be called before genesisTimestamp
   * @params _memberIds unique credential keccack256() hashes
   * @params _memberAddresses corresponding to _memberIds addresses
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
   * @dev Adds multple members. To be called after genesisTimestamp
   * @params _memberIds unique credential keccack256() hashes
   * @params _memberAddresses corresponding to _memberIds addresses
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
   * @params _memberId a unique credential keccack256()
   * @params _memberAddress corresponding to _memberIds address
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
   * @params _memberIds to enable
   */
  function enableMembers(bytes32[] calldata _memberIds) external handlePeriodTransitionIfRequired onlyVerifier {
    uint256 len = _memberIds.length;

    require(len > 0, "Missing input members");

    for (uint256 i = 0; i < len; i++ ) {
      Member storage member = member[_memberIds[i]];
      require(member.active == false, "One of the members is active");
      require(member.createdAt != 0, "Member doesn't exist");

      member.active = true;
      member.lastEnabledAt = now;
    }

    _incrementActiveMemberCount(len);
  }

  /*
   * @dev Deactivates multiple members
   * @params _memberIds to disable
   */
  function disableMembers(bytes32[] calldata _memberIds) external handlePeriodTransitionIfRequired onlyVerifier {
    uint256 len = _memberIds.length;

    require(len > 0, "Missing input members");

    for (uint256 i = 0; i < len; i++ ) {
      Member storage member = member[_memberIds[i]];
      require(member.active == true, "One of the members is inactive");
      require(member.createdAt != 0, "Member doesn't exist");

      member.active = false;
      member.lastDisabledAt = now;
    }

    _decrementActiveMemberCount(len);
  }

  /*
   * @dev Validator changes a member address with a new one. MemberId remains the same.
   * @params _memberIds to change
   * @params _to address to change to
   */
  function changeMemberAddress(bytes32 _memberId, address _to) external onlyVerifier {
    Member storage member = member[_memberId];

    require(member.createdAt != 0, "Member doesn't exist");

    address from = member.addr;
    member.addr = _to;

    memberAddress2Id[from] = bytes32(0);
    memberAddress2Id[_to] = _memberId;

    emit ChangeMemberAddress(_memberId, from, _to);
  }

  function claimVerifierReward(uint256 _periodId, address _to) external onlyVerifier {
    // TODO: add already claimed check
    token.mint(_to, period[_periodId].verifierReward);
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

    emit AddMember(_memberId, _memberAddress);
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

  // @dev Claims msg.sender funds for the previous period
  function claimFunds(
    bytes32 _memberId
  )
    external
    handlePeriodTransitionIfRequired
  {
    Member storage member = member[_memberId];

    require(member.addr == msg.sender, "Address doesn't match");
    require(member.active == true, "Not active member");

    require(member.createdAt < getCurrentPeriodBeginsAt(), "Can't assign rewards for the creation period");
    require(member.claimedPeriods[getCurrentPeriodId()] == false, "Already claimed for the current period");

    member.claimedPeriods[getCurrentPeriodId()] = true;

    token.mint(msg.sender, period[getCurrentPeriodId()].verifierReward);
  }

  /*
   * @dev A member changes his address with a new one. MemberId remains the same.
   * @params _memberIds to change
   * @params _to address to change to
   */
  function changeMyAddress(bytes32 _memberId, address _to) external {
    Member storage member = member[_memberId];

    require(member.addr == msg.sender, "Only the member allowed");
    require(member.createdAt != 0, "Member doesn't exist");

    address from = member.addr;
    member.addr = _to;

    memberAddress2Id[from] = bytes32(0);
    memberAddress2Id[_to] = _memberId;

    emit ChangeMyAddress(_memberId, from, _to);
  }

  // VIEW METHODS

  function getCurrentPeriodId() public view returns (uint256) {
    uint256 blockTimestamp = block.timestamp;

    require(blockTimestamp > genesisTimestamp, "Contract not initiated yet");

    // return (blockTimestamp - genesisTimestamp) / periodLength;
    return (blockTimestamp.sub(genesisTimestamp)) / periodLength;
  }

  function getNextPeriodBeginsAt() public view returns (uint256) {
    if (block.timestamp <= genesisTimestamp) {
      return genesisTimestamp;
    }

    // return ((getCurrentPeriod() + 1) * periodLength) + genesisTimestamp;
    return ((getCurrentPeriodId() + 1).mul(periodLength)).add(genesisTimestamp);
  }

  function getCurrentPeriodBeginsAt() public view returns (uint256) {
    if (block.timestamp <= genesisTimestamp) {
      return genesisTimestamp;
    }

    // return (getCurrentPeriod() * periodLength) + genesisTimestamp;
    return (getCurrentPeriodId().mul(periodLength)).add(genesisTimestamp);
  }
}
