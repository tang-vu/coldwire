# Coldwire — Submission Checklist (human-only tasks)

Everything in this list requires **you** (a human) — physical hardware, accounts,
recordings, external submissions, KYC. Coldwire itself is built, tested, and
verified on-device (see "Already done" below).

---

## Already done (by the build, verified by running it)

- ✅ Core agent: on-device RAG (GTE-large) + LLM (Llama 3.2 1B) → structured signal report. Ran end-to-end.
- ✅ Bias-grounding so stances never contradict the trader's notes (DOGE→avoid, SOL→reduce, etc.).
- ✅ Interfaces: CLI (`npm run coldwire`, `--json`) + zero-dep web UI (`npm run serve`). Both verified.
- ✅ On-device proof: profiler export + per-call `device`/tok-s, written to `proof/*.json`.
- ✅ P2P (Phase 2): delegated inference behind `--delegate`, `fallbackToLocal` → can't break core. Verified (provider announced on DHT; fallback produced full report).
- ✅ No-cloud guard (`npm run check:no-cloud`), 13 unit tests (`npm test`), GitHub Actions CI.
- ✅ Apache-2.0 LICENSE, `.gitignore` (no secrets), synthetic sample data, README.
- ✅ 6 local commits on `main`. **NOT pushed to GitHub yet** (no remote configured) → see task 6.

### Tested-on snapshot (for the evidence bundle)

```
Host:   DESKTOP-1A6OPC9
OS:     Microsoft Windows 10 (10.0.19045)
Node:   v24.14.1   npm 11.11.0
Backend device reported by SDK: gpu  (~40–49 tok/s on Llama 3.2 1B)

Model files (cached in %USERPROFILE%\.qvac\models), sha256:
  Llama-3.2-1B-Instruct-Q4_0.gguf  737.2 MB  66BFBB2D48BDB77CD56BD03EF820DEFF3C4A74B1A09DE3B917AE13E72C1A70C2
  gte-large_fp16.gguf              638.6 MB  939F1FB3FCC70F2A250A7E7AD7C2FBDC1397D46F9A8055D053E451829C5293FB
```
(Re-compute on your hardware: `Get-FileHash <file> -Algorithm SHA256` / `sha256sum <file>`.)

---

## Your tasks

### 1. Run on real BYOH hardware (phone and/or laptop)
A dev assertion isn't enough — judges want it on the actual device.
```bash
npm install
npm run smoke        # confirms model load + streaming on THIS device
npm run coldwire     # full signal report on sample data
```
Confirm: model loads, signals generate, proof block shows your host + `device=`.
If on a phone/SBC, capture the same.

### 2. Capture on-device PROOF (the killer demo)
Strongest evidence = it works with the network OFF.
1. Run once online so models cache into `~/.qvac/models`.
2. **Turn on airplane mode / disable Wi-Fi + ethernet.**
3. Run `npm run coldwire` again — it still generates signals (no network).
4. Grab the profiler/proof: the run writes `proof/coldwire-proof-<ts>.json`; the
   terminal prints per-call `device=gpu/cpu` + tok-s.
5. **Screen-record** steps 2–4 (network indicator visible).

### 3. (If shipping P2P) Record a 2-device demo, no server
Single-machine holepunch fails (NAT hairpin) — you need **two devices/networks**.
```bash
# Device B:  npm run provider           # prints a public key
# Device A:  npm run coldwire -- --delegate <that-public-key>
```
Record the consumer offloading the LLM to the peer with no server in between.
(If it's flaky on your networks, it's optional — core alone is a valid submission.
Cut it and say so rather than show a broken demo.)

### 4. Verify the README reproduces from ZERO
On a clean clone / fresh directory (ideally a different machine):
```bash
git clone <your-repo-url> && cd coldwire
npm install
npm run smoke && npm run coldwire
```
Fix any gap you hit (missing step, version mismatch). Note: running the `.ts`
entrypoints uses Node's built-in type-stripping — use **Node ≥ 22.18 or ≥ 24**
(tested on v24.14.1). If a judge is on exactly 22.17, tell them to use 24.

### 5. Record the demo video (REQUIRED by DoraHacks)
Tell the "why edge" story, tight:
- Private positions/strategy never leave the device.
- Works offline (show airplane mode from task 2).
- $0 inference, no API keys, no lock-in.
- Show: `npm run serve` web UI generating a report + the on-device proof panel.
**Check the exact required length/format** on the DoraHacks "Submission Requirements"
/ "Prizes & Judging" tab before recording. Upload (YouTube unlisted or similar).

### 6. Make the GitHub repo PUBLIC with Apache-2.0
Repo is local only right now. Create + push:
```bash
# with GitHub CLI:
gh repo create coldwire --public --source=. --remote=origin --push
# or manually: create an empty public repo, then:
#   git remote add origin <url> && git push -u origin main
```
Then: set the License to **Apache-2.0** in the repo's About sidebar (GitHub
auto-detects the LICENSE file — confirm the badge shows). Scrub secrets:
`git log --stat` and confirm no `.env`/keys ever committed (sample data is
synthetic, safe). `.gitignore` already excludes secrets + model cache.

### 7. Assemble the EVIDENCE BUNDLE (3-stage verification)
Read the EXACT requirements on the DoraHacks **"Prizes & Judging"** tab, then include:
- Repo URL (public) + commit hash.
- Repro steps (from README) + the clean-clone result from task 4.
- Hardware specs + `node -v`/`npm -v` (see Tested-on snapshot; redo on your hw).
- **Model hashes** (task above) — proves which models ran.
- On-device proof: the `proof/coldwire-proof-*.json` files + the airplane-mode recording.
- Demo video link.

### 8. Submit on DoraHacks BEFORE the deadline — EARLY
DoraHacks shows **Deadline 2026/06/22 06:59** (appears to be UTC) ≈ **13:59
Vietnam time (UTC+7)**. **Verify the exact cutoff + timezone** on the Official
Rules / Prizes & Judging tab. Given the multi-stage verification, **submit a day
early**, not at the wire.

### 9. Join the Tether Discord (participation requirement)
Join via the hackathon page's Discord link. Some hackathons also want a **Keet
username** (see https://support.keet.io/installation-and-setup/setup) — check the
hackathon page and add yours if required.

### 10. Build-in-Public (separate prize)
- Follow **@QVAC** on X.
- Post a thread from **@tangvu_dev** tagging **@QVAC** at kickoff and at the demo.
- Check the **"Build in Public!"** tab for any required hashtag / submission form
  and include it.

### 11. Start KYC for the USDT payout NOW
Payouts gate on KYC — don't wait until you win. Begin the KYC process via the
DoraHacks/Tether instructions as soon as possible.

---

## Open questions to resolve (need your input / external info)
- Exact submission cutoff timezone (task 8) — confirm on DoraHacks.
- Required demo-video length/format (task 5) — confirm on DoraHacks.
- Whether a Keet username is mandatory (task 9).
- Build-in-Public required hashtag/form (task 10).
