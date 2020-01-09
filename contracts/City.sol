/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 * 
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";

import "./interfaces/ICoinToken.sol";


library CityLibrary {
    struct MemberTariff {
        bool active;
        uint256 lastTimestamp;
        uint256 minted;
        uint256 claimed;
    }
    struct ParticipationRequest {
        bool sent;
        bool confirmed;
        uint256 confirmationsCount;
        mapping (address => bool) confirmations;
    }
    struct Tariff {
        string title;
        bool active;
        uint256 payment;
        uint256 paymentPeriod;
        uint256 paymentSent;
        uint256 totalMinted;
        uint256 totalBurned;
        uint256 mintForPeriods;
        TariffCurrency currency;
        address currencyAddress;
        ArraySet.AddressSet activeParticipants;
    }
    enum TariffCurrency {
        ETH,
        ERC20
    }
}

contract City is Permissionable, Ownable {
    using ArraySet for ArraySet.AddressSet;
    using ArraySet for ArraySet.Bytes32Set;

    string public constant RATE_MANAGER_ROLE = "rate_manager";
    string public constant MEMBER_JOIN_MANAGER_ROLE = "member_join_manager";
    string public constant MEMBER_LEAVE_MANAGER_ROLE = "member_leave_manager";
    
    string public name;
    string public symbol;
    uint256 public maxSupply;
    uint256 public confirmsToParticipation;

    event TariffCreated(bytes32 id, string title, uint256 payment, uint256 paymentPeriod, uint8 currency, address currencyAddress);
    event TariffEdited(bytes32 id, string title, uint256 payment, uint256 paymentPeriod, uint8 currency, address currencyAddress);
    event TariffActiveChanged(bytes32 id, bool active);
    event ParticipationRequest(address requested);
    event ParticipationConfirm(address requested, address confirmed, bool fully);
    event ParticipationAdded(address cityManager, address member, bytes32 tariff);
    event ParticipationTariffRemoved(address cityManager, address member, bytes32 tariff);

    mapping (address => bool) public participants;
    ArraySet.AddressSet activeParticipants;
    address[] allParticipants;

    mapping (address => ArraySet.Bytes32Set) activeMemberTariffs;
    mapping (address => mapping(bytes32 => CityLibrary.MemberTariff)) private memberTariffs;
    mapping (address => ArraySet.Bytes32Set) activeMemberRequests;
    mapping (address => mapping(bytes32 => CityLibrary.ParticipationRequest)) private participationRequests;
    ArraySet.AddressSet activeRequests;

    mapping (bytes32 => CityLibrary.Tariff) private tariffs;
    ArraySet.Bytes32Set activeTariffs;
    bytes32[] allTariffs;

    constructor(uint256 _maxSupply, string memory _name, string memory _symbol) public {
        maxSupply = _maxSupply;
        name = _name;
        symbol = _symbol;

        confirmsToParticipation = 1;

        _addRoleTo(msg.sender, RATE_MANAGER_ROLE);
        _addRoleTo(msg.sender, MEMBER_JOIN_MANAGER_ROLE);
        _addRoleTo(msg.sender, MEMBER_LEAVE_MANAGER_ROLE);
    }

    function() external payable { }

    modifier onlyRateManager() {
        require(hasRole(msg.sender, RATE_MANAGER_ROLE), "Only rate manager");
        _;
    }

    modifier onlyMemberJoinManager() {
        require(hasRole(msg.sender, MEMBER_JOIN_MANAGER_ROLE), "Only member join manager");
        _;
    }

    modifier onlyMemberLeaveManager() {
        require(hasRole(msg.sender, MEMBER_LEAVE_MANAGER_ROLE), "Only member leave manager");
        _;
    }
    
    function createTariff(
        string memory _title,
        uint256 _payment,
        uint256 _paymentPeriod,
        uint256 _mintForPeriods,
        CityLibrary.TariffCurrency _currency,
        address _currencyAddress
    )
        public
        onlyRateManager
        returns(bytes32)
    {
        bytes32 _id = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                _payment,
                _paymentPeriod,
                _currencyAddress
            )
        );
        require(!tariffs[_id].active, "Tariff already created");
        
        tariffs[_id].title = _title;
        tariffs[_id].payment = _payment;
        tariffs[_id].paymentPeriod = _paymentPeriod;
        tariffs[_id].mintForPeriods = _mintForPeriods;
        tariffs[_id].currency = _currency;
        tariffs[_id].currencyAddress = _currencyAddress;
        tariffs[_id].active = true;

        activeTariffs.add(_id);
        allTariffs.push(_id);
        
        emit TariffCreated(_id, _title, _payment, _paymentPeriod, uint8(_currency), _currencyAddress);
        return _id;
    }
    
    function setTariffActive(bytes32 _id, bool _active) public onlyRateManager {
        require(tariffs[_id].active != _active, "Same status");
        
        tariffs[_id].active = _active;
        
        if(_active) {
            activeTariffs.add(_id);
        } else {
            activeTariffs.remove(_id);
        }
        
        emit TariffActiveChanged(_id, _active);
    }
    
    function editTariff(bytes32 _id, string memory _title, uint256 _payment, uint256 _paymentPeriod, uint256 _mintForPeriods, CityLibrary.TariffCurrency _currency, address _currencyAddress) public onlyRateManager {
        tariffs[_id].title = _title;
        tariffs[_id].payment = _payment;
        tariffs[_id].paymentPeriod = _paymentPeriod;
        tariffs[_id].mintForPeriods = _mintForPeriods;
        tariffs[_id].currency = _currency;
        tariffs[_id].currencyAddress = _currencyAddress;
        
        emit TariffEdited(_id, _title, _payment, _paymentPeriod, uint8(_currency), _currencyAddress);
    }

    function setMaxSupply(uint256 _maxSupply) public onlyOwner {
        maxSupply = _maxSupply;
    }

    function setConfirmsToParticipation(uint256 _confirmsToParticipation) public onlyOwner {
        confirmsToParticipation = _confirmsToParticipation;
    }

    function claimPayment(address payable _claimFor, bytes32 _tariffId, uint256 _periodsNumber) public returns (uint256 nextDate) {
        CityLibrary.MemberTariff storage _memberTariff = memberTariffs[_claimFor][_tariffId];
        CityLibrary.Tariff storage _tariff = tariffs[_tariffId];
        require(_memberTariff.active, "Tariff payment is not active"); // REVERT
        require(_tariff.active, "Tariff is not active");
        require(_tariff.payment != 0, "Tariff payment is null");
        require(_tariff.paymentPeriod != 0, "Tariff payment period is null");

        require(participants[_claimFor], "Not active");
        require(_memberTariff.lastTimestamp + (_tariff.paymentPeriod * _periodsNumber) <= now, "Too soon");

        if(_memberTariff.lastTimestamp == 0) {
            _memberTariff.lastTimestamp = now;
        } else {
            _memberTariff.lastTimestamp += _tariff.paymentPeriod * _periodsNumber;
        }

        _memberTariff.claimed += _tariff.payment * _periodsNumber;

        if(_tariff.currency == CityLibrary.TariffCurrency.ETH) {
            _claimFor.transfer(_tariff.payment * _periodsNumber);
        } else {
            ERC20(_tariff.currencyAddress).transfer(_claimFor, _tariff.payment * _periodsNumber);

            if(_tariff.mintForPeriods > 0 && _memberTariff.claimed >= _memberTariff.minted) {
                uint256 mintAmount = _tariff.mintForPeriods * _tariff.payment;
                ICoinToken(_tariff.currencyAddress).mint(address(this), mintAmount);
                _memberTariff.minted += mintAmount;
                _tariff.totalMinted += mintAmount;
            }
        }

        _tariff.paymentSent += _tariff.payment * _periodsNumber;

        return _memberTariff.lastTimestamp + _tariff.paymentPeriod;
    }
    
    function addParticipation(address _address, bytes32 _tariff) public onlyMemberJoinManager {
        addParticipationUnsafe(_address, _tariff);

        emit ParticipationAdded(msg.sender, _address, _tariff);
    }
    
    function addParticipationUnsafe(address _address, bytes32 _tariffId) internal {
        CityLibrary.MemberTariff storage _memberTariff = memberTariffs[_address][_tariffId];
        require(!_memberTariff.active, "Already have tariff");
        participants[_address] = true;
        activeParticipants.addSilent(_address);
        tariffs[_tariffId].activeParticipants.add(_address);
        allParticipants.push(_address);
        _memberTariff.active = true;
        
        if(tariffs[_tariffId].currencyAddress != address(0) && tariffs[_tariffId].mintForPeriods > 0) {
            uint256 mintAmount = tariffs[_tariffId].mintForPeriods * tariffs[_tariffId].payment;
            ICoinToken(tariffs[_tariffId].currencyAddress).mint(address(this), mintAmount);
            _memberTariff.minted += mintAmount;
            tariffs[_tariffId].totalMinted += mintAmount;
        }

        activeMemberTariffs[_address].add(_tariffId);
        _memberTariff.lastTimestamp = now - tariffs[_tariffId].paymentPeriod;
    }

    function requestParticipation(bytes32 _tariffId) public {
        require(activeParticipants.size() < maxSupply, "Not enough supply");
        require(!participants[msg.sender], "Already participant");
        require(!participationRequests[msg.sender][_tariffId].sent, "Already sent");

        participationRequests[msg.sender][_tariffId] = CityLibrary.ParticipationRequest({ sent: true, confirmed: false, confirmationsCount: 0 });
        activeMemberRequests[msg.sender].add(_tariffId);
        activeRequests.remove(msg.sender);
        
        emit ParticipationRequest(msg.sender);
    }

    function confirmParticipation(address _requested, bytes32 _tariffId) public onlyMemberJoinManager returns (uint256 count) {
        require(activeParticipants.size() < maxSupply, "Not enough supply");
        require(!participants[_requested], "Already participant");

        CityLibrary.ParticipationRequest storage _request = participationRequests[_requested][_tariffId];
        require(_request.sent, "Not sent");
        require(!_request.confirmed, "Already confirmed");

        require(_request.confirmations[msg.sender] == false, "You cant confirm twice");

        _request.confirmations[msg.sender] = true;
        _request.confirmationsCount += 1;

        if(_request.confirmationsCount >= confirmsToParticipation){
            _request.confirmed = true;
            activeRequests.remove(_requested);
            activeMemberRequests[_requested].remove(_tariffId);
            addParticipationUnsafe(_requested, _tariffId);
            emit ParticipationConfirm(_requested, msg.sender, true);
        } else {
            emit ParticipationConfirm(_requested, msg.sender, false);
        }

        return _request.confirmationsCount;
    }

    function confirmsOf(address _requested, bytes32 _tariffId) public view returns (uint256) {
        return participationRequests[_requested][_tariffId].confirmationsCount;
    }

    function removeTariffParticipationUnsafe(address _member, bytes32 _tariffId) internal {
        CityLibrary.MemberTariff storage _memberTariff = memberTariffs[_member][_tariffId];

        burnRemainingFor(_member, _tariffId);

        _memberTariff.claimed = 0;
        _memberTariff.active = false;
        activeMemberTariffs[_member].remove(_tariffId);
        tariffs[_tariffId].activeParticipants.remove(_member);
        
        if(activeMemberTariffs[_member].size() == 0) {
            participants[_member] = false;
            activeParticipants.remove(_member);
        }

        emit ParticipationTariffRemoved(msg.sender, _member, _tariffId);
    }

    function removeAllParticipationUnsafe(address _member) internal {
        bytes32[] memory _memberTariffs = activeMemberTariffs[_member].elements();
        for(uint256 i = 0; i < _memberTariffs.length; i++) {
            removeTariffParticipationUnsafe(_member, _memberTariffs[i]);
        }
    }

    function kickAllParticipation(address _member) public onlyMemberLeaveManager {
        require(participants[_member], "Not participant");
        removeAllParticipationUnsafe(_member);
    }
    function leaveAllParticipation() public {
        require(participants[msg.sender], "Not participant");
        removeAllParticipationUnsafe(msg.sender);
    }

    function kickTariffParticipation(address _member, bytes32 _tariffId) public onlyMemberLeaveManager {
        require(participants[_member], "Not participant");
        removeTariffParticipationUnsafe(_member, _tariffId);
    }
    function leaveAllParticipation(bytes32 _tariffId) public {
        require(participants[msg.sender], "Not participant");
        removeTariffParticipationUnsafe(msg.sender, _tariffId);
    }

    function burnRemainingFor(address _member, bytes32 _tariffId) internal {
        CityLibrary.MemberTariff storage _memberTariff = memberTariffs[_member][_tariffId];
        CityLibrary.Tariff storage _tariff = tariffs[_tariffId];

        if(_memberTariff.minted > _memberTariff.claimed && _tariff.active) {
            uint256 burnAmount = _memberTariff.minted - _memberTariff.claimed;
            // TODO: figure out how to burn
//            BurnableToken(_tariff.currencyAddress).burn(burnAmount);
            _tariff.totalBurned += burnAmount;
            _memberTariff.minted = 0;
            _memberTariff.claimed = 0;
        }
    }

    // GETTERS

    function getAllTariffs() public view returns(bytes32[] memory) {
        return allTariffs;
    }

    function getActiveTariffs() public view returns(bytes32[] memory) {
        return activeTariffs.elements();
    }
    
    function getTariff(bytes32 _id) public view returns(
        string memory title,
        bool active,
        uint256 payment,
        uint256 paymentPeriod,
        uint256 mintForPeriods,
        uint256 totalMinted,
        uint256 totalBurned,
        uint256 paymentSent,
        CityLibrary.TariffCurrency currency,
        address currencyAddress
    )
    {
        CityLibrary.Tariff storage t = tariffs[_id];
        return (
            t.title,
            t.active,
            t.payment,
            t.paymentPeriod,
            t.mintForPeriods,
            t.totalMinted,
            t.totalBurned,
            t.paymentSent,
            t.currency,
            t.currencyAddress
        );
    }
    
    function getAllParticipants() public view returns(address[] memory) {
        return allParticipants;
    }

    function getActiveParticipants() public view returns(address[] memory) {
        return activeParticipants.elements();
    }

    function getActiveParticipantsCount() public view returns(uint256) {
        return activeParticipants.size();
    }
    
    function getTariffActiveParticipants(bytes32 _tariffId) public view returns(address[] memory) {
        return tariffs[_tariffId].activeParticipants.elements();
    }

    function getTariffActiveParticipantsCount(bytes32 _tariffId) public view returns(uint256) {
        return tariffs[_tariffId].activeParticipants.size();
    }

    function isParticipant(address _address) public view returns (bool) {
        return participants[_address];
    }
    
    function getParticipantInfo(address _member) public view returns
    (
        bool active, 
        bytes32[] memory tariffs
    ) {
        return (
            participants[_member],
            activeMemberTariffs[_member].elements()
        );
    }

    function getParticipantTariffInfo(address _member, bytes32 _tariff) public view returns
    (
        bool active,
        uint256 claimed,
        uint256 minted,
        uint256 lastTimestamp
    ) {
        CityLibrary.MemberTariff storage _mt = memberTariffs[_member][_tariff];
        return (
            _mt.active,
            _mt.claimed,
            _mt.minted,
            _mt.lastTimestamp
        );
    }
    
//    function mintTokens(address tokenAddress, uint256 mintAmount) public onlyOwner {
//        MintableToken(tokenAddress).mint(address(this), mintAmount);
//    }
}
