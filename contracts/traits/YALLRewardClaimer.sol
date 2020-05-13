/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/math/SafeMath.sol";


/**
 * @title YALLRewardClaimer contract
 * @author Galt Project
 **/
contract YALLRewardClaimer {
  using SafeMath for uint256;

  function requireCanClaimReward(
    bool _active,
    uint256 _currentPeriodId,
    uint256 _currentPeriodStart,
    uint256 _createdAt,
    uint256 _le,
    uint256 _ld
  )
    public
    pure
  {
    require(_active == true, "YALLRewardClaimer: Not active verifier");
    require(_createdAt < _currentPeriodStart, "YALLRewardClaimer: Can't assign rewards for the creation period");

    if (_ld != 0 && _currentPeriodId != 0) {
      require(
        // both disabled and enabled in the current period
        (_ld >= _currentPeriodStart && _le >= _currentPeriodStart)
        // both disabled and enabled before the current period started
        || (_ld < _currentPeriodStart && _le < _currentPeriodStart),
        "YALLRewardClaimer: One period should be skipped after re-enabling"
      );
    }
  }
}
