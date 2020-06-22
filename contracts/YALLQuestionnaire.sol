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
import "@galtproject/geodesic/contracts/utils/SegmentUtils.sol";
import "@galtproject/geodesic/contracts/utils/CPointUtils.sol";
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
    uint256 reward,
    bool particularArea
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
    uint256[] contour;
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
    string calldata _details,
    uint256[] calldata _contour
  ) external {
    uint256 id = _nextCounterId();
    Questionnaire storage q = questionnaires[id];

    require(_activeTill > now, "YALLQuestionnaire: Invalid activeTill");
    require(_deposit >= _reward, "YALLQuestionnaire: Insufficient deposit");
    require(_reward > 0, "YALLQuestionnaire: Reward should be greater than 0");
    require(_contour.length == 0 || _contour.length > 3, "YALLQuestionnaire: contour length should be 0 or be >= 3");

    _yallTokenIERC20().transferFrom(msg.sender, address(this), _deposit);

    IYALLDistributor dist = _yallDistributor();
    bytes32 creator = dist.memberAddress2Id(msg.sender);
    require(dist.isActive(msg.sender), "YALLQuestionnaire: Member is inactive");

    q.creator = creator;
    q.details = _details;
    q.activeTill = _activeTill;
    q.deposit = _deposit;
    q.reward = _reward;
    q.contour = _contour;

    emit CreateQuestionnaire(creator, id, _details, _activeTill, _deposit, _reward, _contour.length > 0);
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
    require(
      q.contour.length == 0 || isMemberLocationCorrect(_questionnaireId, submitterId) == true,
      "YALLQuestionnaire: Wrong location"
    );

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
    returns (uint256 submittedAt, bytes32[] memory answers)
  {
    return (
      questionnaires[_questionnaireId].submissions[_submitterId].submittedAt,
      questionnaires[_questionnaireId].submissions[_submitterId].answers
    );
  }

  function getQuestionnaireContour(uint256 _questionnaireId) external view returns (uint256[] memory) {
    return questionnaires[_questionnaireId].contour;
  }

  function isMemberLocationCorrect(uint256 _questionnaireId, bytes32 _memberId) public view returns (bool) {
    Questionnaire storage q = questionnaires[_questionnaireId];

    uint256 len = q.contour.length;
    if (len == 0) {
      return true;
    }

    return isPointInsidePolygon(_yallDistributor().getMemberLocation(_memberId), q.contour);
  }

  function isPointInsidePolygon(uint256 _cPoint, uint256[] memory _polygon) public pure returns (bool) {
    (int256 x, int256 y) = CPointUtils.cPointToLatLon(_cPoint);

    bool inside = false;
    uint256 j = _polygon.length - 1;

    for (uint256 i = 0; i < _polygon.length; i++) {
      (int256 xi, int256 yi) = CPointUtils.cPointToLatLon(_polygon[i]);
      (int256 xj, int256 yj) = CPointUtils.cPointToLatLon(_polygon[j]);

      bool intersect = ((yi > y) != (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) {
        inside = !inside;
      }
      j = i;
    }

    return inside;
  }

  function getRemainingSubmissionSlots(uint256 _questionnaireId) external view returns (uint256) {
    Questionnaire storage q = questionnaires[_questionnaireId];

    return q.deposit / q.reward;
  }
}
