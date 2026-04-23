# User Manual

## 1. Introduction

This manual explains how end users interact with the academic certification platform.

## 2. User Roles

- Administrator: registers authorized issuers.
- Authorized Issuer: issues and revokes certificates.
- Public Verifier: validates certificates using code or document.

## 3. Accessing the Application

Local environment default URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001/api`

## 4. Wallet Connection and Login

1. Open the frontend application.
2. Connect your wallet (MetaMask).
3. Sign the SIWE message when requested.
4. Continue with authenticated dashboard actions.

## 5. Issuing an Individual Certificate

1. Go to the issuance page.
2. Fill student and certificate fields.
3. Submit and confirm wallet transaction.
4. Wait for on-chain confirmation.
5. Save verification code/reference.

## 6. Batch Issuance (CSV)

1. Open the batch page.
2. Upload CSV template/content.
3. Validate rows and start processing.
4. Review per-row success/error results.

## 7. Verifying a Certificate

### By verification code

1. Go to verification page.
2. Enter certificate code.
3. Submit query.
4. Review status, issuer, and traceability.

### By document/file

1. Upload the corresponding file.
2. Start verification.
3. Review returned authenticity and status result.

## 8. Revoking a Certificate

1. Open revocation page.
2. Search/select certificate.
3. Provide revocation reason.
4. Confirm transaction in wallet.
5. Verify updated revoked status.

## 9. Certificate History

- Navigate to certificates history page.
- Use pagination options (10, 25, 50, 100).
- Filter/search according to available UI controls.

## 10. Common Recommendations

- Always verify wallet network is Polygon Amoy.
- Keep private keys secure and never share them.
- Confirm transaction hash before closing operation flow.
- Use troubleshooting guide for local environment issues.
