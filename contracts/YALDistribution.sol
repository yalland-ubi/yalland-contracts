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


// TODO: make pausable
// TODO: make ownable
contract YALDistribution is Ownable, Pausable {
  using SafeMath for uint256;

  uint256 public genesisTimestamp;
  uint256 public periodLength;
  uint256 public periodVolume;

  uint256 public idCounter;
  ICoinToken public token;
  uint256 public activeMemberCount;

  address public verifier;
  // 100% == 100 ether
  uint256 public verifierRewardShare;

  mapping(bytes32 => Member) public members;
  mapping(address => bytes32) public memberAddress2Id;
  // periodId => rewardPerMember
  mapping(uint256 => uint256) public periodRewardPerMember;
  // periodId => amount
  mapping(uint256 => uint256) public verifierPeriodReward;

  struct Member {
    bool active;
    uint256 createdAt;
    address addr;
    // periodId => claimed
    mapping(uint256 => bool) claimedPeriods;
  }

  modifier onlyVerifier() {
    require(msg.sender == verifier, "Only verifier allowed");

    _;
  }

  // Mints tokens, assigns the verifier reward and caches reward per member
  modifier handlePeriodTransitionIfRequired() {
    uint256 currentPeriodId = getCurrentPeriodId();

    if (periodRewardPerMember[currentPeriodId] == 0) {
      verifierPeriodReward[currentPeriodId] = periodVolume * verifierRewardShare;

      // imbalance will be left at the contract
      uint256 currentPeriodRewardPerMember = (periodVolume * (100 ether - verifierRewardShare)) / activeMemberCount;
      assert(currentPeriodRewardPerMember > 0);
      periodRewardPerMember[currentPeriodId] = currentPeriodRewardPerMember;
    }

    _;
  }

  constructor(
    ICoinToken _token,
    uint256 _periodLength,
    uint256 _genesisTimestamp,
    uint256 _periodVolume
  )
    public
  {
    // ..assign
  }

  // OWNER INTERFACE

  function setVerifier(address _verifier) external onlyOwner {
    verifier = _verifier;
  }

  function setVerifierRewardShare(uint256 _share) external onlyOwner {
    require(_share < 100 ether);
    verifierRewardShare = _share;
  }

  function setPeriodVolume(uint256 _newVolume) external onlyOwner {
    periodVolume = _newVolume;
  }

  // VERIFIER INTERFACE

  function addMembers(
    bytes32[] calldata _memberIds,
    address[] calldata _addrs
  )
    external
    handlePeriodTransitionIfRequired
    onlyVerifier
  {
    for (uint256 i = 0; i < _memberIds.length; i++) {
      _addMember(_memberIds[i], _addrs[i]);
    }
  }

  function addMember(
    bytes32 _memberId,
    address _member
  )
    external
    handlePeriodTransitionIfRequired
    onlyVerifier
  {
    _addMember(_memberId, _member);
  }

  function _addMember(bytes32 _memberId, address _member) internal {
    require(memberAddress2Id[_member] == byte(0), "The address already registered");

    Member storage member = members[_memberId];

    member.addr = _member;
    member.active = true;
    member.createdAt = now;

    activeMemberCount++;
  }

  function activateMember(bytes32 _memberId) external handlePeriodTransitionIfRequired onlyVerifier {
    Member storage member = members[_memberId];
    require(member.active == false);
    require(member.createdAt != 0);
    activeMemberCount++;
  }

  function deactivateMember(bytes32 _memberId) external handlePeriodTransitionIfRequired onlyVerifier {
    Member storage member = members[_memberId];
    require(member.active == true);
    activeMemberCount--;
  }

  function changeMemberAddress(bytes32 _memberId, address _to) external onlyVerifier {
    Member storage member = members[_memberId];
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
    Member storage member = members[_memberId];

    require(member.addr == msg.sender, "Address doesn't match");
    require(member.active == true, "Not active member");

    require(member.createdAt < getCurrentPeriodBeginsAt());
    require(member.claimedPeriods[getCurrentPeriodId()] == false);

    member.claimedPeriods[getCurrentPeriodId()] = true;

    token.mint(msg.sender, verifierPeriodReward[getCurrentPeriodId()]);
  }

  function changeMyAddress(bytes32 _memberId, address _to) external {
    Member storage member = members[_memberId];
    require(member.addr == msg.sender);
    member.addr = _to;
  }

  // PERMISSIONLESS INTERFACE
//  function handlePeriodTransitionIfRequired() external handlePeriodTransitionIfRequired {
//  }

  // INTERNAL METHODS

  function nextId() internal returns (uint256) {
    return ++idCounter;
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
