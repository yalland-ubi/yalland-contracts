/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./traits/NumericIdCounter.sol";
import "./interfaces/IYALLDistributor.sol";
import "./registry/YALLRegistryHelpers.sol";

/**
 * @title YALLQuestionnaire contract
 * @author Galt Project
 **/
contract YALLQuestionnaire is Initializable, NumericIdCounter, YALLRegistryHelpers {
  using SafeMath for uint256;

  event CreateQuestionnaire(
    bytes32 indexed creator,
    uint256 indexed questionnaireId,
    string details,
    uint256 activeTill,
    uint256 deposit,
    uint256 reward
  );
  event IncreaseDeposit(uint256 indexed questionnaireId, uint256 increaseAmount);
  event StopQuestionnaire(uint256 indexed questionnaireId);
  event SubmitAnswers(
    bytes32 indexed submitterId,
    uint256 indexed questionnaireId,
    uint256 answersCount,
    uint256 reward
  );
  event WithdrawDeposit(uint256 indexed questionnaireId, address indexed to, uint256 increaseAmount);

  struct Questionnaire {
    bool stopped;
    // memberId
    bytes32 creator;
    // IPLD link
    string details;
    // Timestamp
    uint256 activeTill;
    // In YALLs
    uint256 deposit;
    // Reward per member
    uint256 reward;
    uint256 submissionCount;
    mapping(bytes32 => Submission) submissions; // memberId => submission;
  }

  struct Submission {
    uint256 submittedAt; // timestamp
    bytes32[] answers;
  }

  mapping(uint256 => Questionnaire) public questionnaires; // id counter => questionnaire details

  // INITIALIZATION
  function initialize(address _yallRegistry) external initializer {
    yallRegistry = YALLRegistry(_yallRegistry);
  }

  // CREATOR INTERFACE
  function createQuestionnaire(
    uint256 _activeTill,
    uint256 _deposit,
    uint256 _reward,
    string calldata _details
  ) external {
    uint256 id = _nextCounterId();
    Questionnaire storage q = questionnaires[id];

    require(_activeTill > now, "YALLQuestionnaire: Invalid activeTill");
    require(_deposit >= _reward, "YALLQuestionnaire: Insufficient deposit");
    require(_reward > 0, "YALLQuestionnaire: Reward should be greater than 0");

    _yallTokenIERC20().transferFrom(msg.sender, address(this), _deposit);

    IYALLDistributor dist = _yallDistributor();
    bytes32 creator = dist.memberAddress2Id(msg.sender);
    require(dist.isActive(msg.sender), "YALLQuestionnaire: Member is inactive");

    q.creator = creator;
    q.details = _details;
    q.activeTill = _activeTill;
    q.deposit = _deposit;
    q.reward = _reward;

    emit CreateQuestionnaire(creator, id, _details, _activeTill, _deposit, _reward);
  }

  function stopQuestionnaire(uint256 _questionnaireId) external {
    Questionnaire storage q = questionnaires[_questionnaireId];

    bytes32 senderId = _yallDistributor().memberAddress2Id(msg.sender);

    require(senderId == q.creator, "YALLQuestionnaire: Only creator allowed");
    require(q.stopped == false, "YALLQuestionnaire: Already stopped");
    require(q.activeTill > now, "YALLQuestionnaire: Not active");

    q.stopped = true;

    emit StopQuestionnaire(_questionnaireId);
  }

  function increaseDeposit(uint256 _questionnaireId, uint256 _increaseAmount) external {
    Questionnaire storage q = questionnaires[_questionnaireId];

    bytes32 senderId = _yallDistributor().memberAddress2Id(msg.sender);

    require(q.creator == senderId, "YALLQuestionnaire: Only creator allowed");
    require(q.stopped == false, "YALLQuestionnaire: Already stopped");
    require(q.activeTill > now, "YALLQuestionnaire: Not active");
    require(_increaseAmount > 0, "YALLQuestionnaire: Missing amount");

    q.deposit = q.deposit.add(_increaseAmount);

    _yallTokenIERC20().transferFrom(msg.sender, address(this), _increaseAmount);

    emit IncreaseDeposit(_questionnaireId, _increaseAmount);
  }

  function withdrawDeposit(uint256 _questionnaireId, address _to) external {
    Questionnaire storage q = questionnaires[_questionnaireId];

    bytes32 senderId = _yallDistributor().memberAddress2Id(msg.sender);

    require(senderId == q.creator, "YALLQuestionnaire: Only creator allowed");
    require(
      q.stopped == true || (q.stopped == false && q.activeTill < now),
      "YALLQuestionnaire: Still active or not stopped"
    );

    uint256 amount = q.deposit;

    q.deposit = 0;

    _yallTokenIERC20().transfer(_to, amount);

    emit WithdrawDeposit(_questionnaireId, _to, amount);
  }

  // PARTICIPANT INTERFACE
  function submitAnswers(uint256 _questionnaireId, bytes32[] calldata _answers) external {
    Questionnaire storage q = questionnaires[_questionnaireId];
    uint256 rewardAmount = q.reward;
    address msgSender = msg.sender;

    require(q.stopped == false, "YALLQuestionnaire: Already stopped");
    require(q.activeTill > now, "YALLQuestionnaire: Not active");

    require(q.deposit >= rewardAmount, "YALLQuestionnaire: Insufficient funds for a reward");

    IYALLDistributor dist = _yallDistributor();
    bytes32 submitterId = dist.memberAddress2Id(msgSender);
    require(dist.isActive(msgSender), "YALLQuestionnaire: Member is inactive");

    require(q.submissions[submitterId].submittedAt == 0, "YALLQuestionnaire: Already submitted");

    q.submissions[submitterId] = Submission(now, _answers);
    q.submissionCount += 1;

    q.deposit = q.deposit.sub(rewardAmount);

    _yallTokenIERC20().transfer(msgSender, rewardAmount);

    emit SubmitAnswers(submitterId, _questionnaireId, _answers.length, rewardAmount);
  }

  // GETTERS
  function getSubmittedAnswers(uint256 _questionnaireId, bytes32 _submitterId)
    external
    view
    returns (bytes32[] memory)
  {
    return questionnaires[_questionnaireId].submissions[_submitterId].answers;
  }

  function getRemainingSubmissionSlots(uint256 _questionnaireId) external view returns (uint256) {
    Questionnaire storage q = questionnaires[_questionnaireId];

    return q.deposit / q.reward;
  }
}
