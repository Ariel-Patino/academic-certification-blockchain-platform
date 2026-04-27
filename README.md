# Digital Academic Certification with Blockchain — TFM

## Description

Web system for issuing, verifying, revoking, and tracing academic credentials on blockchain. The project integrates a smart contract on Polygon Amoy with a REST API and an institutional web interface, allowing authorized issuers to issue academic certificates with verifiable cryptographic backing.

Each certificate is represented as an NFT (ERC-721), with its verification code anchored on-chain, and can be publicly validated by anyone without intermediaries. Revocation is also performed directly on the contract, leaving permanent traceability of the reason.

The system is designed to demonstrate that blockchain technology can practically solve authenticity and document fraud issues in the education sector.

## Problem It Solves

Academic titles on paper or in traditional digital formats are susceptible to forgery, tampering, and loss. Educational institutions lack public, decentralized, and automatically verifiable mechanisms to prove the authenticity of their issued credentials.

This project addresses that problem through immutable registration of academic credentials on blockchain. Any institution operating as an authorized issuer can issue a title anchored on-chain, assigning a unique verification code. Anyone with that code can validate the title's authenticity, validity status, and responsible issuer, without depending on the institution or any centralized intermediary.

## Technologies Used

- Blockchain: Polygon Amoy Testnet (chainId 80002)
- Smart Contracts: Solidity + OpenZeppelin ERC-721
- Contract tools: Truffle, Hardhat
- Backend: Node.js, Express, TypeScript
- Frontend: Next.js 15, React 19, TypeScript
- Database: MongoDB
- Authentication: Sign-In with Ethereum (EIP-4361) + JWT
- Libraries: ethers.js, Mongoose, Lucide React, jsPDF

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                           │
│  Next.js 15 · React 19 · TypeScript                 │
│  /issue · /batch · /verify · /revoke · /certificates│
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼──────────────────────────────┐
│                   BACKEND API                        │
│  Express · TypeScript · JWT + SIWE                  │
│  POST /api/certificates  GET /api/verify            │
│  POST /api/verify/document  POST /api/auth/*        │
└──────┬────────────────────────┬───────────────────── ┘
       │ ethers.js              │ Mongoose
┌──────▼──────────┐    ┌────────▼────────┐
│ Smart Contract  │    │    MongoDB       │
│ AcademicCert.   │    │ Certificates +  │
│ ERC-721 (Amoy)  │    │ Metadata        │
└─────────────────┘    └──────────────────┘
```

See full diagram: [docs/functional-diagrams.md](docs/functional-diagrams.md) · [docs/illustrated-diagrams.md](docs/illustrated-diagrams.md)

## Installation and Configuration

### Quick Start

```bash
# 1) Install dependencies
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install

# 2) Configure environment variables
cd ../contracts && cp .env.example .env
cd ../backend && cp .env.example .env
cd ../frontend && cp .env.local.example .env.local

# 3) Compile contracts
cd ../contracts && npm run compile

# 4) Start MongoDB
docker run -d --name tfm-mongo -p 27017:27017 mongo:7

# 5) Start backend and frontend
cd ../backend && npm run dev
cd ../frontend && npm run dev
```

### Prerequisites

- Node.js v18+
- npm
- MetaMask installed in the browser
- Docker (to run local MongoDB, optional)
- Access to a Polygon Amoy RPC node (Alchemy, Infura, or similar)

### Dependency Installation

```bash
# Smart contracts
cd contracts
npm install

# Backend
cd ../backend
npm install

# Frontend
cd ../frontend
npm install
```

### Compile Smart Contracts

```bash
cd contracts
npx truffle compile
```

### Configuration

1. Copy example environment files:

```bash
cd contracts && cp .env.example .env
cd ../backend && cp .env.example .env
cd ../frontend && cp .env.local.example .env.local
```

2. Configure main variables in `backend/.env`:

```env
PORT=3001
RPC_URL=<amoy-rpc-url>
PRIVATE_KEY=<issuer-private-key>
CONTRACT_ADDRESS=0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2
CHAIN_ID=80002
JWT_SECRET=<secure-secret>
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE_NAME=tfm_certificacion_blockchain
FRONTEND_BASE_URL=http://localhost:3000
```

3. Configure `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
NEXT_PUBLIC_CONTRACT_ADDRESS=0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2
```

4. Run local MongoDB with Docker:

```bash
docker run -d --name tfm-mongo -p 27017:27017 mongo:7
```

> Security note: the values above are examples. Do not publish private keys, tokens, or real credentials in the repository.

### Execution

Development mode:

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Local build mode:

Backend:

```bash
cd backend
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm run build
npm start
```

Access URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

### Common Issues

If you encounter errors such as port already in use, wrong MetaMask network, missing variables, or RPC/MongoDB connection issues, review the troubleshooting guide:

- [Troubleshooting and local operations](docs/local-operations-troubleshooting.md)

## Deployed Smart Contracts

- Network: Polygon Amoy Testnet
- Main Contract: `0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2`
- Explorer: [PolygonScan Amoy](https://amoy.polygonscan.com/address/0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2)

This address corresponds to the active contract used for TFM demos on Polygon Amoy.

## Use Cases

1. Authorized issuer registration by contract administrator.
2. Single academic title issuance with unique verification code.
3. Batch title issuance through CSV upload.
4. Public authenticity and status verification by code or file.
5. Certificate revocation by authorized issuer directly on contract.
6. Issuance history query with configurable pagination.

## Screenshots

[View /screenshots folder](./screenshots)

## Documentation Hub

The docs folder provides a complete reference set for architecture, operations, API behavior, and user workflows. If you are new to the project, start with the system architecture and user manual, then continue with the technical and API guides.

| Guide | Primary Audience | Purpose |
| --- | --- | --- |
| [System architecture](docs/system-architecture.md) | Developers, reviewers | High-level view of contracts, backend, frontend, and end-to-end flow. |
| [User manual](docs/user-manual.md) | Issuers, verifiers | Step-by-step guide for using issuance, verification, revocation, and history features. |
| [Technical manual](docs/amoy-data-flow-technical-manual.md) | Engineers, maintainers | Detailed data flow, validation logic, and operational model. |
| [REST API](docs/api-rest.md) | Backend/frontend developers, integrators | Main endpoints, auth model, request examples, and error semantics. |
| [Troubleshooting and local operations](docs/local-operations-troubleshooting.md) | Developers, operators | Common setup/runtime issues and practical fixes. |
| [Functional diagrams](docs/functional-diagrams.md) | Product, engineering, QA | Process diagrams for issuance, verification, revocation, and history. |
| [Illustrated diagrams](docs/illustrated-diagrams.md) | Stakeholders, presentations | Visual Mermaid diagrams with role-based lanes and decision points. |
| [Certificate structural diagrams](docs/certificate-model-diagrams.md) | Auditors, architects | Logical certificate model and independent verification map. |
| [Certificate schema](docs/certificate-schema.md) | Developers, data reviewers | Core fields, blockchain metadata, and minimum consistency rules. |

## Demo Video

[Watch demo video](https://www.loom.com/share/c1e399762132497cafc34e2972f0aad1)

## Implemented Innovations

- Certificate representation as NFT (ERC-721) on Polygon Amoy.
- Public verification without intermediaries by code or credential file.
- Non-custodial revocation: issuer signs directly on contract without backend intermediary.
- Single and batch issuance via CSV with record-by-record processing.
- Certificate history with configurable pagination (10, 25, 50, 100 items).
- Authentication with Sign-In with Ethereum (EIP-4361) + JWT.
- Institutional interface with language adapted to a university environment.
- Operational dashboard with live architecture health metrics (Polygon/IPFS/DB).
- Real-time frontend notification of service degradation/recovery.
- Dynamic light/dark theme with persistent client-side selector.
- SSE endpoint for architecture status streaming (GET /api/architecture/stream).
- TTL caching for hash verification to reduce repeated blockchain queries.
- Automatic webhook alerts when architecture enters degraded or down status.

## Use of AI Tools

This project included AI assistance as technical support to accelerate analysis, documentation, and functional improvements, while maintaining manual validation for every relevant change.

Tools used:

- GitHub Copilot Chat (GPT-5.3-Codex), for support in refactors, architecture adjustments, and implementation proposals.
- AI assistance for writing and improving technical and functional documentation (README, user manual, technical manual, REST API, troubleshooting).

Specific applications during development:

- Detection of documentation gaps and structuring documentation by audiences (user, technical, operations).
- Assisted proposal and implementation of incremental frontend and backend improvements (dashboard, real-time SSE status, TTL caching, webhook alerts, light/dark theme).
- Consistency review between environment configuration, exposed endpoints, and application functional flow.

Responsible usage criteria:

- AI was used as a support tool, not as a substitute for technical judgment.
- Final design, integration, and validation decisions were manually reviewed.
- AI was not used to expose credentials or automate actions outside developer control.

## Testing and Coverage

```bash
# Backend unit tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test

# Backend coverage
cd backend && npm run test:coverage

# Frontend coverage
cd frontend && npm run test:coverage

# Contracts coverage
cd contracts && npm run hh:coverage
```

## Author

- **Name:** Ariel Patino Flores
- **Email:** ariel.patino.f@gmail.com
- **LinkedIn:** [LinkedIn](https://www.linkedin.com/in/ariel-patino/)

## License

MIT License. See [LICENSE](LICENSE).
