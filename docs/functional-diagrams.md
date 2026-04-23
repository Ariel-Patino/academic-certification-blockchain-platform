# Functional Diagrams

## Scope

This document describes the main functional flows of the platform in text-diagram format.

## 1) Authentication (SIWE + JWT)

```text
User Wallet -> Sign SIWE message
Frontend -> Backend /auth/verify
Backend -> validate signature + issue JWT
Frontend <- JWT for protected operations
```

## 2) Individual Issuance

```text
Issuer -> Frontend form
Frontend -> POST /api/certificates
Backend -> validate + call contract
Contract -> emit transaction result
Backend -> store metadata + return result
```

## 3) Batch Issuance (CSV)

```text
Issuer -> upload CSV
Frontend -> POST /api/certificates/batch
Backend -> parse CSV rows
Backend -> issue one record per row
Backend -> aggregate success/failure report
```

## 4) Verification by Code

```text
Verifier -> frontend input code
Frontend -> GET /api/verify
Backend -> query chain + metadata
Frontend <- validity status and details
```

## 5) Verification by Document

```text
Verifier -> upload file
Frontend -> POST /api/verify/document
Backend -> extract hash/reference
Backend -> resolve on-chain status
Frontend <- verification response
```

## 6) Revocation

```text
Authorized issuer -> revoke action
Frontend -> backend revoke endpoint
Backend -> contract revoke transaction
Frontend <- revoked status + reason traceability
```

## 7) Architecture Status Streaming

```text
Dashboard -> subscribe SSE /api/architecture/stream
Backend -> push periodic status updates
Dashboard -> live health visualization
```

## Reliability Notes

- Blockchain is source of truth for issuance and revocation status.
- Backend provides operational consistency and API contracts.
- Frontend prioritizes usability for institutional and public verification flows.
