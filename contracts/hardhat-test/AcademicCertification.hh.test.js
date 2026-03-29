const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AcademicCertification (Hardhat)", function () {
  const CERT_TYPE_DIPLOMA = 0;
  let contract;
  let admin;
  let issuer;
  let recipient;
  let outsider;
  let recipientB;

  const hash = (v) => ethers.keccak256(ethers.toUtf8Bytes(v));

  beforeEach(async function () {
    [admin, issuer, recipient, outsider, recipientB] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AcademicCertification");
    contract = await Factory.connect(admin).deploy();
    await contract.waitForDeployment();
  });

  async function registerAndVerifyDefaultIssuer() {
    await contract.connect(issuer).registerIssuer("Uni A", "ES", "https://unia.example");
    await contract.connect(admin).verifyIssuer(issuer.address);
  }

  it("registers issuer and keeps it unverified by default", async function () {
    const ownerAddress = await contract.owner();
    expect(ownerAddress).to.equal(admin.address);

    await contract.connect(issuer).registerIssuer("Uni A", "ES", "https://unia.example");
    const data = await contract.getIssuer(issuer.address);

    expect(data.issuerAddress).to.equal(issuer.address);
    expect(data.name).to.equal("Uni A");
    expect(data.isVerified).to.equal(false);
  });

  it("restricts admin-only actions", async function () {
    await contract.connect(issuer).registerIssuer("Uni RBAC", "UY", "https://unirbac.example");

    await expect(contract.connect(outsider).verifyIssuer(issuer.address)).to.be.revertedWith("Admin only");
    await expect(contract.connect(outsider).updateIssuerStatus(issuer.address, 1)).to.be.revertedWith("Admin only");
  });

  it("validates issuer registration and admin checks", async function () {
    await expect(contract.connect(issuer).registerIssuer("", "ES", "https://bad.example")).to.be.revertedWith(
      "Name required"
    );

    await contract.connect(issuer).registerIssuer("Uni Once", "ES", "https://unionce.example");

    await expect(
      contract.connect(issuer).registerIssuer("Uni Twice", "ES", "https://unitwice.example")
    ).to.be.revertedWith("Already registered");

    await expect(contract.connect(admin).verifyIssuer(outsider.address)).to.be.revertedWith("Issuer not found");

    await expect(contract.connect(admin).updateIssuerStatus(outsider.address, 1)).to.be.revertedWith("Issuer not found");

    await contract.connect(admin).updateIssuerStatus(issuer.address, 1);
    await expect(contract.connect(admin).verifyIssuer(issuer.address)).to.be.revertedWith("Issuer not active");
  });

  it("issues and verifies a valid certificate", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-valid-1");
    await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Master", 0, "ipfs://meta-1");

    const verification = await contract.verifyCertificate(certHash);
    expect(verification.exists).to.equal(true);
    expect(verification.isValid).to.equal(true);
    expect(verification.issuer).to.equal(issuer.address);
    expect(verification.recipient).to.equal(recipient.address);
  });

  it("rejects issuance from unauthorized issuer", async function () {
    const certHash = hash("cert-unauthorized-1");

    await expect(
      contract
        .connect(outsider)
        .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "No autorizado", 0, "ipfs://meta")
    ).to.be.revertedWith("Issuer not authorized");
  });

  it("rejects invalid issue inputs", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-invalid-inputs-1");
    const zeroAddress = ethers.ZeroAddress;
    const zeroHash = ethers.ZeroHash;

    await expect(
      contract
        .connect(issuer)
        .issueCertificate(certHash, zeroAddress, CERT_TYPE_DIPLOMA, "Programa", 0, "ipfs://meta")
    ).to.be.revertedWith("Recipient required");

    await expect(
      contract
        .connect(issuer)
        .issueCertificate(zeroHash, recipient.address, CERT_TYPE_DIPLOMA, "Programa", 0, "ipfs://meta")
    ).to.be.revertedWith("Hash required");

    await expect(
      contract
        .connect(issuer)
        .issueCertificate(hash("cert-empty-program"), recipient.address, CERT_TYPE_DIPLOMA, "", 0, "ipfs://meta")
    ).to.be.revertedWith("Program required");

    const latest = await ethers.provider.getBlock("latest");
    const pastExpiry = Number(latest.timestamp) - 1;

    await expect(
      contract
        .connect(issuer)
        .issueCertificate(hash("cert-past-expiry"), recipient.address, CERT_TYPE_DIPLOMA, "Programa", pastExpiry, "ipfs://meta")
    ).to.be.revertedWith("Invalid expiry");
  });

  it("prevents duplicate hash issuance", async function () {
    await registerAndVerifyDefaultIssuer();

    const duplicateHash = hash("cert-duplicate-1");
    await contract
      .connect(issuer)
      .issueCertificate(duplicateHash, recipient.address, CERT_TYPE_DIPLOMA, "Original", 0, "ipfs://meta-1");

    await expect(
      contract
        .connect(issuer)
        .issueCertificate(duplicateHash, recipientB.address, CERT_TYPE_DIPLOMA, "Duplicado", 0, "ipfs://meta-2")
    ).to.be.revertedWith("Hash already used");
  });

  it("revokes by id and stores revocation", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-revoke-id-1");
    const tx = await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Revocable", 0, "ipfs://meta-r");
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "CertificateIssued");
    const certId = event.args.certificateId;

    await contract.connect(issuer).revokeCertificate(certId, "Academic misconduct");

    const verification = await contract.verifyCertificate(certHash);
    expect(verification.isValid).to.equal(false);

    const revocation = await contract.getRevocation(certId);
    expect(revocation.reason).to.equal("Academic misconduct");
    expect(revocation.revokedBy).to.equal(issuer.address);
  });

  it("enforces revocation rules", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-revoke-rules-1");
    const tx = await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Revocable", 0, "ipfs://meta-rules");
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "CertificateIssued");
    const certId = event.args.certificateId;

    await expect(contract.connect(admin).revokeCertificate(certId, "Nope")).to.be.revertedWith(
      "Only issuing issuer can revoke"
    );

    await expect(contract.connect(issuer).revokeCertificate(certId, "")).to.be.revertedWith("Reason required");

    await contract.connect(issuer).revokeCertificate(certId, "First revoke");

    await expect(contract.connect(issuer).revokeCertificate(certId, "Second revoke")).to.be.revertedWith(
      "Already revoked"
    );
  });

  it("revokes by hash and rejects unknown hash", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-revoke-hash-1");
    await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Hash revoke", 0, "ipfs://meta-hash");

    await contract.connect(issuer).revokeCertificateByHash(certHash, "Revoked by hash");
    const verification = await contract.verifyCertificate(certHash);
    expect(verification.isValid).to.equal(false);

    await expect(
      contract.connect(issuer).revokeCertificateByHash(hash("missing-cert"), "Should fail")
    ).to.be.revertedWith("Certificate not found");
  });

  it("supports batch issuance and validates batch inputs", async function () {
    await registerAndVerifyDefaultIssuer();

    await expect(
      contract.connect(issuer).batchIssueCertificates([], [], CERT_TYPE_DIPLOMA, "Batch", [])
    ).to.be.revertedWith("Empty batch");

    await expect(
      contract
        .connect(issuer)
        .batchIssueCertificates([hash("a")], [recipient.address, recipientB.address], CERT_TYPE_DIPLOMA, "Batch", ["ipfs://a"])
    ).to.be.revertedWith("Length mismatch");

    await expect(
      contract
        .connect(issuer)
        .batchIssueCertificates([hash("a"), hash("b")], [recipient.address, recipientB.address], CERT_TYPE_DIPLOMA, "Batch", ["ipfs://a"])
    ).to.be.revertedWith("Length mismatch");

    const ids = await contract
      .connect(issuer)
      .batchIssueCertificates.staticCall(
        [hash("batch-a"), hash("batch-b")],
        [recipient.address, recipientB.address],
        CERT_TYPE_DIPLOMA,
        "Batch",
        ["ipfs://batch-a", "ipfs://batch-b"]
      );

    await contract
      .connect(issuer)
      .batchIssueCertificates(
        [hash("batch-a"), hash("batch-b")],
        [recipient.address, recipientB.address],
        CERT_TYPE_DIPLOMA,
        "Batch",
        ["ipfs://batch-a", "ipfs://batch-b"]
      );

    const certA = await contract.getCertificate(ids[0]);
    const certB = await contract.getCertificate(ids[1]);

    expect(certA.recipient).to.equal(recipient.address);
    expect(certB.recipient).to.equal(recipientB.address);
  });

  it("marks certificate expired after expiry date", async function () {
    await registerAndVerifyDefaultIssuer();

    const latest = await ethers.provider.getBlock("latest");
    const expiry = Number(latest.timestamp) + 5;
    const certHash = hash("cert-expiry-1");

    const tx = await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Expirable", expiry, "ipfs://meta-exp");
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "CertificateIssued");
    const certId = event.args.certificateId;

    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);

    const expired = await contract.isCertificateExpired(certId);
    expect(expired).to.equal(true);

    const verification = await contract.verifyCertificate(certHash);
    expect(verification.exists).to.equal(true);
    expect(verification.isValid).to.equal(false);
    expect(verification.status).to.equal(2n);
  });

  it("reflects issuer status in certificate validity", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-issuer-status-1");
    await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Issuer status", 0, "ipfs://meta-status");

    const initial = await contract.verifyCertificate(certHash);
    expect(initial.isValid).to.equal(true);

    await contract.connect(admin).updateIssuerStatus(issuer.address, 1);

    const afterSuspend = await contract.verifyCertificate(certHash);
    expect(afterSuspend.exists).to.equal(true);
    expect(afterSuspend.isValid).to.equal(false);
  });

  it("rejects unknown lookups", async function () {
    await expect(contract.getRecipient(outsider.address)).to.be.revertedWith("Recipient not found");
    await expect(contract.getCertificateByHash(hash("unknown-hash"))).to.be.revertedWith("Certificate not found");

    const verification = await contract.verifyCertificate(hash("unknown-hash-verify"));
    expect(verification.exists).to.equal(false);
    expect(verification.isValid).to.equal(false);
    expect(verification.issuer).to.equal(ethers.ZeroAddress);
    expect(verification.recipient).to.equal(ethers.ZeroAddress);
  });

  it("returns recipient and issuer certificate collections", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-collections-1");
    const tx = await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Collections", 0, "ipfs://meta-c");
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "CertificateIssued");
    const certId = event.args.certificateId;

    const issuerIds = await contract.getIssuerCertificates(issuer.address);
    const recipientIds = await contract.getRecipientCertificates(recipient.address);

    expect(issuerIds.length).to.equal(1);
    expect(recipientIds.length).to.equal(1);
    expect(issuerIds[0]).to.equal(certId);
    expect(recipientIds[0]).to.equal(certId);

    const recipientProfile = await contract.getRecipient(recipient.address);
    expect(recipientProfile.recipientAddress).to.equal(recipient.address);

    const byHash = await contract.getCertificateByHash(certHash);
    expect(byHash.recipient).to.equal(recipient.address);

    const existsKnown = await contract.certificateExists(certHash);
    const existsUnknown = await contract.certificateExists(hash("unknown-exists-check"));
    expect(existsKnown).to.equal(true);
    expect(existsUnknown).to.equal(false);
  });

  it("verifies by id and emits CertificateVerified event", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-verify-by-id-1");
    const txIssue = await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Verify by id", 0, "ipfs://meta-v");
    const issueReceipt = await txIssue.wait();
    const issueEvent = issueReceipt.logs.find((log) => log.fragment && log.fragment.name === "CertificateIssued");
    const certId = issueEvent.args.certificateId;

    await expect(contract.connect(outsider).verifyCertificateById(certId))
      .to.emit(contract, "CertificateVerified")
      .withArgs(certId, outsider.address);
  });

  it("returns not expired for active certificate and rejects revocation lookup before revoke", async function () {
    await registerAndVerifyDefaultIssuer();

    const certHash = hash("cert-not-expired-1");
    const txIssue = await contract
      .connect(issuer)
      .issueCertificate(certHash, recipient.address, CERT_TYPE_DIPLOMA, "Active cert", 0, "ipfs://meta-active");
    const issueReceipt = await txIssue.wait();
    const issueEvent = issueReceipt.logs.find((log) => log.fragment && log.fragment.name === "CertificateIssued");
    const certId = issueEvent.args.certificateId;

    const notExpired = await contract.isCertificateExpired(certId);
    expect(notExpired).to.equal(false);

    await expect(contract.getRevocation(certId)).to.be.revertedWith("Not revoked");
  });
});
