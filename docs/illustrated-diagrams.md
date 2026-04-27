# Illustrated Diagrams (Mermaid)

Last updated: March 29, 2026

This document contains a visual version of the flows with a sketch-style look (blocks, colors, and role-based lanes).

## Viewing recommendation

To view these diagrams with better quality, open this file in a Markdown app with a dedicated Mermaid engine.

- Windows: Typedown (recommended).
- macOS: equivalent with Mermaid support (for example, Mark Text, Typora, or Mermaid Chart).

Note: in some browsers and in VS Code preview, rendering may appear with incomplete styles or reduced readability.

## 1) Visual application map

```mermaid
flowchart LR
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111,stroke-width:1px;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111,stroke-width:1px;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111,stroke-width:1px;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111,stroke-width:1px;
  classDef db fill:#ffe8e8,stroke:#c62828,color:#111,stroke-width:1px;

  U[User / Issuer]:::user --> FE[Frontend Next.js]:::fe
  FE --> BE[Backend API Express]:::be
  BE --> SC[Smart Contract AcademicCertification]:::bc
  BE --> DB[(MongoDB)]:::db
  FE --> V[Verify View]:::fe
  FE --> I[Issue View]:::fe
  FE --> R[Revoke View]:::fe
  FE --> H[Paginated History View]:::fe
```

## 2) Single issuance (swimlanes)

```mermaid
flowchart TB
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111;
  classDef db fill:#ffe8e8,stroke:#c62828,color:#111;

  subgraph L1[Issuer lane]
    A1[Complete form]:::user
    A2[Confirm issuance]:::user
  end

  subgraph L2[Frontend lane]
    B1[Validate fields]:::fe
    B2[Send POST request]:::fe
    B3[Show code + status]:::fe
  end

  subgraph L3[Backend lane]
    C1[Validate business rules]:::be
    C2[Build canonical payload]:::be
    C3[Prepare record]:::be
    C4[Response to frontend]:::be
  end

  subgraph L4[Infraestructura]
    D1[Register in smart contract]:::bc
    D2[(Save in MongoDB)]:::db
  end

  A1 --> A2 --> B1 --> B2 --> C1 --> C2 --> C3
  C3 --> D1 --> D2 --> C4 --> B3
```

## 3) Batch issuance (with decisions)

```mermaid
flowchart TD
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef err fill:#ffe0e0,stroke:#b71c1c,color:#111;

  U1[Upload CSV]:::user --> FE1[Validate CSV format]:::fe
  FE1 --> Q1{Valid CSV?}
  Q1 -->|No| E1[Show format errors]:::err
  Q1 -->|Yes| FE2[Send batch]:::fe
  FE2 --> BE1[Process record by record]:::be
  BE1 --> Q2{Valid record?}
  Q2 -->|No| E2[Mark record with error]:::err
  Q2 -->|Yes| BE2[Issue + persist]:::be
  E2 --> BE3[Add to summary]:::be
  BE2 --> BE3
  BE3 --> Q3{Records remaining?}
  Q3 -->|Yes| BE1
  Q3 -->|No| FE3[Show batch results]:::fe
```

## 4) Verification (code or file)

```mermaid
flowchart LR
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111;

  U[User]:::user --> M{Method}:::fe
  M -->|Code| FE1[Enter code]:::fe
  M -->|File| FE2[Upload certificate]:::fe

  FE1 --> BE1[Query status]:::be
  FE2 --> FE3[Validate file structure]:::fe
  FE3 --> BE1

  BE1 --> SC[Query on-chain status]:::bc
  SC --> BE2[Build result]:::be
  BE2 --> FE4[Show valid/revoked/expired]:::fe
```

## 5) Revocation

```mermaid
flowchart TB
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111;
  classDef db fill:#ffe8e8,stroke:#c62828,color:#111;

  U1[Issuer enters ID + reason]:::user --> FE1[Validate session and network]:::fe
  FE1 --> BC1[Sign and send revocation]:::bc
  BC1 --> FE2[Receive txHash]:::fe
  FE2 --> BE1[Request updated state]:::be
  BE1 --> BC2[Query revoked state]:::bc
  BC2 --> DB1[(Update state in MongoDB)]:::db
  DB1 --> FE3[Show successful revocation]:::fe
```

## 6) Paginated history

```mermaid
flowchart TD
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef ui fill:#fff4cc,stroke:#b38f00,color:#111;

  FE1[Open historical registry]:::fe --> BE1[GET certificates by issuer]:::be
  BE1 --> FE2[Render table]:::fe
  FE2 --> UI1[Per-page selector: 10/25/50/100]:::ui
  FE2 --> UI2[Previous]:::ui
  FE2 --> UI3[Next]:::ui

  UI1 --> FE3[Recalculate pages and return to page 1]:::fe
  UI2 --> Q1{Page > 1?}
  UI3 --> Q2{Page < total?}
  Q1 -->|Yes| FE4[Previous page]:::fe
  Q1 -->|No| FE5[Stay on first]:::fe
  Q2 -->|Yes| FE6[Next page]:::fe
  Q2 -->|No| FE7[Stay on last]:::fe
```

## 7) Testing and coverage map

```mermaid
flowchart LR
  classDef dev fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef rep fill:#dff3ff,stroke:#1b6ca8,color:#111;

  D[Development]:::dev --> T1[Backend unit tests]:::rep
  D --> T2[Frontend unit tests]:::rep
  D --> T3[Backend coverage]:::rep
  D --> T4[Frontend coverage]:::rep
  D --> T5[Contracts coverage]:::rep
```

Commands:

- backend unit test: npm test
- frontend unit test: npm test
- backend coverage: npm run test:coverage
- frontend coverage: npm run test:coverage
- contracts coverage: npm run hh:coverage
