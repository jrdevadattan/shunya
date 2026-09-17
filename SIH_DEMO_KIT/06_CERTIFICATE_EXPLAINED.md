# The Certificate — Purpose, Why It's Required & Judge Counter‑Questions

Use this to explain the certificate confidently and to defend it under questioning.

---

## What it is (in one line)
A **cryptographically signed, tamper‑evident record** of an operation (a secure wipe, or a recovery), that **anyone can verify** — proving *what* was done, *to what*, *when*, and *by whom*, in a way that **cannot be forged or altered**.

## Why it exists — the purpose
- **Proof for disposal / recycling.** Before a laptop, phone, or drive is reused, resold, or recycled, the owner must *prove* the data was destroyed. A screenshot or a log can be faked; a **digital signature cannot**. This is the artefact a recycler, auditor, or data‑protection officer accepts.
- **Chain of custody for recovery.** For evidence recovered in an investigation, the certificate attests the operation and binds it to a case + operator, so it holds up later.
- **Non‑repudiation.** The signer cannot later deny issuing it, and no one can slip in a changed value — the signature covers every field.

## Why it's *really* required (not optional)
- **The e‑waste data‑leak problem.** Organisations and people **hoard** old devices because they fear data leaks on disposal. Provable destruction is what unlocks safe reuse/recycling at scale — the whole point of the secure‑wipe problem statement.
- **Standards expect verification.** **NIST SP 800‑88** treats sanitization as incomplete without **verification and a record**; **IEEE 2883** is built around evidence of sanitization. A wipe with no verifiable certificate is not a compliant wipe — it's just a hope.
- **Audit & legal defensibility.** Data‑protection regimes and asset‑disposal contracts require a defensible trail. A signed certificate *is* that trail.

## How it works (say this simply)
1. The app builds a **canonical record** of the operation and signs it with an **Ed25519** private key.
2. The certificate carries the record, the **signature**, and the **public key** (plus its fingerprint).
3. To verify, you recompute the canonical record and check the signature against the public key. **Change one character of any field and verification fails.**
4. Trust is anchored to the **public‑key fingerprint** — a genuine SHUNYA certificate always shows the same one.

## How to verify — including *remotely*
- **In the app:** click **Verify certificate** → it shows **Authentic ✓** (or fails if altered).
- **Independently / remotely — a web verifier:** paste the certificate at the SHUNYA verifier page and it checks the signature **in the browser, offline, no server**:
  **https://claude.ai/code/artifact/a383a5e4-c9a0-4ec8-885c-f376a6721604**
  *(To let judges open it themselves, use the page's Share menu to make the link public. It also works fully offline — nothing is sent anywhere.)*
- **With any standard tool:** because it's plain **Ed25519**, a third party can verify it with OpenSSL or any crypto library using the published public key — no dependency on us.

> **Demo tip:** open the verifier, show **Authentic**, then click **"Tamper with it & re‑verify"** → it flips to **Tampered ✗** live. That single moment makes the point better than any slide.

---

## Counter‑questions judges may ask (and your answers)

**Q. Can this certificate be forged or edited?**
> No. It's a real **Ed25519 digital signature** over every field. Edit anything and verification fails. Forging one would require our **private key**, which never leaves the signer.

**Q. Is that just a hash / checksum?**
> No — a hash proves *integrity* but not *origin*. A **signature proves both**: that this key issued it **and** nothing changed since. That's what makes it defensible.

**Q. What stops someone re‑signing a fake with their own key?**
> The **public‑key fingerprint** is the trust anchor. A verifier only accepts a certificate whose fingerprint matches SHUNYA's **published** key. A different key = a different fingerprint = rejected.

**Q. Where is the private key kept — isn't that a weakness?**
> On this prototype it's a protected per‑install key. In production it lives in an **HSM or secure key store** (or a TPM), so the signing key can't be extracted. The mechanism is identical; only the key custody hardens.

**Q. Does verification need the internet / your servers?**
> No. Verification is **pure math** — it runs **offline** in a browser or any crypto tool. That's essential for air‑gapped forensic and disposal environments.

**Q. What exactly does the certificate prove — that the data is 100% gone?**
> It proves **the operation we performed** (a single‑pass CSPRNG overwrite, NIST 800‑88 **Clear**), on **this device**, at **this time**. We're honest that Clear‑level has limits on flash (wear‑leveling); the certificate states the method truthfully rather than overclaiming "unrecoverable forever."

**Q. Can I verify a certificate from months ago?**
> Yes — it's self‑contained and time‑stamped; verification doesn't depend on any live state. As long as our public key is known, it verifies forever.

**Q. Why Ed25519 and not RSA?**
> Ed25519 is modern, fast, has small keys/signatures, and is misuse‑resistant (deterministic, no weak‑randomness pitfalls). It's the current best‑practice signature scheme.
