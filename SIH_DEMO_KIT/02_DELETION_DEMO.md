# Part B — Secure Deletion / Drive Eraser Demo  (FRIEND presents)

**Goal:** securely and *provably* destroy data on a USB flash drive so it can never be recovered — the exact need behind safe IT‑asset disposal and recycling.

**Time:** ~2–3 minutes. **Admin needed:** **Yes, for a real wipe** (not for the dry‑run).

> **Standards line to say up front (judges love this):**
> "We follow **NIST SP 800‑88 Rev. 2** and **IEEE 2883‑2022**. On flash media, multi‑pass overwrite is obsolete — so we do a single **CSPRNG overwrite** (an AES‑256‑CTR keystream over every sector). We label it correctly as a **Clear**, and we're honest that firmware **Sanitize** is the path to **Purge**‑level assurance. We don't overclaim."

**Choose your mode before the stage:**
- 🟢 **Dry‑run (zero risk, recommended for a first live demo):** writes a real CSPRNG stream to a scratch file and shows live progress. The pendrive is **not touched**.
- 🔴 **Real wipe (maximum impact):** actually destroys everything on the pendrive. **Irreversible.** Only do this on the expendable SanDisk, with anything important backed up.

---

## Setup
1. Plug in the **SanDisk Ultra** pendrive. Copy 3–4 dummy files onto it (e.g., `secret.txt`, a photo) so you can *show* they exist.  **Back up anything real — a real wipe is permanent.**
2. Open the app:
   - **Dry‑run:** double‑click `LAUNCH_APP.bat`.
   - **Real wipe:** double‑click **`LAUNCH_APP_ADMIN.bat`** (it self‑elevates — click **Yes** on the UAC prompt), or right‑click the app → **Run as administrator**.
3. (Optional, for a strong "before" shot) open **Disk Management** and show the SanDisk has partitions **D:/E:** with your files.

---

## The script (do + say)

**1. Frame the problem** *(say)*
> "Part A just showed you deleted data comes back. So how do you *safely* retire a laptop, phone, or USB drive without leaking data? You destroy the data properly. That's this module."

**2. Open the eraser** *(do)*
- On the welcome screen, under **Your deletion cases**, click **Erase a device**.
- The tool lists your physical disks. **Point out the safety:** the **Samsung NVMe system disk** is shown as **"System disk — protected"** and **cannot be selected**. Only the **SanDisk Ultra (Removable)** is selectable.

> *(say)* "The tool refuses to erase the drive the OS is running on — a mis‑click can't brick your machine. Only removable media is eligible."

**3. Select the pendrive + read the honest method** *(do)*
- Click **SanDisk Ultra**. The panel shows: **CSPRNG overwrite — NIST SP 800‑88 Clear**, the AES‑256‑CTR explanation, and the **honest wear‑leveling limitation**.

> *(say)* "One sequential pass of cryptographically‑random bytes over every sector. No key is stored or reused — the transient key lives only in memory and is zeroed after. Same end state as encrypt‑then‑destroy‑the‑key, with **zero key‑management risk**."

**4a. DRY‑RUN mode** *(do)*
- Leave **Dry run (safe)** checked → click **Run dry run**.
- Watch the animated progress + status: *"Dry run: writing CSPRNG sample…"* → *"Dry run complete — no data on the device was changed."*
- Show the **audit‑log path** in the result panel.

> *(say)* "That was the exact engine, on a scratch file, so nothing was destroyed — perfect for a safe demo. Every run writes a tamper‑evident audit record for compliance."

**4b. REAL WIPE mode** *(do — only if you chose it)*
- **Uncheck** **Dry run (safe)**. A red danger box appears.
- Type the device path **exactly** as shown to confirm: **`\\.\PhysicalDrive1`**  *(this is the SanDisk — double‑check the model + size 28.6 GB in the panel).*
- Click **Erase SanDisk Ultra**. Watch every sector get overwritten with CSPRNG data; the bar fills to 100%.
- On completion: **assurance: clear**, plus the **audit‑log path**.

> *(say)* "The drive is now cryptographic noise. If [friend] pointed the **recovery** tool at it, it would find nothing — the data is genuinely unrecoverable."

**5. Prove it (optional, strong)** *(do)*
- Open **Disk Management** again → the SanDisk now shows as **unallocated / RAW** — the partition table and all files are gone.

**6. Close** *(say)*
> "Recovery for investigation, secure destruction for safe disposal — both aligned to international standards, both fully offline. That's the complete data‑lifecycle story."

---

## Safety rules (do not skip)
- **Only ever select the SanDisk (PhysicalDrive1).** The system disk is protected by the tool, but *you* still confirm the model + size before typing the path.
- A real wipe is **irreversible**. If unsure on stage, use the **dry‑run** — it's still visually convincing and 100% safe.
- The real wipe needs the app running **as Administrator**; otherwise the tool blocks it with a clear message (by design).
