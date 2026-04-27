# Technical Manual: Data Flow and Operations

Last updated: March 29, 2026

## 1. Objective

This document describes the technical flow of the academic certification platform, from data capture in frontend to on-chain registration and off-chain persistence. It also summarizes involved components, required variables, and system validation commands.

Recommended complements:

- General architecture: see docs/system-architecture.md
- Functional flows: see docs/functional-diagrams.md
- Certificate structural diagrams: see docs/certificate-model-diagrams.md

## 2. System scope

The project is divided into three main domains:

1. Next.js frontend for user interface and wallet connection.
2. Express and TypeScript backend for orchestration, validations, persistence, and authentication.
3. Solidity smart contracts for on-chain issuance, verification, and revocation.

Relevant external services:

- Polygon Amoy as test blockchain network.
- MongoDB for operational persistence.
- IPFS, via Pinata, to store the certificate JSON document.
- MetaMask for session signatures and client-side transactions.

## 3. Components and responsibilities

### 3.1 Frontend

Main responsibilities:

- Capture single and batch issuance data.
- Manage wallet connection and issuer session.
- Request verification by code or document.
- Trigger revocations from the interface.
- Query issued certificate history.

Main routes:

- /issue
- /batch
- /verify
- /revoke
- /certificates

### 3.2 Backend

Main responsibilities:

- Validate business rules.
- Build Open Badges v2 compatible certificate document.
- Canonicalize, hash, and sign the cryptographic proof.
- Publish metadata to IPFS.
- Execute on-chain operations against AcademicCertification.
- Persist evidence and metadata in MongoDB.
- Verify status, issuer, signature, integrity, and validity.
- Run background processes, such as revocation listener and expiration cron.

Relevant modules:

- config
- controllers
- services
- models
- routes
- middlewares

### 3.3 Contracts

Main contract:

- AcademicCertification

Main capabilities:

- Single certificate issuance.
- Batch issuance.
- Certificate revocation.
- Query by hash.
- Query by ID.
- Issuer authorization verification.

## 4. General technical flow

The base system technical flow is:

1. Frontend captures certificate or batch information.
2. Backend receives the request and normalizes payload.
3. Data structure and required fields are validated.
4. An Open Badges v2 compatible hash-anchor document is built.
5. Backend computes certificateHash over the canonical document.
6. Backend cryptographically signs the hash.
7. Provisional document is generated and published to IPFS.
8. Backend registers the certificate in the smart contract.
9. Operational references are persisted in MongoDB.
10. Frontend receives result and shows code, status, txHash, and verification links.

## 5. Single issuance flow

Single issuance is primarily supported by backend certificate service.

Technical summary:

1. An IssueCertificateInput is received.
2. A normalized CertificatePayload is built.
3. `studentName`, `studentId`, `programName`, and `institutionName` are validated.
4. A random salt is generated to protect recipient identity.
5. `recipient.identity` is derived with SHA-256 over `email:salt`.
6. `badge`, `recipient`, `verification`, and `status` blocks are built.
7. Provisional document is validated with Open Badges v2 rules.
8. `certificateHash` is computed and signed with EIP-191.
9. JSON is uploaded to IPFS.
10. `issueCertificate` is called on contract.
11. Operational record is persisted in MongoDB.
12. Final document is returned with `metadataURI`, `transactionHash`, and `certificateId`.

Relevant details:

- Email hash is not stored as plain email.
- Recipient salt is embedded in the document delivered to holder.
- In re-issuance scenarios, the system can automatically invalidate previous certificate if secondary operation completes successfully.

## 6. Batch issuance flow

Batch issuance follows the same base logic as single issuance, but applied to multiple records loaded from CSV.

Technical considerations:

- Frontend validates and parses CSV before sending.
- Interface shows a partial preview of content.
- During processing, upload and anchoring progress is reported.
- Results can include successes and per-record errors.

This flow shares business rules with single issuance, with progress control and consolidated results.

## 7. Verification flow

The system supports two technical verification variants.

### 7.1 Verification by code

1. Frontend sends `certificateHash`.
2. Backend validates hash format.
3. On-chain status is queried with `verifyCertificate`.
4. If found, data is expanded with `getCertificateByHash` and issuer profile.
5. MongoDB persistence is queried for additional information, such as replacements.
6. Final status is returned to client.

Possible states:

- Valid
- Revoked
- Expired
- Not found

### 7.2 Verification by document

Document verification combines structural, cryptographic, and on-chain checks.

Technical sequence:

1. Validate JSON against Open Badges v2.
2. Recompute hash from normalized payload.
3. Verify `proof.signatureValue` signature.
4. Recover signer and compare against expected issuer.
5. Query blockchain to confirm existence, status, issuer, and dates.
6. Verify whether issuer is still authorized.
7. Check time consistency between `issuedOn` and on-chain date.
8. Optionally compare user email with hashed identity in document.
9. Return aggregated result with `overallValid` and semantic error codes when applicable.

