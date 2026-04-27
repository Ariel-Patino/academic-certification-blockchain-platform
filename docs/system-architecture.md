# System Architecture

Last updated: March 29, 2026

## Overview

The project is organized into three main layers:

1. Smart contracts (Solidity).
2. Backend API (Node.js/Express/TypeScript).
3. Web frontend (Next.js/React/TypeScript).

## Contract layer

- Main contract: AcademicCertification.
- NFT base: ERC-721 via OpenZeppelin.
- Key functions: issuer management, issuance, verification, and revocation.

## Backend layer

Responsibilities:

- Expose REST endpoints.
- Apply domain validations.
- Integrate MongoDB persistence.
- Orchestrate contract calls through ethers.
- Manage issuer authentication.

Relevant modules:

- controllers
- services
- models
- routes
- middlewares

## Frontend layer

Responsibilities:

- Capture issuance data.
- Display verification results.
- Manage revocation through the interface.
- Show certificate history with pagination.

Main routes:

- /
- /issue
- /batch
- /verify
- /revoke
- /certificates

## Summary flow

1. Issuer authenticates session.
2. Issues certificate.
3. Backend records and persists evidence.
4. Contract reflects on-chain status.
5. User verifies by code or document.
6. When required, issuer revokes.
