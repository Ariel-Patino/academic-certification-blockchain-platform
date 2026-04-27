# REST API

Last updated: March 29, 2026

This document summarizes the main backend API surface, authentication requirements, and endpoints consumed by the frontend.

Local base URL:

```text
http://localhost:3001
```

Interactive documentation:

```text
http://localhost:3001/api-docs
```

## 1. General conventions

- Exchange format: JSON.
- Public health check: `GET /health`.
- Protected endpoints use `Authorization: Bearer <jwt>`.
- JWT is obtained through SIWE authentication.
- Certificate revocation is non-custodial from frontend to contract; backend synchronizes state and audit.

## 2. Authentication

### POST /api/auth/nonce

Requests a nonce and SIWE message for the issuer to sign with a wallet.

Request example:

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

Expected response:

- nonce
- SIWE message
- nonce expiration date

### POST /api/auth/verify

Verifies the SIWE signature and returns the issuer JWT.

Request example:

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "nonce": "3f4e5a...",
  "signature": "0xdeadbeef..."
}
```

Expected response:

- JWT token
- role
- issuer address
- expiration time

## 3. Health and architecture

### GET /health

Checks whether the backend is operational.

### GET /api/architecture

Returns aggregated health status for:

- Polygon Amoy
- IPFS
- MongoDB

Recommended usage:

- local environment diagnostics
- pre-demo validation
- external integration checks

### GET /api/architecture/stream

Server-Sent Events (SSE) channel for dashboards and real-time monitoring.

Behavior:

- emits periodic snapshots of global status
- publishes `architecture` events
- includes `overallStatus` and per-service status

Recommended usage:

- operational dashboards
- visual degradation alerts in frontend

## 4. Issuer

### GET /api/issuer/status

Queries the on-chain status of the connected issuer or issuer requested by the app.

Returns data such as:

- whether it is active
- issuer address
- chainId
- contract address

## 5. Certificates

### GET /api/certificates?issuer=0x...

Lists certificates issued by an issuer address.

Main usage:

- frontend history view
- refresh records by wallet

### POST /api/certificates

Protected endpoint for single issuance.

Requires:

- valid Bearer token
- on-chain authorized issuer

Minimum payload:

```json
{
  "studentName": "Ada Lovelace",
  "studentId": "A2026-001",
  "recipientEmail": "ada@example.com",
  "programName": "Blockchain Engineering",
  "institutionName": "Universidad TFM"
}
```

Relevant optional fields:

- `badgeDescription`
- `issuerUrl`
- `issuedAt`
- `recipient`
- `certType`
- `expiryDate`
- `certificateId`
- `replacesCertificateHash`

Typical response:

- final issued document
- `certificateHash`
- `verificationUrl`
- `metadataURI`
- blockchain data such as `txHash`, `certificateId`, `chainId`, and `contractAddress`

### POST /api/certificates/batch

Protected endpoint for batch issuance.

Requires:

- valid Bearer token
- certificate list in request body

Base payload:

```json
{
  "certificates": [
    {
      "studentName": "Grace Hopper",
      "studentId": "A2026-002",
      "recipientEmail": "grace@example.com",
      "programName": "Computer Science",
      "institutionName": "Universidad TFM"
    }
  ]
}
```

Response includes consolidated progress and per-record results.

## 6. Verification

### GET /api/verify?certificateHash=0x...

Queries certificate status by hash using query string.

### POST /api/verify

Allows the same hash query using JSON body.

Example:

```json
{
  "certificateHash": "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd"
}
```

Result may include:

- on-chain existence
- validity
- status
- issuer
- recipient
- issuance date
- issuer name
- replacement information when available

### POST /api/verify/document

Verifies a full JSON document.

Combined validations:

- Open Badges v2 structure
- payload integrity
- cryptographic signature
- signer match
- on-chain status
- issuer authorization
- time consistency
- optional hashed identity match

This endpoint is the richest semantically and technically for end-to-end validation.

## 7. Audit

### GET /api/audit-logs

Queries audit events, especially useful for revocations and traceability.

Supported parameters:

- `certificateHash`
- `revokedBy`
- `eventType`
- `fromBlock`
- `toBlock`
- `limit`
- `offset`

Recommended usage:

- historical revocation inspection
- processed event analysis
- technical support and academic auditing

## 8. Authentication and permissions

JWT-protected endpoints:

- `POST /api/certificates`
- `POST /api/certificates/batch`

Important notes:

- Backend validates that the Bearer token is valid.
- Backend validates that issuer is still authorized on-chain.
- Revocation does not go through a backend REST endpoint.

## 9. Common API errors

## 10. Applied backend optimizations

- Hash verification with in-memory TTL cache to avoid redundant calls.
- Architecture status stream via SSE for real-time notifications.
- Optional automatic webhook alerts using `ALERT_WEBHOOK_URL`.

Frequent errors:

- `401 UNAUTHORIZED`: missing token or invalid token.
- `403 FORBIDDEN`: unauthorized issuer or certificate issued by another issuer.
- `409 REVOKED`: queried certificate was revoked.
- `400`: invalid payload, malformed hash, or inconsistent document.

For operational descriptions of common environment failures, see `docs/local-operations-troubleshooting.md`.