Relevant semantic errors:

- SCHEMA_VALIDATION_FAILED
- INTEGRITY_MISMATCH
- AUTHENTICITY_ERROR
- ISSUER_NOT_AUTHORIZED
- TIMESTAMP_MISMATCH
- RECIPIENT_IDENTITY_MISMATCH
- REVOKED
- EXPIRED
- NOT_FOUND

## 8. Revocation flow

Revocation involves client, contract, and persistence.

Technical sequence:

1. Frontend requires MetaMask, issuer session, and correct network.
2. User enters `certificateId` and reason.
3. Revocation transaction is executed.
4. Contract emits `CertificateRevoked` event.
5. Backend can query or refresh resulting state.
6. Revocation listener synchronizes MongoDB and generates audit traceability.

Backend includes a listener that:

- performs back-fill of historical events,
- listens to `CertificateRevoked` events,
- updates certificate status in database,
- records audit events with block and transaction.

## 9. Off-chain persistence

MongoDB is used for operational persistence and auxiliary queries.

Commonly persisted data:

- `certificateHash`
- `issuerAddress`
- `recipientEmailHash`
- `status`
- `ipfsCID`
- `metadataURI`
- `certificateId`
- `txHash`
- replacement or re-issuance information

Database does not replace blockchain as final source of truth for validity or revocation. Its goal is to improve querying, traceability, and operational consistency.

## 10. Issued document model

Final issued document follows Open Badges v2 structure with blocks such as:

- `@context`
- `id`
- `type`
- `issuedOn`
- `badge`
- `verification`
- `recipient`
- `proof`
- `blockchain`
- `status`

To see visual model and relationships among proof, blockchain, and IPFS, consult docs/certificate-model-diagrams.md.

## 11. Relevant environment variables

### 11.1 Backend

Required or primary-use variables:

```env
PORT=3001
RPC_URL=https://...
PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...
CHAIN_ID=80002
FRONTEND_BASE_URL=http://localhost:3000
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DATABASE_NAME=tfm_certificacion_blockchain
PINATA_JWT=
PINATA_API_KEY=
PINATA_API_SECRET=
PINATA_BASE_URL=https://api.pinata.cloud
JWT_SECRET=...
JWT_ISSUER=tfm-certificacion-backend
JWT_AUDIENCE=tfm-certificacion-frontend
JWT_EXPIRES_IN=2h
SIWE_NONCE_TTL_SECONDS=300
```

Notes:

- Correct names are `MONGO_URI` and `MONGO_DATABASE_NAME`.
- Private keys, real JWT tokens, and Pinata credentials must never be published in shared documentation.

### 11.2 Frontend

Typical variables:

```env
NEXT_PUBLIC_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

### 11.3 Contracts

Common variables for deployment or migration:

```env
RPC_URL=https://...
PRIVATE_KEY=0x...
MNEMONIC=
POLYGONSCAN_API_KEY=
```

## 12. Recommended local execution

### 12.1 MongoDB database

For local environment, MongoDB can be started with Docker:

```bash
docker run -d --name tfm-mongo -p 27017:27017 mongo:7
```

### 12.2 Contracts

```bash
cd contracts
npm install
npm run compile
```

### 12.3 Backend

```bash
cd backend
npm install
npm run build
npm run dev
```

### 12.4 Frontend

```bash
cd frontend
npm install
npm run build
npm run dev
```

## 13. Technical validation commands

### Build

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

Contracts:

```bash
cd contracts
npm run compile
```

### Tests

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm test
```

Contracts:

```bash
cd contracts
npm run test
```

### Coverage

Backend:

```bash
cd backend
npm run test:coverage
```

Frontend:

```bash
cd frontend
npm run test:coverage
```

Contracts:

```bash
cd contracts
npm run hh:coverage
```

## 14. Risks and operational notes

- Revocation listener depends on RPC provider and can be affected by plan limits.
- Source of truth for certificate state is blockchain, not MongoDB.
- Batch issuance requires per-record error control to avoid massive inconsistencies.
- Issuer session and active MetaMask network are functional preconditions, not only UI preconditions.
- Re-issuances can require later revocation of old certificate if automatic revocation does not complete.

## 15. Summary

Platform implements a hybrid model:

- blockchain for state and verifiable evidence,
- IPFS for document distribution,
- MongoDB for operational persistence,
- backend for orchestration and validation,
- frontend for capture, verification, and user experience.

This responsibility split enables independently verifiable certificate issuance, operational traceability, and a useful interface for issuance, lookup, and invalidation.
