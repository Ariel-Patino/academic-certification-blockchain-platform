# Application Flow Diagrams

Last updated: March 29, 2026

This document includes the main functional flows of the application with actors, entities, and decisions.

Illustrated visual version: see docs/illustrated-diagrams.md

Certificate structural diagrams: see docs/certificate-model-diagrams.md

Viewing recommendation: for better Mermaid rendering, open docs/illustrated-diagrams.md in a dedicated app (Windows: Typedown; macOS: Mark Text, Typora, or Mermaid Chart). In browser or VS Code preview, it may appear less readable.

## Entities and actors

- Verifier user
- Issuer
- Frontend (Next.js)
- Backend API (Express)
- AcademicCertification Smart Contract (ERC-721)
- MongoDB
- Blockchain network

## 1) General navigation map

```mermaid
flowchart TD
	A[Home] --> B[Issue certificate]
	A --> C[Batch issuance]
	A --> D[Verify certificate]
	A --> E[Revoke certificate]
	A --> F[Historical registry]

	B --> B1[Single issuance form]
	C --> C1[CSV upload and processing]
	D --> D1[Verify by code]
	D --> D2[Verify by file]
	E --> E1[Validate issuer session]
	F --> F1[Paginated list]
```

## 2) Issuer authentication flow

```mermaid
sequenceDiagram
	actor Issuer
	participant FE as Frontend
	participant BE as Backend API
	participant BC as Blockchain

	Issuer->>FE: Connect wallet
	FE->>BE: Request authentication nonce
	BE-->>FE: Nonce + message
	Issuer->>FE: Sign message
	FE->>BE: Send signature for verification
	BE->>BC: Validate issuer state
	BC-->>BE: Authorized issuer
	BE-->>FE: Session token
	FE-->>Issuer: Active session
```

## 3) Single issuance flow

```mermaid
sequenceDiagram
	actor Issuer
	participant FE as Frontend
	participant BE as Backend API
	participant DB as MongoDB
	participant SC as Smart Contract

	Issuer->>FE: Complete issuance form
	FE->>BE: POST certificate issuance
	BE->>BE: Validate data
	BE->>SC: Register certificate on-chain
	SC-->>BE: certificateId + txHash
	BE->>DB: Persist document and metadata
	DB-->>BE: Confirmation
	BE-->>FE: Issuance result
	FE-->>Issuer: Show code, status, and receipt
```

## 4) Batch issuance flow

```mermaid
flowchart TD
	A[Issuer uploads CSV] --> B[Frontend validates format]
	B -->|Valid| C[Send batch to backend]
	B -->|Invalid| B1[Show file errors]

	C --> D[Backend processes each record]
	D --> E[Validate record data]
	E -->|OK| F[Issue in smart contract]
	E -->|Error| G[Mark record as error]

	F --> H[Persist in MongoDB]
	H --> I[Add result to summary]
	G --> I

	I --> J{Records remaining?}
	J -->|Yes| D
	J -->|No| K[Return batch summary]
	K --> L[Frontend shows results table]
```

## 5) Verification by code flow

```mermaid
sequenceDiagram
	actor User as Verifier user
	participant FE as Frontend
	participant BE as Backend API
	participant SC as Smart Contract

	User->>FE: Enter verification code
	FE->>BE: GET verification by code
	BE->>SC: Query certificate status
	SC-->>BE: Valid / Revoked / Expired
	BE-->>FE: Verification result
	FE-->>User: Show authenticity and status
```

## 6) Verification by file flow

```mermaid
flowchart TD
	A[User uploads certificate file] --> B[Frontend validates structure]
	B -->|Valid| C[Extract verification code]
	B -->|Invalid| B1[Show format error]

	C --> D[Query status by code]
	D --> E[Compare document integrity]
	E -->|Match| F[Valid result]
	E -->|No match| G[Invalid result]

	F --> H[Show final status to user]
	G --> H
```

## 7) Revocation flow

```mermaid
sequenceDiagram
	actor Issuer
	participant FE as Frontend
	participant SC as Smart Contract
	participant BE as Backend API
	participant DB as MongoDB

	Issuer->>FE: Enter ID and official reason
	FE->>SC: Execute signed revocation
	SC-->>FE: Revocation txHash
	FE->>BE: Notify/query updated state
	BE->>SC: Confirm revoked state
	SC-->>BE: Revoked state
	BE->>DB: Update certificate status
	BE-->>FE: Final confirmation
	FE-->>Issuer: Show successful revocation
```

## 8) Paginated historical registry flow

```mermaid
flowchart TD
	A[Issuer opens historical registry] --> B[Frontend requests certificates by issuer]
	B --> C[Backend returns list]
	C --> D[Frontend computes pagination]

	D --> E[Show current page]
	E --> F[Selector: 10 / 25 / 50 / 100]
	E --> G[Previous button]
	E --> H[Next button]

	F --> I[Recalculate total pages]
	I --> E

	G --> J{Current page > 1?}
	J -->|Yes| K[Go to previous page]
	J -->|No| L[Stay on first page]
	K --> E
	L --> E

	H --> M{Current page < total?}
	M -->|Yes| N[Go to next page]
	M -->|No| O[Stay on last page]
	N --> E
	O --> E
```

## 9) UI error handling flow

```mermaid
flowchart TD
	A[User performs action] --> B{Successful response?}
	B -->|Yes| C[Show result and status]
	B -->|No| D{Error type}

	D --> E[Data validation]
	D --> F[Invalid session]
	D --> G[Network or node unavailable]
	D --> H[Transaction error]

	E --> I[Show message and allow correction]
	F --> J[Request reconnection and re-authentication]
	G --> K[Show warning and retry]
	H --> L[Show details and keep traceability]
```

## 10) Coverage and unit testing flow

```mermaid
flowchart LR
	A[Developer] --> B[Run backend unit tests]
	A --> C[Run frontend unit tests]
	A --> D[Run backend coverage]
	A --> E[Run frontend coverage]
	A --> F[Run contracts coverage]

	B --> G[Test report]
	C --> G
	D --> H[Coverage report]
	E --> H
	F --> H
```

Associated commands:

- backend unit test: npm test
- frontend unit test: npm test
- backend coverage: npm run test:coverage
- frontend coverage: npm run test:coverage
- contracts coverage: npm run hh:coverage
