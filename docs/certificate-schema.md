# Certificate Schema

Last updated: March 29, 2026

## Main fields

- id: internal certificate identifier.
- certificateHash: certificate verification code.
- studentName: certificate holder name.
- studentId: holder academic identifier.
- recipientEmail: holder reference email.
- programName: academic program.
- institutionName: issuing institution.
- issuedDate: issuance date.
- expiryDate: expiration date (if applicable).
- status: current status (valid, revoked, expired).

## Blockchain metadata

- certificateId: on-chain identifier.
- txHash: issuance or revocation transaction.
- contractAddress: target contract.
- chainId: target network.

## Minimum rules

- Holder and institution fields are required.
- certificateHash must be unique per certificate.
- status must remain consistent with on-chain state.
