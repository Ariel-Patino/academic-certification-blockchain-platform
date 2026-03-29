const AcademicCertification = artifacts.require("AcademicCertification");
const { expectRevert } = require("@openzeppelin/test-helpers");

contract("AcademicCertification", (accounts) => {
  const [admin, issuer, recipient, outsider, secondIssuer, recipientB] = accounts;

  const CERT_TYPE_DIPLOMA = 0;

  const buildHash = (value) => web3.utils.soliditySha3(value);

  const increaseTime = async (seconds) => {
    await new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [seconds],
          id: Date.now()
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          web3.currentProvider.send(
            {
              jsonrpc: "2.0",
              method: "evm_mine",
              params: [],
              id: Date.now() + 1
            },
            (mineError) => {
              if (mineError) {
                reject(mineError);
                return;
              }

              resolve();
            }
          );
        }
      );
    });
  };

  let instance;

  beforeEach(async () => {
    instance = await AcademicCertification.new({ from: admin });
  });

  it("registers an issuer", async () => {
    await instance.registerIssuer("Uni A", "ES", "https://unia.example", { from: issuer });

    const issuerData = await instance.getIssuer(issuer);
    assert.equal(issuerData.issuerAddress, issuer, "issuer address should match sender");
    assert.equal(issuerData.name, "Uni A", "issuer name should be stored");
    assert.equal(issuerData.country, "ES", "issuer country should be stored");
    assert.equal(issuerData.isVerified, false, "issuer should start unverified");
  });

  it("allows admin to verify a registered issuer", async () => {
    await instance.registerIssuer("Uni B", "MX", "https://unib.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const authorized = await instance.isAuthorizedIssuer(issuer);
    assert.equal(authorized, true, "issuer should be authorized after admin verification");
  });

  it("issues a certificate by a verified issuer", async () => {
    await instance.registerIssuer("Uni C", "AR", "https://unic.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-issue-1");
    const tx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Master en Blockchain",
      0,
      "ipfs://metadata-issue-1",
      { from: issuer }
    );

    const event = tx.logs.find((log) => log.event === "CertificateIssued");
    assert(event, "CertificateIssued event should be emitted");

    const certId = Number(event.args.certificateId.toString());
    const cert = await instance.getCertificate(certId);
    assert.equal(cert.issuer, issuer, "issuer should match transaction sender");
    assert.equal(cert.recipient, recipient, "recipient should match payload");
    assert.equal(cert.programName, "Master en Blockchain", "program name should be stored");
  });

  it("verifies a valid certificate by hash and by id", async () => {
    await instance.registerIssuer("Uni D", "CL", "https://unid.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-verify-1");
    const tx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Master en Ciberseguridad",
      0,
      "ipfs://metadata-verify-1",
      { from: issuer }
    );

    const certId = Number(tx.logs.find((log) => log.event === "CertificateIssued").args.certificateId.toString());

    const byHash = await instance.verifyCertificate(certHash);
    assert.equal(byHash.exists, true, "certificate should exist by hash");
    assert.equal(byHash.isValid, true, "certificate should be valid by hash");
    assert.equal(byHash.issuer, issuer, "issuer should match");
    assert.equal(byHash.recipient, recipient, "recipient should match");

    const byId = await instance.verifyCertificateById.call(certId, { from: outsider });
    assert.equal(byId, true, "certificate should be valid by id");

    const verifyTx = await instance.verifyCertificateById(certId, { from: outsider });
    const verifyEvent = verifyTx.logs.find((log) => log.event === "CertificateVerified");
    assert(verifyEvent, "CertificateVerified event should be emitted");
  });

  it("revokes a certificate and stores revocation data", async () => {
    await instance.registerIssuer("Uni E", "CO", "https://unie.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-revoke-1");
    const issueTx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Master en IA",
      0,
      "ipfs://metadata-revoke-1",
      { from: issuer }
    );
    const certId = Number(issueTx.logs.find((log) => log.event === "CertificateIssued").args.certificateId.toString());

    await instance.revokeCertificate(certId, "Invalidated by issuer", { from: issuer });

    const byHash = await instance.verifyCertificate(certHash);
    assert.equal(byHash.isValid, false, "revoked certificate should not be valid");

    const revocation = await instance.getRevocation(certId);
    assert.equal(revocation.certificateId.toString(), certId.toString(), "revocation should reference the certificate id");
    assert.equal(revocation.reason, "Invalidated by issuer", "revocation reason should be stored");
    assert.equal(revocation.revokedBy, issuer, "revokedBy should match caller");
  });

  it("rejects unauthorized certificate issuance", async () => {
    const certHash = buildHash("cert-unauthorized-1");

    await expectRevert(
      instance.issueCertificate(
        certHash,
        recipient,
        CERT_TYPE_DIPLOMA,
        "Master no autorizado",
        0,
        "ipfs://metadata-unauthorized-1",
        { from: outsider }
      ),
      "Issuer not authorized"
    );
  });

  it("prevents duplicate certificate hash issuance", async () => {
    await instance.registerIssuer("Uni Dup", "ES", "https://unidup.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const duplicateHash = buildHash("cert-duplicate-1");

    await instance.issueCertificate(
      duplicateHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Programa Original",
      0,
      "ipfs://metadata-dup-1",
      { from: issuer }
    );

    await expectRevert(
      instance.issueCertificate(
        duplicateHash,
        recipientB,
        CERT_TYPE_DIPLOMA,
        "Programa Duplicado",
        0,
        "ipfs://metadata-dup-2",
        { from: issuer }
      ),
      "Hash already used"
    );
  });

  it("marks certificate as expired after expiry date", async () => {
    await instance.registerIssuer("Uni Exp", "PE", "https://uniexp.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const latestBlock = await web3.eth.getBlock("latest");
    const shortExpiry = Number(latestBlock.timestamp) + 5;
    const certHash = buildHash("cert-expiry-1");

    const tx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Programa con caducidad",
      shortExpiry,
      "ipfs://metadata-expiry-1",
      { from: issuer }
    );

    const certId = Number(tx.logs.find((log) => log.event === "CertificateIssued").args.certificateId.toString());

    await increaseTime(10);

    const expired = await instance.isCertificateExpired(certId);
    assert.equal(expired, true, "certificate should be marked as expired");

    const verification = await instance.verifyCertificate(certHash);
    assert.equal(verification.exists, true, "certificate should still exist");
    assert.equal(verification.isValid, false, "expired certificate should not be valid");
    assert.equal(Number(verification.status.toString()), 2, "status should be Expired enum value");
  });

  it("restricts admin-only functions verifyIssuer and updateIssuerStatus", async () => {
    await instance.registerIssuer("Uni RBAC", "UY", "https://unirbac.example", { from: issuer });

    await expectRevert(
      instance.verifyIssuer(issuer, { from: outsider }),
      "Admin only"
    );

    await expectRevert(
      instance.updateIssuerStatus(issuer, 1, { from: outsider }),
      "Admin only"
    );
  });

  it("rejects issuance from unverified and suspended issuers", async () => {
    await instance.registerIssuer("Uni Pending", "ES", "https://unipending.example", { from: secondIssuer });

    const pendingHash = buildHash("cert-unverified-issuer");
    await expectRevert(
      instance.issueCertificate(
        pendingHash,
        recipient,
        CERT_TYPE_DIPLOMA,
        "Programa pendiente",
        0,
        "ipfs://metadata-pending",
        { from: secondIssuer }
      ),
      "Issuer not authorized"
    );

    await instance.verifyIssuer(secondIssuer, { from: admin });
    await instance.updateIssuerStatus(secondIssuer, 1, { from: admin });

    const suspendedHash = buildHash("cert-suspended-issuer");
    await expectRevert(
      instance.issueCertificate(
        suspendedHash,
        recipient,
        CERT_TYPE_DIPLOMA,
        "Programa suspendido",
        0,
        "ipfs://metadata-suspended",
        { from: secondIssuer }
      ),
      "Issuer not authorized"
    );
  });

  it("allows only the original issuer to revoke and returns the revocation reason", async () => {
    await instance.registerIssuer("Uni Rev", "AR", "https://unirev.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-revoke-access-1");
    const issueTx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Programa revocable",
      0,
      "ipfs://metadata-revoke-access-1",
      { from: issuer }
    );
    const certId = Number(issueTx.logs.find((log) => log.event === "CertificateIssued").args.certificateId.toString());

    await expectRevert(
      instance.revokeCertificate(certId, "Admin cannot revoke", { from: admin }),
      "Only issuing issuer can revoke"
    );

    await expectRevert(
      instance.revokeCertificate(certId, "Outsider cannot revoke", { from: outsider }),
      "Only issuing issuer can revoke"
    );

    await instance.revokeCertificate(certId, "Academic misconduct", { from: issuer });

    const revocation = await instance.getRevocation(certId);
    assert.equal(revocation.reason, "Academic misconduct", "revocation reason should match");
    assert.equal(revocation.revokedBy, issuer, "only original issuer should be the revoker in this scenario");
  });

  it("issues certificates in batch to different recipients", async () => {
    await instance.registerIssuer("Uni Batch", "CL", "https://unibatch.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const hashA = buildHash("batch-cert-a");
    const hashB = buildHash("batch-cert-b");
    const metadataURIs = ["ipfs://batch-a", "ipfs://batch-b"];
    const recipients = [recipient, recipientB];

    const ids = await instance.batchIssueCertificates.call(
      [hashA, hashB],
      recipients,
      CERT_TYPE_DIPLOMA,
      "Programa batch",
      metadataURIs,
      { from: issuer }
    );

    await instance.batchIssueCertificates(
      [hashA, hashB],
      recipients,
      CERT_TYPE_DIPLOMA,
      "Programa batch",
      metadataURIs,
      { from: issuer }
    );

    const firstId = Number(ids[0].toString());
    const secondId = Number(ids[1].toString());
    const certA = await instance.getCertificate(firstId);
    const certB = await instance.getCertificate(secondId);

    assert.equal(certA.recipient, recipient, "first batch certificate recipient should match");
    assert.equal(certB.recipient, recipientB, "second batch certificate recipient should match");

    const existsA = await instance.certificateExists(hashA);
    const existsB = await instance.certificateExists(hashB);
    assert.equal(existsA, true, "first batch hash should be registered");
    assert.equal(existsB, true, "second batch hash should be registered");
  });

  it("revokes a certificate by hash", async () => {
    await instance.registerIssuer("Uni Hash", "ES", "https://unihash.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-revoke-hash-1");
    const issueTx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Programa por hash",
      0,
      "ipfs://metadata-revoke-hash-1",
      { from: issuer }
    );

    const certId = Number(issueTx.logs.find((log) => log.event === "CertificateIssued").args.certificateId.toString());

    await instance.revokeCertificateByHash(certHash, "Hash revocation", { from: issuer });

    const byHash = await instance.verifyCertificate(certHash);
    assert.equal(byHash.isValid, false, "revoked-by-hash certificate should not be valid");

    const revocation = await instance.getRevocation(certId);
    assert.equal(revocation.reason, "Hash revocation", "revocation reason should be stored");
  });

  it("rejects revocation by hash for non-existing certificate", async () => {
    const unknownHash = buildHash("non-existent-hash-revoke");

    await expectRevert(
      instance.revokeCertificateByHash(unknownHash, "Should fail", { from: issuer }),
      "Certificate not found"
    );
  });

  it("rejects getCertificateByHash for non-existing certificate", async () => {
    const unknownHash = buildHash("non-existent-hash-get");

    await expectRevert(
      instance.getCertificateByHash(unknownHash),
      "Certificate not found"
    );
  });

  it("rejects getRecipient when recipient is not registered", async () => {
    await expectRevert(
      instance.getRecipient(outsider),
      "Recipient not found"
    );
  });

  it("rejects batch issuance for empty arrays", async () => {
    await instance.registerIssuer("Uni Empty Batch", "CL", "https://uniempty.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    await expectRevert(
      instance.batchIssueCertificates([], [], CERT_TYPE_DIPLOMA, "Programa vacio", [], { from: issuer }),
      "Empty batch"
    );
  });

  it("rejects batch issuance on length mismatch between hashes and recipients", async () => {
    await instance.registerIssuer("Uni Mismatch A", "CL", "https://unimismatch-a.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const hashA = buildHash("mismatch-a-hash");

    await expectRevert(
      instance.batchIssueCertificates(
        [hashA],
        [recipient, recipientB],
        CERT_TYPE_DIPLOMA,
        "Programa mismatch",
        ["ipfs://meta-mismatch-a"],
        { from: issuer }
      ),
      "Length mismatch"
    );
  });

  it("rejects batch issuance on length mismatch between hashes and metadata", async () => {
    await instance.registerIssuer("Uni Mismatch B", "CL", "https://unimismatch-b.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const hashA = buildHash("mismatch-b-hash-a");
    const hashB = buildHash("mismatch-b-hash-b");

    await expectRevert(
      instance.batchIssueCertificates(
        [hashA, hashB],
        [recipient, recipientB],
        CERT_TYPE_DIPLOMA,
        "Programa mismatch",
        ["ipfs://meta-mismatch-b"],
        { from: issuer }
      ),
      "Length mismatch"
    );
  });

  it("rejects issuance with zero recipient address", async () => {
    await instance.registerIssuer("Uni Zero Recipient", "PE", "https://unizero.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-zero-recipient");
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    await expectRevert(
      instance.issueCertificate(
        certHash,
        ZERO_ADDRESS,
        CERT_TYPE_DIPLOMA,
        "Programa sin recipient",
        0,
        "ipfs://metadata-zero-recipient",
        { from: issuer }
      ),
      "Recipient required"
    );
  });

  it("rejects issuance with zero certificate hash", async () => {
    await instance.registerIssuer("Uni Zero Hash", "PE", "https://unizerohash.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

    await expectRevert(
      instance.issueCertificate(
        ZERO_HASH,
        recipient,
        CERT_TYPE_DIPLOMA,
        "Programa sin hash",
        0,
        "ipfs://metadata-zero-hash",
        { from: issuer }
      ),
      "Hash required"
    );
  });

  it("rejects issuance with empty program name", async () => {
    await instance.registerIssuer("Uni Empty Program", "PE", "https://uniemptyprogram.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-empty-program");

    await expectRevert(
      instance.issueCertificate(
        certHash,
        recipient,
        CERT_TYPE_DIPLOMA,
        "",
        0,
        "ipfs://metadata-empty-program",
        { from: issuer }
      ),
      "Program required"
    );
  });

  it("rejects issuance with past expiry date", async () => {
    await instance.registerIssuer("Uni Past Expiry", "PE", "https://unipastexpiry.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-past-expiry");
    const latestBlock = await web3.eth.getBlock("latest");
    const pastExpiry = Number(latestBlock.timestamp) - 1;

    await expectRevert(
      instance.issueCertificate(
        certHash,
        recipient,
        CERT_TYPE_DIPLOMA,
        "Programa expirado",
        pastExpiry,
        "ipfs://metadata-past-expiry",
        { from: issuer }
      ),
      "Invalid expiry"
    );
  });

  it("rejects revocation with empty reason", async () => {
    await instance.registerIssuer("Uni Empty Reason", "UY", "https://uniemptyreason.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-empty-reason");
    const issueTx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Programa para revocar",
      0,
      "ipfs://metadata-empty-reason",
      { from: issuer }
    );

    const certId = Number(issueTx.logs.find((log) => log.event === "CertificateIssued").args.certificateId.toString());

    await expectRevert(
      instance.revokeCertificate(certId, "", { from: issuer }),
      "Reason required"
    );
  });

  it("rejects double revocation", async () => {
    await instance.registerIssuer("Uni Double Revoke", "UY", "https://unidoublerevoke.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-double-revoke");
    const issueTx = await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Programa doble revocacion",
      0,
      "ipfs://metadata-double-revoke",
      { from: issuer }
    );

    const certId = Number(issueTx.logs.find((log) => log.event === "CertificateIssued").args.certificateId.toString());

    await instance.revokeCertificate(certId, "First revocation", { from: issuer });

    await expectRevert(
      instance.revokeCertificate(certId, "Second revocation", { from: issuer }),
      "Already revoked"
    );
  });

  it("marks certificate as invalid when issuer is later suspended", async () => {
    await instance.registerIssuer("Uni Dynamic Issuer", "ES", "https://unidynamic.example", { from: issuer });
    await instance.verifyIssuer(issuer, { from: admin });

    const certHash = buildHash("cert-issuer-suspended-after-issue");
    await instance.issueCertificate(
      certHash,
      recipient,
      CERT_TYPE_DIPLOMA,
      "Programa dependiente del issuer",
      0,
      "ipfs://metadata-issuer-suspended",
      { from: issuer }
    );

    let verification = await instance.verifyCertificate(certHash);
    assert.equal(verification.isValid, true, "certificate should start valid");

    await instance.updateIssuerStatus(issuer, 1, { from: admin });

    verification = await instance.verifyCertificate(certHash);
    assert.equal(verification.exists, true, "certificate should still exist");
    assert.equal(verification.isValid, false, "certificate should become invalid when issuer is suspended");
    assert.equal(Number(verification.status.toString()), 0, "status remains Valid enum, but validity is false");
  });
});
