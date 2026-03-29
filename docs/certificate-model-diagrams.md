# Diagramas de Estructura y Verificacion del Certificado

Fecha de actualizacion: 29 de marzo de 2026

Este documento resume la estructura logica del certificado, la relacion entre los componentes off-chain y on-chain, y el proceso de verificacion independiente de terceros.

## 1) Estructura del documento de certificado

```mermaid
flowchart TB
    C[AcademicCertificateDocument]

    C --> M1[@context]
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

## 2) Relacion entre fuentes de verdad

```mermaid
flowchart LR
    E[Emisor] --> FE[Frontend]
    FE --> BE[Backend API]

    BE --> CAN[Canonicalizacion RFC 8785]
    CAN --> HASH[SHA-256 certificateHash]
    HASH --> SIG[Firma EIP-191]

    BE --> IPFS[IPFS metadataURI]
    BE --> DB[MongoDB persistencia off-chain]
    BE --> SC[Smart Contract AcademicCertification]

    SC --> ON1[certificateId]
    SC --> ON2[status]
    SC --> ON3[issuer autorizado]
    SC --> ON4[txHash]

    IPFS --> DOC[Documento Open Badges v2]
    HASH --> DOC
    SIG --> DOC
    ON1 --> DOC
    ON2 --> DOC
    ON4 --> DOC

    DOC --> VF[Verificador externo]
    SC --> VF
```

## 3) Flujo de verificacion independiente

```mermaid
sequenceDiagram
    actor V as Verificador
    participant IPFS as IPFS
    participant DOC as Documento JSON
    participant LOCAL as Validador local
    participant RPC as RPC Blockchain
    participant SC as Smart Contract

    V->>IPFS: Descargar metadataURI
    IPFS-->>V: Documento Open Badges v2
    V->>DOC: Leer estructura y proof

    V->>LOCAL: Validar schema
    LOCAL-->>V: Estructura valida

    V->>LOCAL: Canonicalizar y calcular hash
    LOCAL-->>V: certificateHash reproducido

    V->>LOCAL: Recuperar signer desde signatureValue
    LOCAL-->>V: signerAddress

    V->>DOC: Leer verificationMethod
    V->>RPC: Conectar a chainId indicado
    RPC->>SC: Consultar certificateId / status / issuer
    SC-->>RPC: Estado on-chain
    RPC-->>V: Resultado verificable

    V->>V: Comparar proof, signer y estado
```

## 4) Mapa de validaciones criticas

```mermaid
flowchart TD
    A[Documento recibido] --> B{Schema Open Badges v2 valido}
    B -->|No| X1[Rechazar documento]
    B -->|Si| C{Hash reproducido}
    C -->|No| X2[Documento alterado]
    C -->|Si| D{Firma recupera signer esperado}
    D -->|No| X3[Prueba criptografica invalida]
    D -->|Si| E{Issuer autorizado on-chain}
    E -->|No| X4[Emisor no autorizado]
    E -->|Si| F{Estado del certificado}
    F -->|Valid| G[Certificado valido]
    F -->|Revoked| H[Certificado revocado]
    F -->|Expired| I[Certificado expirado]
```

## Notas

- La estructura del documento describe el certificado emitido y publicado.
- La fuente de verdad del estado final sigue siendo la blockchain para vigencia, revocacion y autorizacion del emisor.
- IPFS y MongoDB cumplen funciones distintas: distribucion del documento y persistencia operativa, respectivamente.