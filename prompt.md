# TASK: Build "Creators Welcome 2026" Web App & Google Sheet Backend From Scratch

Please build a full-stack, serverless Event Pass Operations & Live Gate Admission Web Application for "Creators Welcome 2026" (not affiliated with CSIT in any way) connected to a Google Sheet database via a Google Apps Script API.

---

## 🎨 DESIGN & UI/UX REQUIREMENTS
- **Branding**: "Creators Welcome 2026" / "Creators Welcome Party". Pass ID format: `#CW26-001`, `#CW26-002`, etc.
- **Style**: Executive luxury corporate aesthetic using Vanilla HTML5, CSS3, and JavaScript.
- **Color Palette**: Deep Royal Purple (`#4c1d95`, `#6d28d9`), Emerald Green (`#059669` / `#10b981`), Dark Slate (`#0f172a`), Clean White (`#ffffff`), and subtle slate borders (`#e2e8f0`).
- **Typography**: Google Fonts Inter and Monospace for Pass IDs & Roll Numbers.
- **Components**: Status badges, responsive grid layouts, metric cards, modal dialogues, and toast notifications.

---

## 🚀 CORE PAGES & FEATURES

### 1. Operations Dashboard (`index.html`)
- **Header**: "CREATORS WELCOME" — Event Operations & Ticketing Management.
- **Metric Cards**: Total Passes Sold, Gate Checked-in, Remaining Unused, Total Revenue (PKR), and Admission Percentage bar.
- **Live Connection Badge**: Indicates whether connected to live Google Sheet or running in Demo / Mock Mode.
- **Actions**: Quick navigate to Pass Generator, Gate Scanner, and Settings modal.
- **Recent Directory Table**: Real-time list of latest issued passes with search/filter box.

### 2. Digital Pass Generator (`generate.html`)
- **Attendee Registration Form**:
  - Full Name (Required)
  - Roll Number / Student ID (Required, auto-uppercase)
  - Pass Amount Paid (PKR, default `2500`)
  - Email Address (Automated delivery)
  - WhatsApp Contact Number (Optional manual dispatch)
- **Live Credential Preview Card**:
  - Displays high-resolution QR code (`https://quickchart.io/qr?text=PASS_ID&size=400&ecLevel=H&margin=2`)
  - Presenter: "CREATORS WELCOME"
  - Pass ID (`#CW26-001`), Event metadata (Date: 20 SEP 2026, Time: 01:00 PM - 05:00 PM, Venue: Grand Imperial).
  - **Export Actions**: Download Pass Image (HTML5 Canvas render), Print Pass, Copy Pass ID, and Open pre-filled WhatsApp deep link (`wa.me`).

### 3. High-Concurrency Gate Scanner (`scan.html`)
- **Camera QR Scanner**: Integrated `html5-qrcode` library with camera flip toggle.
- **Scan Validation States**:
  - 🟢 **Valid / Entry Approved**: Green banner displaying attendee name and roll number. Plays success audio tone.
  - 🔴 **Already Scanned / Duplicate Entry**: Red alert displaying previous scan timestamp. Plays warning audio tone.
  - ⚠️ **Invalid Pass ID**: Yellow alert for unrecognized QR codes.
- **Manual Override**: Input box to type Pass ID manually if QR code is damaged.

### 4. Backend Google Apps Script (`backend/Code.gs`)
- **Actions Handled**:
  - `generatePass`: Creates unique Pass ID (`#CW26-XXX`), appends row to Sheet, formats row, sends HTML email with inline QR attachment.
  - `checkAndScanPass`: Atomic validation using `LockService` to prevent double entry even if scanned simultaneously at multiple gates.
  - `getStats` & `getPasses`: Aggregates revenue and filters attendee records.
  - `prettifySheet`: Applies corporate purple headers, frozen top row, and conditional status formatting (`used` green / `unused` yellow).

---

## ⚡ CRITICAL ARCHITECTURE RULES FOR THE AGENT

1. **Strict Lock Scope in `Code.gs`**:
   - `LockService.getScriptLock()` MUST ONLY wrap the `sheet.appendRow()` execution (~50ms).
   - Release the lock (`lock.releaseLock()`) BEFORE calling `sendPassEmail()` or external network fetches. Email sending MUST run outside the lock so email/network latency NEVER blocks sheet writes or returns "Server busy".

2. **Frontend Request Timeout & CORS Safety**:
   - Wrap `fetch()` calls in `assets/js/api.js` with an `AbortController` (20-second timeout max).
   - Detect if running on `window.location.protocol === 'file:'`. If on local files, alert the user to view via a local web server (`http://localhost:8080`) or fall back gracefully to local `MockBackendStore` so `fetch` never hangs.

3. **Clean Variable Declarations**:
   - Ensure all variables (`passId`, `nowIso`, `qrUrl`, `whatsapp`, `email`) are explicitly declared before lock acquisition to prevent runtime `ReferenceError`.

4. **Resilient Email Delivery**:
   - In `sendPassEmail()`, add `{ muteHttpExceptions: true }` to `UrlFetchApp.fetch(qrUrl)`. If QR fetching or email delivery fails, catch the error softly and return `{ success: true, emailSent: false, emailError: err }` so the pass IS created in the sheet and rendered on screen.
