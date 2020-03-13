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

  event SetVerifier(address verifier);
  event SetVerifierRewardShare(uint256 rewardShare);
  event SetPeriodVolume(uint256 oldPeriodVolume, uint256 newPeriodVolume);
  event AddMember(bytes32 memberId, address memberAddress);
  event ActiveMemberCountChanged(uint256 activeMemberCount);

  struct Period {
    uint256 rewardPerMember;
    uint256 verifierPeriodReward;
  }

  struct Member {
    bool active;
    uint256 createdAt;
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

  // periodId => rewardPerMember
  mapping(uint256 => uint256) public periodRewardPerMember;
  // periodId => amount
  mapping(uint256 => uint256) public verifierPeriodReward;

  // periodId => periodDetails
  mapping(uint256 => Period) public periods;

  modifier onlyVerifier() {
    require(msg.sender == verifier, "Only verifier allowed");

    _;
  }

  // Mints tokens, assigns the verifier reward and caches reward per member
  modifier handlePeriodTransitionIfRequired() {
    uint256 currentPeriodId = getCurrentPeriodId();

    if (periodRewardPerMember[currentPeriodId] == 0 && activeMemberCount > 0) {
      verifierPeriodReward[currentPeriodId] = periodVolume * verifierRewardShare;

      // imbalance will be left at the contract
      uint256 currentPeriodRewardPerMember = (periodVolume * (100 ether - verifierRewardShare)) / activeMemberCount;
      assert(currentPeriodRewardPerMember > 0);
      periodRewardPerMember[currentPeriodId] = currentPeriodRewardPerMember;
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
   * @dev Adds multple members
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
    uint256 len = _memberIds.length;

    require(len > 0, "Missing input members");
    require(len == _memberAddresses.length, "ID and address arrays length should match");

    for (uint256 i = 0; i < len; i++) {
      _addMember(_memberIds[i], _memberAddresses[i]);
    }

    uint256 newActiveMemberCount = activeMemberCount + len;
    activeMemberCount = newActiveMemberCount;

    emit ActiveMemberCountChanged(newActiveMemberCount);
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

    uint256 newActiveMemberCount = activeMemberCount + 1;
    activeMemberCount = newActiveMemberCount;

    emit ActiveMemberCountChanged(newActiveMemberCount);
  }

  function _addMember(bytes32 _memberId, address _memberAddress) internal {
    require(memberAddress2Id[_memberAddress] == byte(0), "The address already registered");

    memberAddress2Id[_memberAddress] = _memberId;

    Member storage member = member[_memberId];

    member.addr = _memberAddress;
    member.active = true;
    member.createdAt = now;

    emit AddMember(_memberId, _memberAddress);
  }

  function activateMember(bytes32 _memberId) external handlePeriodTransitionIfRequired onlyVerifier {
    Member storage member = member[_memberId];
    require(member.active == false);
    require(member.createdAt != 0);
    activeMemberCount++;
  }

  function deactivateMember(bytes32 _memberId) external handlePeriodTransitionIfRequired onlyVerifier {
    Member storage member = member[_memberId];
    require(member.active == true);
    activeMemberCount--;
  }

  function changeMemberAddress(bytes32 _memberId, address _to) external onlyVerifier {
    Member storage member = member[_memberId];
    member.addr = _to;
  }

  function claimVerifierReward(uint256 _periodId, address _to) external onlyVerifier {
    // TODO: add already claimed check
    token.mint(_to, verifierPeriodReward[_periodId]);
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

    require(member.createdAt < getCurrentPeriodBeginsAt());
    require(member.claimedPeriods[getCurrentPeriodId()] == false);

    member.claimedPeriods[getCurrentPeriodId()] = true;

    token.mint(msg.sender, verifierPeriodReward[getCurrentPeriodId()]);
  }

  function changeMyAddress(bytes32 _memberId, address _to) external {
    Member storage member = member[_memberId];
    require(member.addr == msg.sender);
    member.addr = _to;
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
