import { Contract, JsonRpcProvider, Wallet, isAddress, isHexString } from "ethers";

import { env } from "./env";

const ACADEMIC_CERTIFICATION_ABI = [
  "event CertificateIssued(uint256 indexed certificateId, bytes32 indexed certificateHash, address indexed recipient, address issuer)",
  "event CertificateRevoked(uint256 indexed certificateId, string reason, address revokedBy)",
  "function issueCertificate(bytes32 _certificateHash, address _recipient, uint8 _certType, string _programName, uint256 _expiryDate, string _metadataURI) returns (uint256)",
  "function batchIssueCertificates(bytes32[] _certificateHashes, address[] _recipients, uint8 _certType, string _programName, string[] _metadataURIs) returns (uint256[])",
  "function revokeCertificate(uint256 _certificateId, string _reason)",
  "function verifyCertificate(bytes32 _certificateHash) view returns (bool exists, bool isValid, uint8 status, address issuer, address recipient)",
  "function getCertificate(uint256 _certificateId) view returns ((uint256 id, bytes32 certificateHash, address issuer, address recipient, uint8 certificateType, string programName, uint256 issuedDate, uint256 expiryDate, uint8 status, string metadataURI))",
  "function getCertificateByHash(bytes32 _certificateHash) view returns ((uint256 id, bytes32 certificateHash, address issuer, address recipient, uint8 certificateType, string programName, uint256 issuedDate, uint256 expiryDate, uint8 status, string metadataURI))",
  "function getIssuerCertificates(address _issuer) view returns (uint256[])",
  "function getIssuer(address _issuerAddress) view returns ((address issuerAddress, string name, string country, string website, uint256 registrationDate, uint8 status, bool isVerified))",
  "function isAuthorizedIssuer(address _issuerAddress) view returns (bool)",
  "function getRevocation(uint256 _certificateId) view returns ((uint256 certificateId, uint256 revocationDate, string reason, address revokedBy))"
] as const;

export const blockchainConfig = {
  rpcUrl: env.rpcUrl,
  privateKey: env.privateKey,
  contractAddress: env.contractAddress,
  chainId: env.chainId
} as const;

let providerInstance: JsonRpcProvider | null = null;
let walletInstance: Wallet | null = null;
let contractInstance: Contract | null = null;

const validateBlockchainConfig = (): void => {
  if (!isAddress(blockchainConfig.contractAddress)) {
    throw new Error("Invalid CONTRACT_ADDRESS. Expected a valid EVM address.");
  }

  if (!isHexString(blockchainConfig.privateKey, 32)) {
    throw new Error("Invalid PRIVATE_KEY. Expected a 32-byte hex private key.");
  }
};

export const getProvider = (): JsonRpcProvider => {
  validateBlockchainConfig();

  if (!providerInstance) {
    providerInstance = new JsonRpcProvider(blockchainConfig.rpcUrl, blockchainConfig.chainId);
  }

  return providerInstance;
};

export const getWallet = (): Wallet => {
  if (!walletInstance) {
    walletInstance = new Wallet(blockchainConfig.privateKey, getProvider());
  }

  return walletInstance;
};

export const getAcademicCertificationContract = (): Contract => {
  if (!contractInstance) {
    contractInstance = new Contract(
      blockchainConfig.contractAddress,
      ACADEMIC_CERTIFICATION_ABI,
      getWallet()
    );
  }

  return contractInstance;
};

export const academicCertificationAbi = ACADEMIC_CERTIFICATION_ABI;
