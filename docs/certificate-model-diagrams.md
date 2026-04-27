# Certificate Structure and Verification Diagrams

Last updated: March 29, 2026

This document summarizes the logical certificate structure, the relationship between off-chain and on-chain components, and the independent third-party verification process.

## 1) Certificate document structure

```mermaid
flowchart TB
    C[AcademicCertificateDocument]

    C --> M1["@context"]
    C --> M2[id]
    C --> M3[type Assertion]
    C --> M4[issuedOn]
    C --> B[badge]
    C --> V[verification]
    C --> R[recipient]
    C --> P[proof]
    C --> BC[blockchain]
    C --> S[status]

    B --> B1[name]
    B --> B2[description]
    B --> BI[issuer]
    BI --> BI1[name]
    BI --> BI2[url]

    V --> V1[type BlockchainSignature]
    V --> V2[publicKey]
    V --> V3[verificationMethod]

    R --> R1[type email]
    R --> R2[identity hash]
    R --> R3[salt]
    R --> R4[hashed true]

    P --> P1[certificateHash]
    P --> P2[hashAlgorithm]
    P --> P3[signatureType]
    P --> P4[signatureValue]
    P --> P5[signerAddress]
    P --> P6[verificationMethod]

    BC --> BC1[network]
    BC --> BC2[chainId]
    BC --> BC3[contractAddress]
    BC --> BC4[transactionHash]
    BC --> BC5[certificateId]
    BC --> BC6[metadataURI]

    S --> S1[current]
    S --> S2[revocationReason]
    S --> S3[revokedAt]
    S --> S4[revokedBy]
```

## 2) Relationship between sources of truth

```mermaid
flowchart LR
    E[Issuer] --> FE[Frontend]
    FE --> BE[Backend API]

    BE --> CAN[Canonicalization RFC 8785]
    CAN --> HASH[SHA-256 certificateHash]
    HASH --> SIG[EIP-191 signature]

    BE --> IPFS[IPFS metadataURI]
    BE --> DB[MongoDB off-chain persistence]
    BE --> SC[Smart Contract AcademicCertification]

    SC --> ON1[certificateId]
    SC --> ON2[status]
    SC --> ON3[authorized issuer]
    SC --> ON4[txHash]

    IPFS --> DOC[Open Badges v2 document]
    HASH --> DOC
    SIG --> DOC
    ON1 --> DOC
    ON2 --> DOC
    ON4 --> DOC

    DOC --> VF[External verifier]
    SC --> VF
```

## 3) Independent verification flow

```mermaid
sequenceDiagram
    actor V as Verifier
    participant IPFS as IPFS
    participant DOC as JSON Document
    participant LOCAL as Local validator
    participant RPC as RPC Blockchain
    participant SC as Smart Contract

    V->>IPFS: Download metadataURI
    IPFS-->>V: Open Badges v2 document
    V->>DOC: Read structure and proof

    V->>LOCAL: Validate schema
    LOCAL-->>V: Valid structure

    V->>LOCAL: Canonicalize and compute hash
    LOCAL-->>V: Reproduced certificateHash

    V->>LOCAL: Recover signer from signatureValue
    LOCAL-->>V: signerAddress

    V->>DOC: Read verificationMethod
    V->>RPC: Connect to indicated chainId
    RPC->>SC: Query certificateId / status / issuer
    SC-->>RPC: On-chain status
    RPC-->>V: Verifiable result

    V->>V: Compare proof, signer, and status
```

## 4) Critical validation map

```mermaid
flowchart TD
    A[Received document] --> B{Valid Open Badges v2 schema}
    B -->|No| X1[Reject document]
    B -->|Yes| C{Reproduced hash}
    C -->|No| X2[Altered document]
    C -->|Yes| D{Recovered signature matches expected signer}
    D -->|No| X3[Invalid cryptographic proof]
    D -->|Yes| E{On-chain authorized issuer}
    E -->|No| X4[Unauthorized issuer]
    E -->|Yes| F{Certificate status}
    F -->|Valid| G[Valid certificate]
    F -->|Revoked| H[Revoked certificate]
    F -->|Expired| I[Expired certificate]
```

## Notes

- The document structure describes the issued and published certificate.
- The source of truth for final status remains the blockchain for validity, revocation, and issuer authorization.
- IPFS and MongoDB serve different roles: document distribution and operational persistence, respectively.