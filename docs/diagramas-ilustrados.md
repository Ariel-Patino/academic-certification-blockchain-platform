# Illustrated Diagrams

## Goal

This document provides actor-oriented visual descriptions of the platform flows.

## Main Actors

- Administrator
- Authorized Issuer
- Public Verifier
- Smart Contract
- Backend API
- Frontend App

## Issuer Registration Flow (Conceptual)

```text
Admin -> Smart Contract: registerIssuer(address)
Smart Contract -> Admin: confirmation / tx receipt
```

## Certificate Issuance Flow

```text
Issuer -> Frontend: submit certificate form
Frontend -> Backend: POST /api/certificates
Backend -> Smart Contract: issue transaction
Smart Contract -> Backend: tx result
Backend -> MongoDB: persist metadata
Backend -> Frontend: issuance response
```

## Public Verification Flow

```text
Verifier -> Frontend: enters verification code
Frontend -> Backend: GET /api/verify
Backend -> Smart Contract/MongoDB: resolve status
Backend -> Frontend: validity + issuer + traceability
```

## Revocation Flow

```text
Authorized Issuer -> Frontend: revoke request + reason
Frontend -> Backend: revoke endpoint
Backend -> Smart Contract: revoke transaction
Smart Contract -> Backend: revocation confirmed
Backend -> Frontend: updated status
```

## Monitoring Flow

```text
Frontend -> Backend: GET /api/architecture/stream (SSE)
Backend -> Frontend: status events (up/degraded/down)
```

## Notes

- These diagrams are explanatory and abstracted for communication.
- For implementation details, cross-check API and technical manual documents.
