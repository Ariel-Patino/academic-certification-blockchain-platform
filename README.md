# Academic Certification Blockchain Platform

## Description

Web platform for issuing, verifying, revoking, and tracking academic certificates on blockchain. The project integrates a smart contract on Polygon Amoy with a REST API and an institutional web interface, allowing authorized issuers to issue academic credentials with cryptographically verifiable backing.

Each certificate is represented as an NFT (ERC-721), with its verification code anchored on-chain, and can be publicly validated by anyone without intermediaries. Revocation is also executed directly on the contract, leaving a permanent trace of the reason.

The system is designed to demonstrate how blockchain technology can practically solve authenticity and document fraud issues in education.

## Problem It Solves

Academic credentials in paper format or traditional digital files are vulnerable to forgery, tampering, and loss. Educational institutions often lack public, decentralized, and automatically verifiable mechanisms to prove authenticity.

This project addresses that problem through immutable credential registration on blockchain. Any institution operating as an authorized issuer can issue a certificate anchored on-chain with a unique verification code. Any person with that code can validate authenticity, current status, and responsible issuer, without depending on the institution or a centralized intermediary.

## Technologies Used

- Blockchain: Polygon Amoy Testnet (chainId 80002)
- Smart Contracts: Solidity + OpenZeppelin ERC-721
- Contract tooling: Truffle, Hardhat
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
│ AcademicCert.   │    │ Certificados +  │
│ ERC-721 (Amoy)  │    │ Metadatos       │
└─────────────────┘    └──────────────────┘
```

Full diagram: [docs/diagramas.md](docs/diagramas.md) · [docs/diagramas-ilustrados.md](docs/diagramas-ilustrados.md)

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
- Docker (optional, to run MongoDB locally)
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

1. Copy the environment template files:

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

4. Start local MongoDB with Docker:

```bash
docker run -d --name tfm-mongo -p 27017:27017 mongo:7
```

> Security note: values above are examples. Do not commit private keys, tokens, or real credentials to the repository.

### Running the Project

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

If you encounter busy-port errors, wrong MetaMask network, missing variables, or RPC/MongoDB connection issues, check the troubleshooting guide:

- [Troubleshooting and local operations](docs/troubleshooting-operacion-local.md)

## Deployed Smart Contracts

- Network: Polygon Amoy Testnet
- Main contract: `0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2`
- Explorer: [PolygonScan Amoy](https://amoy.polygonscan.com/address/0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2)

This address corresponds to the active contract used for TFM demos on Polygon Amoy.

## Use Cases

1. Authorized issuer registration by contract administrator.
2. Individual academic certificate issuance with unique verification code.
3. Batch issuance through CSV upload.
4. Public authenticity and status verification by code or file.
5. Certificate revocation directly on contract by authorized issuer.
6. Issuance history browsing with configurable pagination.

## Screenshots

[View /screenshots folder](./screenshots)

## Documentation

- [System architecture](docs/arquitectura.md)
- [User manual](docs/manual-usuario.md)
- [Technical manual](docs/manual-tecnico-flujo-datos-amoy.md)
- [REST API](docs/api-rest.md)
- [Troubleshooting and local operations](docs/troubleshooting-operacion-local.md)
- [Functional diagrams](docs/diagramas.md)
- [Illustrated diagrams](docs/diagramas-ilustrados.md)
- [Certificate structural diagrams](docs/certificate-model-diagrams.md)

## Technical Diagrams

- [Functional flow diagram](docs/diagramas.md)
- [Illustrated diagrams with actors and entities](docs/diagramas-ilustrados.md)

## Demo Video

[Watch demo video](https://www.loom.com/share/c1e399762132497cafc34e2972f0aad1)

## Implemented Innovations

- Certificate representation as NFTs (ERC-721) on Polygon Amoy.
- Public intermediary-free verification by code or credential file.
- Non-custodial revocation: issuer signs directly on-chain without backend custody.
- Individual and batch issuance via CSV with record-by-record processing.
- Certificate history with configurable pagination (10, 25, 50, 100 items).
- Authentication with Sign-In with Ethereum (EIP-4361) + JWT.
- Institutional UX language tailored for university context.
- Operational dashboard with live architecture health metrics (Polygon/IPFS/DB).
- Real-time service degradation/recovery notifications in frontend.
- Dynamic light/dark theme with persistent client-side selector.
- SSE endpoint for architecture status streaming (GET /api/architecture/stream).
- TTL caching for hash verification to reduce repeated blockchain queries.
- Automatic webhook alerts when architecture enters degraded or down state.

## Use of AI Tools

This project used AI assistance as technical support to accelerate analysis, documentation, and functional improvements, while keeping manual validation for each relevant change.

Tools used:

- GitHub Copilot Chat (GPT-5.3-Codex), for refactoring support, architecture adjustments, and implementation proposals.
- AI assistance for drafting and improving technical and functional documentation (README, user manual, technical manual, REST API, troubleshooting).

Concrete applications during development:

- Detection of documentation gaps and restructuring by audience (user, technical, operations).
- Assisted proposal and implementation of incremental frontend/backend improvements (dashboard, real-time SSE status, TTL caching, webhook alerts, light/dark theme).
- Consistency review between environment configuration, exposed endpoints, and application flow.

Responsible usage criteria:

- AI was used as a support tool, not as a substitute for technical judgment.
- Final design, integration, and validation decisions were manually reviewed.
- AI was not used to expose credentials or automate actions outside developer control.

## Tests and Coverage

```bash
# Unit tests backend
cd backend && npm test

# Unit tests frontend
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
