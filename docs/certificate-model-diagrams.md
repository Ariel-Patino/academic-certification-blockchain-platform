# Certificate Model Diagrams

## Purpose

This document describes the conceptual and logical model of an academic certificate in the platform.

## Core Entities

- Certificate
- Issuer
- Student
- Verification Record
- Revocation Record

## Certificate Conceptual Model

```text
Certificate
  - tokenId
  - verificationCode
  - studentName
  - studentId
  - program
  - issueDate
  - issuerAddress
  - status (active|revoked)
  - txHash
```

## Logical Relationships

```text
Issuer (1) ---- (N) Certificate
Certificate (1) ---- (0..N) VerificationRecord
Certificate (1) ---- (0..1) RevocationRecord
```

## On-Chain vs Off-Chain Fields

### On-Chain (authoritative state)

- tokenId
- issuer authorization
- revocation status
- immutable identity references

### Off-Chain (operational metadata)

- student display fields
- pagination/search indexing
- dashboard metrics
- optional cached verification data

## Status Lifecycle

```text
Draft -> Issued -> Verified (many times)
                   -> Revoked (terminal for validity)
```

## Diagram Notes

- Verification can happen multiple times without changing certificate ownership/state.
- Revocation changes validity status but preserves traceability.
