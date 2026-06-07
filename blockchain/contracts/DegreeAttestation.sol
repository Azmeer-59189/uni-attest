// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DegreeAttestation {
    struct DegreeRecord {
        bytes32 degreeHash;
        uint256 timestamp;
        address issuer;
        bool exists;
    }

    mapping(bytes32 => DegreeRecord) public degrees;
    mapping(address => bool) public authorizedIssuers;
    address public owner;
    string public universityName;

    event DegreeIssued(bytes32 indexed degreeHash, address indexed issuer, uint256 timestamp, string universityName);
    event IssuerAdded(address indexed issuer, address indexed addedBy);
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    constructor(string memory _universityName) {
        owner = msg.sender;
        universityName = _universityName;
        authorizedIssuers[msg.sender] = true;
    }

    function addIssuer(address _issuer) external onlyOwner {
        require(_issuer != address(0), "Invalid address");
        require(!authorizedIssuers[_issuer], "Already issuer");
        authorizedIssuers[_issuer] = true;
        emit IssuerAdded(_issuer, msg.sender);
    }

    function removeIssuer(address _issuer) external onlyOwner {
        require(authorizedIssuers[_issuer], "Not issuer");
        require(_issuer != owner, "Cannot remove owner");
        authorizedIssuers[_issuer] = false;
        emit IssuerRemoved(_issuer, msg.sender);
    }

    function issueDegree(bytes32 _degreeHash) external onlyAuthorized {
        require(!degrees[_degreeHash].exists, "Already attested");
        require(_degreeHash != bytes32(0), "Invalid hash");

        degrees[_degreeHash] = DegreeRecord({
            degreeHash: _degreeHash,
            timestamp: block.timestamp,
            issuer: msg.sender,
            exists: true
        });

        emit DegreeIssued(_degreeHash, msg.sender, block.timestamp, universityName);
    }

    function verifyDegree(bytes32 _degreeHash) external view returns (bool, uint256, address, string memory) {
        DegreeRecord memory record = degrees[_degreeHash];
        return (record.exists, record.timestamp, record.issuer, universityName);
    }
}