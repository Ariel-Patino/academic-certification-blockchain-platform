# Esquema de Certificado

Fecha de actualización: 29 de marzo de 2026

## Campos principales

- id: identificador interno del certificado.
- certificateHash: código de verificación del certificado.
- studentName: nombre del titular.
- studentId: identificador académico del titular.
- recipientEmail: correo de referencia del titular.
- programName: programa académico.
- institutionName: institución emisora.
- issuedDate: fecha de emisión.
- expiryDate: fecha de expiración (si aplica).
- status: estado actual (vigente, revocado, expirado).

## Metadatos de blockchain

- certificateId: identificador on-chain.
- txHash: transacción de emisión o revocación.
- contractAddress: contrato objetivo.
- chainId: red objetivo.

## Reglas mínimas

- Campos de titular e institución son obligatorios.
- certificateHash debe ser único por certificado.
- status debe mantener consistencia con el estado de cadena.
