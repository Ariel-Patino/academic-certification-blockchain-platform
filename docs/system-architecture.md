# System Architecture

## Overview

The platform is organized into three primary layers:

1. Frontend (Next.js)
2. Backend API (Express + TypeScript)
3. Smart Contract Layer (Polygon Amoy)

A MongoDB database stores operational metadata and verification-related information.

## Layer Responsibilities

### Frontend

- Institutional user workflows
- Wallet connection and signing flow
- Certificate issuance/revocation screens
- Public verification UI
- Dashboard and service-health visualization

### Backend API

- Business rules and validation
- SIWE + JWT authentication
- Contract interaction orchestration through ethers.js
- Batch CSV processing and history APIs
- Caching and webhook alerting logic

### Blockchain / Contract

- Certificate issuance as ERC-721 tokens
- On-chain immutable state
- Revocation state transitions
- Issuer authorization enforcement

## Data and Control Flow

1. User action starts in frontend.
2. Backend validates request and authorization.
3. Backend executes blockchain transaction when required.
4. Backend persists metadata in MongoDB.
5. Frontend renders current state and verification output.

## Runtime Observability

- `/health` for basic backend availability
- `/api/architecture/status` for aggregated status
- `/api/architecture/stream` (SSE) for real-time updates
