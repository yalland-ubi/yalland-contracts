/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "./City.sol";

contract TariffAdder is Permissionable {
  using SafeMath for uint256;

  string public constant SUPERUSER_ROLE = "superuser";

  event AddToTariff(address indexed member, bytes32 indexed tariff, address indexed sender);

  City public dcity;

  modifier onlySuperuser() {
    require(hasRole(msg.sender, SUPERUSER_ROLE), "Only superuser allowed");
    _;
  }

  constructor(address payable _dcity) public Permissionable() {
    dcity = City(_dcity);
  }

  function migrateMultipleUserAddresses(address payable[] calldata _addresses, bytes32 _tariff) external onlySuperuser {
    uint256 len = _addresses.length;

    for (uint256 i = 0; i < len; i++) {
      dcity.addParticipation(_addresses[i], _tariff);
      dcity.claimPayment(_addresses[i], _tariff, 1);
      emit AddToTariff(_addresses[i], _tariff, msg.sender);
    }
  }
}
