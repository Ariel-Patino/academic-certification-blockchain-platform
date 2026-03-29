// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title AcademicCertification
/// @notice Academic MVP for issuer management, certificate issuance, verification, and revocation.
/// @dev Stores only certificate hashes and essential metadata references on-chain.
contract AcademicCertification is ERC721URIStorage {
    // -------------------------------------------------------------------------
    // Enums
    // -------------------------------------------------------------------------

    /// @notice Supported certificate categories for the MVP domain.
    enum CertificateType {
        Diploma,
        Certificate,
        Badge,
        Transcript,
        Recognition,
        Professional
    }

    /// @notice Lifecycle status of a certificate record.
    enum CertificateStatus {
        Valid,
        Revoked,
        Expired
    }

    /// @notice Lifecycle status of an issuer profile.
    enum IssuerStatus {
        Active,
        Suspended,
        Revoked
    }

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice Core certificate record stored and referenced on-chain.
    struct Certificate {
        uint256 id;
        bytes32 certificateHash;
        address issuer;
        address recipient;
        CertificateType certificateType;
        string programName;
        uint256 issuedDate;
        uint256 expiryDate;
        CertificateStatus status;
        string metadataURI;
    }

    /// @notice Issuer profile used for authorization and governance.
    struct Issuer {
        address issuerAddress;
        string name;
        string country;
        string website;
        uint256 registrationDate;
        IssuerStatus status;
        bool isVerified;
    }

    /// @notice Recipient profile linked to issued certificates.
    struct Recipient {
        address recipientAddress;
        string did;
        uint256[] certificateIds;
    }

    /// @notice Revocation record for a certificate.
    struct Revocation {
        uint256 certificateId;
        uint256 revocationDate;
        string reason;
        address revokedBy;
    }

    // -------------------------------------------------------------------------
    // State variables and storage
    // -------------------------------------------------------------------------

    /// @notice Contract admin with governance permissions.
    address public admin;

    /// @notice Sequential certificate id counter.
    uint256 public nextCertificateId = 1;

    /// @notice Tracks already-used certificate hashes to prevent duplicates.
    mapping(bytes32 => bool) private usedHashes;

    /// @notice Primary certificate storage by id.
    mapping(uint256 => Certificate) private certificatesById;

    /// @notice Reverse lookup from certificate hash to certificate id.
    mapping(bytes32 => uint256) private certificateIdByHash;

    /// @notice Issuer profiles by wallet address.
    mapping(address => Issuer) private issuers;

    /// @notice Recipient profiles by wallet address.
    mapping(address => Recipient) private recipients;

    /// @notice Revocation records by certificate id.
    mapping(uint256 => Revocation) private revocations;

    /// @notice Issued certificate ids grouped by issuer address.
    mapping(address => uint256[]) public issuerCertificates;

    /// @notice Issued certificate ids grouped by recipient address.
    mapping(address => uint256[]) public recipientCertificates;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted once when the contract skeleton is deployed.
    event ContractInitialized(address indexed adminAddress);

    /// @notice Emitted when an issuer registers in the platform.
    /// @param issuerAddress Address of the issuer account.
    /// @param name Display name of the issuer.
    /// @param country Country associated with the issuer.
    event IssuerRegistered(address indexed issuerAddress, string name, string country);

    /// @notice Emitted when an issuer is verified by the admin.
    /// @param issuerAddress Address of the verified issuer.
    event IssuerVerified(address indexed issuerAddress);

    /// @notice Emitted when the status of an issuer changes.
    /// @param issuerAddress Address of the issuer whose status changed.
    /// @param newStatus Updated issuer status value.
    event IssuerStatusChanged(address indexed issuerAddress, IssuerStatus newStatus);

    /// @notice Emitted when a certificate is issued.
    /// @param certificateId Internal certificate id.
    /// @param certificateHash SHA-256 hash of the certificate payload.
    /// @param recipient Recipient wallet address.
    /// @param issuer Issuer wallet address.
    event CertificateIssued(
        uint256 indexed certificateId,
        bytes32 indexed certificateHash,
        address indexed recipient,
        address issuer
    );

    /// @notice Emitted when a certificate is revoked.
    /// @param certificateId Internal certificate id.
    /// @param reason Human-readable reason for revocation.
    /// @param revokedBy Address that performed the revocation.
    event CertificateRevoked(uint256 indexed certificateId, string reason, address revokedBy);

    /// @notice Emitted when a certificate is verified.
    /// @param certificateId Internal certificate id.
    /// @param verifier Address that requested the verification.
    event CertificateVerified(uint256 indexed certificateId, address verifier);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @notice Restricts a function to the contract admin.
    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    /// @notice Restricts a function to issuers that are verified and active.
    modifier onlyVerifiedActiveIssuer() {
        require(isAuthorizedIssuer(msg.sender), "Issuer not authorized");
        _;
    }

    /// @notice Ensures that a certificate id exists before continuing.
    /// @param certificateId Certificate identifier to validate.
    modifier certificateMustExist(uint256 certificateId) {
        require(certificatesById[certificateId].id != 0, "Certificate not found");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice Sets the deployer as admin for the initial contract skeleton.
        constructor() ERC721("AcademicCertification", "ACADCERT") {
        admin = msg.sender;
        emit ContractInitialized(admin);
    }

    /// @notice Backward-compatible owner alias for Truffle tests.
    /// @dev Returns the same address as `admin`.
    /// @return Contract administrator address.
        function owner() public view returns (address) {
        return admin;
    }

    // -------------------------------------------------------------------------
    // Issuer management
    // -------------------------------------------------------------------------

    /// @notice Registers the sender as a new issuer.
    /// @param _name Issuer display name.
    /// @param _country Issuer country.
    /// @param _website Issuer website URL.
    function registerIssuer(string memory _name, string memory _country, string memory _website) external {
        require(bytes(_name).length > 0, "Name required");
        require(issuers[msg.sender].issuerAddress == address(0), "Already registered");

        issuers[msg.sender] = Issuer({
            issuerAddress: msg.sender,
            name: _name,
            country: _country,
            website: _website,
            registrationDate: block.timestamp,
            status: IssuerStatus.Active,
            isVerified: false
        });

        emit IssuerRegistered(msg.sender, _name, _country);
    }

    /// @notice Verifies an existing issuer.
    /// @param _issuerAddress Issuer wallet address.
    function verifyIssuer(address _issuerAddress) external onlyAdmin {
        Issuer storage issuer = issuers[_issuerAddress];
        require(issuer.issuerAddress != address(0), "Issuer not found");
        require(issuer.status == IssuerStatus.Active, "Issuer not active");

        issuer.isVerified = true;

        emit IssuerVerified(_issuerAddress);
    }

    /// @notice Updates issuer status.
    /// @param _issuerAddress Issuer wallet address.
    /// @param _newStatus New issuer status.
    function updateIssuerStatus(address _issuerAddress, IssuerStatus _newStatus) external onlyAdmin {
        Issuer storage issuer = issuers[_issuerAddress];
        require(issuer.issuerAddress != address(0), "Issuer not found");

        issuer.status = _newStatus;

        if (_newStatus == IssuerStatus.Suspended || _newStatus == IssuerStatus.Revoked) {
            issuer.isVerified = false;
        }

        emit IssuerStatusChanged(_issuerAddress, _newStatus);
    }

    /// @notice Returns issuer data.
    /// @param _issuerAddress Issuer wallet address.
    /// @return Issuer profile.
    function getIssuer(address _issuerAddress) external view returns (Issuer memory) {
        require(issuers[_issuerAddress].issuerAddress != address(0), "Issuer not found");
        return issuers[_issuerAddress];
    }

    /// @notice Returns recipient data.
    /// @param _recipientAddress Recipient wallet address.
    /// @return Recipient profile.
    function getRecipient(address _recipientAddress) external view returns (Recipient memory) {
        require(recipients[_recipientAddress].recipientAddress != address(0), "Recipient not found");
        return recipients[_recipientAddress];
    }

    /// @notice Checks whether an issuer is registered, verified and active.
    /// @param _issuerAddress Issuer wallet address.
    /// @return True when issuer is registered, verified, and active.
    function isAuthorizedIssuer(address _issuerAddress) public view returns (bool) {
        Issuer memory issuer = issuers[_issuerAddress];

        return
            issuer.issuerAddress != address(0) &&
            issuer.isVerified &&
            issuer.status == IssuerStatus.Active;
    }

            // -------------------------------------------------------------------------
            // Certificate issuance
            // -------------------------------------------------------------------------

    /// @notice Issues a new certificate and stores only the certificate hash and metadata references.
    /// @param _certificateHash SHA-256 hash of the full certificate JSON.
    /// @param _recipient Recipient wallet address.
    /// @param _certType Certificate category.
    /// @param _programName Program or degree name.
    /// @param _expiryDate Expiration timestamp (0 means no expiration).
    /// @param _metadataURI Off-chain metadata location.
    /// @return New certificate id.
    function issueCertificate(
        bytes32 _certificateHash,
        address _recipient,
        CertificateType _certType,
        string memory _programName,
        uint256 _expiryDate,
        string memory _metadataURI
    ) public onlyVerifiedActiveIssuer returns (uint256) {
        Issuer memory issuerProfile = issuers[msg.sender];
        require(issuerProfile.issuerAddress != address(0), "Issuer not found");
        require(issuerProfile.status == IssuerStatus.Active, "Issuer not active");
        require(issuerProfile.isVerified, "Issuer not verified");

        require(_recipient != address(0), "Recipient required");
        require(_certificateHash != bytes32(0), "Hash required");
        require(!usedHashes[_certificateHash], "Hash already used");
        require(bytes(_programName).length > 0, "Program required");
        require(_expiryDate == 0 || _expiryDate > block.timestamp, "Invalid expiry");

        uint256 certificateId = nextCertificateId;

        certificatesById[certificateId] = Certificate({
            id: certificateId,
            certificateHash: _certificateHash,
            issuer: msg.sender,
            recipient: _recipient,
            certificateType: _certType,
            programName: _programName,
            issuedDate: block.timestamp,
            expiryDate: _expiryDate,
            status: CertificateStatus.Valid,
            metadataURI: _metadataURI
        });

        usedHashes[_certificateHash] = true;
        certificateIdByHash[_certificateHash] = certificateId;

            _safeMint(_recipient, certificateId);
            _setTokenURI(certificateId, _metadataURI);

        issuerCertificates[msg.sender].push(certificateId);
        recipientCertificates[_recipient].push(certificateId);

        if (recipients[_recipient].recipientAddress == address(0)) {
            recipients[_recipient].recipientAddress = _recipient;
            recipients[_recipient].did = "";
        }
        recipients[_recipient].certificateIds.push(certificateId);

        nextCertificateId += 1;

        emit CertificateIssued(certificateId, _certificateHash, _recipient, msg.sender);

        return certificateId;
    }

    /// @notice Issues multiple certificates in a single transaction.
    /// @param _certificateHashes SHA-256 hashes of certificate JSON payloads.
    /// @param _recipients Recipient addresses for each certificate.
    /// @param _certType Shared certificate type for the batch.
    /// @param _programName Shared program name for the batch.
    /// @param _metadataURIs Metadata URIs for each certificate.
    /// @return Array of newly created certificate ids.
    function batchIssueCertificates(
        bytes32[] memory _certificateHashes,
        address[] memory _recipients,
        CertificateType _certType,
        string memory _programName,
        string[] memory _metadataURIs
    ) public onlyVerifiedActiveIssuer returns (uint256[] memory) {
        require(_certificateHashes.length > 0, "Empty batch");
        require(_certificateHashes.length == _recipients.length, "Length mismatch");
        require(_certificateHashes.length == _metadataURIs.length, "Length mismatch");

        uint256[] memory certificateIds = new uint256[](_certificateHashes.length);

        for (uint256 i = 0; i < _certificateHashes.length; i++) {
            certificateIds[i] = issueCertificate(
                _certificateHashes[i],
                _recipients[i],
                _certType,
                _programName,
                0,
                _metadataURIs[i]
            );
        }

        return certificateIds;
    }

    // -------------------------------------------------------------------------
    // Certificate verification and retrieval
    // -------------------------------------------------------------------------

    /// @notice Verifies certificate state by hash.
    /// @dev If `exists` is false, callers must treat `status` as a placeholder value and rely on `exists`/`isValid`.
    /// @param _certificateHash Certificate hash to verify.
    /// @return exists True if the certificate exists.
    /// @return isValid True if the certificate is currently valid.
    /// @return status Effective status (includes Expired when applicable).
    /// @return issuer Issuer wallet address.
    /// @return recipient Recipient wallet address.
    function verifyCertificate(
        bytes32 _certificateHash
    ) public view returns (bool exists, bool isValid, CertificateStatus status, address issuer, address recipient) {
        uint256 certificateId = certificateIdByHash[_certificateHash];

        if (certificateId == 0) {
            exists = false;
            isValid = false;
            // Status is a placeholder when `exists` is false; consumers should branch by `exists` first.
            status = CertificateStatus.Valid;
            issuer = address(0);
            recipient = address(0);
            return (exists, isValid, status, issuer, recipient);
        }

        Certificate memory certificate = getCertificate(certificateId);
        exists = true;
        status = certificate.status;
        issuer = certificate.issuer;
        recipient = certificate.recipient;

        isValid = _isCertificateValid(certificate);
    }

    /// @notice Verifies certificate state by id and emits a verification event.
    /// @param _certificateId Certificate id to verify.
    /// @return True if the certificate is currently valid.
    function verifyCertificateById(uint256 _certificateId) public certificateMustExist(_certificateId) returns (bool) {
        Certificate memory certificate = getCertificate(_certificateId);
        bool isValid = _isCertificateValid(certificate);

        emit CertificateVerified(_certificateId, msg.sender);

        return isValid;
    }

    /// @notice Returns certificate data by id and reflects Expired status when applicable.
    /// @param _certificateId Certificate id.
    /// @return Certificate record.
    function getCertificate(uint256 _certificateId) public view certificateMustExist(_certificateId) returns (Certificate memory) {
        Certificate memory certificate = certificatesById[_certificateId];
        certificate.status = _effectiveCertificateStatus(certificate);

        return certificate;
    }

    /// @notice Returns certificate data by hash.
    /// @dev Finds certificate id first and reuses getCertificate.
    /// @param _certificateHash Certificate hash.
    /// @return Certificate record.
    function getCertificateByHash(bytes32 _certificateHash) public view returns (Certificate memory) {
        uint256 certificateId = certificateIdByHash[_certificateHash];
        require(certificateId != 0, "Certificate not found");

        return getCertificate(certificateId);
    }

    // -------------------------------------------------------------------------
    // Certificate revocation
    // -------------------------------------------------------------------------

    /// @notice Revokes an existing certificate.
    /// @param _certificateId Certificate id.
    /// @param _reason Human-readable reason for revocation.
    function revokeCertificate(uint256 _certificateId, string memory _reason) public certificateMustExist(_certificateId) {
        Certificate storage certificate = certificatesById[_certificateId];

            require(msg.sender == certificate.issuer, "Only issuing issuer can revoke");
        require(certificate.status != CertificateStatus.Revoked, "Already revoked");
        require(bytes(_reason).length > 0, "Reason required");

        certificate.status = CertificateStatus.Revoked;

        revocations[_certificateId] = Revocation({
            certificateId: _certificateId,
            revocationDate: block.timestamp,
            reason: _reason,
            revokedBy: msg.sender
        });

        emit CertificateRevoked(_certificateId, _reason, msg.sender);
    }

    /// @notice Revokes an existing certificate by hash.
    /// @param _certificateHash Certificate hash.
    /// @param _reason Human-readable reason for revocation.
    function revokeCertificateByHash(bytes32 _certificateHash, string memory _reason) public {
        uint256 certificateId = certificateIdByHash[_certificateHash];
        require(certificateId != 0, "Certificate not found");

        revokeCertificate(certificateId, _reason);
    }

    /// @notice Returns revocation data for a revoked certificate.
    /// @param _certificateId Certificate id.
    /// @return Revocation record.
    function getRevocation(uint256 _certificateId) public view returns (Revocation memory) {
        Revocation memory revocation = revocations[_certificateId];
        require(revocation.revocationDate != 0, "Not revoked");

        return revocation;
    }

    // -------------------------------------------------------------------------
    // Helper and query functions
    // -------------------------------------------------------------------------

    /// @notice Returns all certificate ids linked to a recipient address.
    /// @param _recipient Recipient wallet address.
    /// @return Array of certificate ids.
    function getRecipientCertificates(address _recipient) public view returns (uint256[] memory) {
        return recipientCertificates[_recipient];
    }

    /// @notice Returns all certificate ids linked to an issuer address.
    /// @param _issuer Issuer wallet address.
    /// @return Array of certificate ids.
    function getIssuerCertificates(address _issuer) public view returns (uint256[] memory) {
        return issuerCertificates[_issuer];
    }

    /// @notice Checks whether a certificate hash is registered.
    /// @param _certificateHash Certificate hash.
    /// @return True when the hash has an associated certificate.
    function certificateExists(bytes32 _certificateHash) public view returns (bool) {
        return usedHashes[_certificateHash];
    }

    /// @notice Checks whether a certificate is currently expired.
    /// @param _certificateId Certificate id.
    /// @return True if the certificate is expired.
    function isCertificateExpired(uint256 _certificateId) public view certificateMustExist(_certificateId) returns (bool) {
        Certificate memory certificate = certificatesById[_certificateId];
        return _effectiveCertificateStatus(certificate) == CertificateStatus.Expired;
    }

    /// @notice Computes effective certificate status with expiration rules applied.
    /// @param _certificate Certificate record to evaluate.
    /// @return Effective status.
    function _effectiveCertificateStatus(Certificate memory _certificate) internal view returns (CertificateStatus) {
        if (_certificate.status == CertificateStatus.Revoked) {
            return CertificateStatus.Revoked;
        }

        if (_certificate.expiryDate != 0 && block.timestamp > _certificate.expiryDate) {
            return CertificateStatus.Expired;
        }

        return CertificateStatus.Valid;
    }

    /// @notice Evaluates whether a certificate is currently valid.
    /// @param _certificate Certificate record to evaluate.
    /// @return True when certificate exists in valid status, issuer is authorized, and not expired.
    function _isCertificateValid(Certificate memory _certificate) internal view returns (bool) {
        return
            _certificate.id != 0 &&
            _effectiveCertificateStatus(_certificate) == CertificateStatus.Valid &&
            isAuthorizedIssuer(_certificate.issuer);
    }
}
