# Part B — Secure Deletion / Drive Eraser Demo  (FRIEND presents, manually)

**Goal:** securely and *provably* destroy data on a USB flash drive, then issue a **tamper‑proof sanitization certificate** — exactly what safe IT‑asset disposal/recycling needs.

**Time:** ~2.5 min. **Admin needed:** **Yes for a real wipe** (not for the dry‑run).

> **Standards line up front (judges love it):**
> "We follow **NIST SP 800‑88 Rev. 2** and **IEEE 2883‑2022**. On flash, multi‑pass overwrite is obsolete — we do a single **CSPRNG overwrite** (an AES‑256‑CTR keystream over every sector). We label it correctly as a **Clear**, and we're honest that firmware **Sanitize** is the path to **Purge**. We don't overclaim."

**Pick your mode:**
- 🟢 **Dry‑run (zero risk, recommended for a first live demo):** a real CSPRNG stream to a scratch file, live progress; the pendrive is **not touched**.
- 🔴 **Real wipe (max impact):** actually destroys the pendrive. **Irreversible** — only on the expendable SanDisk, with anything important backed up.

---

## Setup
1. Plug in the **SanDisk Ultra**; copy 3–4 dummy files onto it so you can *show* them. **Back up anything real.**
2. Open the app:
   - **Dry‑run:** double‑click `recovery-platform.exe`.
   - **Real wipe:** **right‑click `recovery-platform.exe` → Run as administrator** (click **Yes** on UAC).
3. *(Strong "before" shot)* open **Disk Management** and show the SanDisk with partitions **D:/E:** and your files.

---

## The script (do + say)

**1. Frame it** *(say)*
> "Part A showed deleted data comes back. So how do you *safely* retire a laptop, phone, or USB without leaking data? You destroy the data properly — and prove you did."

**2. Open the eraser** *(do)*
- Welcome screen → **Your deletion cases** → **Erase a device**.
- Point out: the **Samsung NVMe system disk** is **"System disk — protected"** and cannot be selected; only **SanDisk Ultra (Removable)** is selectable.

> *(say)* "It refuses to erase the OS drive — a mis‑click can't brick the machine."

**3. Select the pendrive + read the honest method** *(do)*
- Click **SanDisk Ultra**. Read the **CSPRNG overwrite — NIST 800‑88 Clear** method and the **wear‑leveling limitation**.

> *(say)* "One pass of cryptographically‑random bytes over every sector. No key is stored or reused — zero key‑management risk."

**4a. DRY‑RUN** *(do)*
- Leave **Dry run (safe)** checked → **Run dry run** → watch the progress → *"Dry run complete — no data on the device was changed."* Show the **audit‑log path**.

**4b. REAL WIPE** *(do — only if chosen)*
- **Uncheck** **Dry run**. In the red box, type the device path **exactly**: **`\\.\PhysicalDrive1`** (confirm the model + 28.6 GB first).
- Click **Erase SanDisk Ultra** → watch every sector overwritten → **assurance: clear** + audit‑log path.

> *(say)* "The drive is now cryptographic noise. If [friend] pointed the recovery tool at it, it would find nothing."

**5. THE FINALE — tamper‑proof certificate** *(do)*
- Click **Generate signed certificate** → a **sanitization certificate** appears with device, method, standard, an **Ed25519 signature**, and a **key fingerprint**.
- Click **Verify certificate** → **Authentic ✓**.
- *(Optional, strong)* Open the **online verifier** (link in `00`/`06`), paste it → **Authentic** independently; the **Tamper** button flips it to **Tampered ✗** live.
- Click **Save certificate (.html)** → mention it prints to PDF for the disposal record.

> *(say)* "This is the compliance artefact recyclers need — a certificate that proves the wipe **and cannot be forged or altered**. Edit one field and verification fails. That closes the loop."

**6. (Optional) Prove destruction** *(do)*
- Reopen **Disk Management** → the SanDisk now shows **unallocated / RAW** — partitions and files gone.

**7. Close** *(say)*
> "Recovery for investigation, provable secure destruction for safe disposal — both aligned to international standards, both fully offline."

---

## Safety rules (don't skip)
- **Only ever select the SanDisk (PhysicalDrive1).** Confirm the model + size before typing the path.
- A real wipe is **irreversible**. Unsure on stage? Use the **dry‑run** — it's still convincing and 100% safe.
- The real wipe needs the app **running as Administrator**; without it the wipe fails with a clear error naming the Windows reason (e.g. access denied) rather than silently doing nothing.
