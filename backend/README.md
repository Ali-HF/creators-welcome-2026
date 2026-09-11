# 🚀 Creators Welcome 2026 — Google Apps Script Setup Guide

Follow these steps to connect your "Creators Welcome 2026" Web Application to a live Google Sheets database.

---

## 📋 Step 1: Create a Google Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet.
2. Title the spreadsheet: `Creators Welcome 2026 - Master Database`.

---

## 💻 Step 2: Add Backend Script
1. In your Google Sheet, click **Extensions** → **Apps Script**.
2. Erase any code in `Code.gs` and paste the exact code from [`backend/Code.gs`](file:///d:/vibes/creators%20welcome/backend/Code.gs).
3. Click the 💾 **Save** icon (or `Ctrl + S`).

---

## 🌐 Step 3: Deploy as Web App
1. At the top right of the Apps Script editor, click **Deploy** → **New deployment**.
2. Click the gear icon ⚙️ next to *Select type* and choose **Web app**.
3. Configure the fields exactly as follows:
   - **Description**: `Creators Welcome 2026 API v1`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial for frontend fetch requests)*
4. Click **Deploy**.
5. Grant any required permissions when prompted by Google.
6. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/AKfycbx.../exec`).

---

## 🔗 Step 4: Connect to Web Application
1. Open `index.html` in your browser.
2. Click the status badge in the top right navbar (or click **Settings**).
3. Paste your copied **Google Apps Script Web App URL**.
4. Click **Save & Connect**.

Your app is now fully live and synchronized with your Google Sheet!

---

## 🛡️ Critical Features Implemented in `Code.gs`:
- **Atomic LockScope**: `LockService.getScriptLock()` wraps ONLY the 50ms sheet append execution and is released BEFORE sending emails.
- **Resilient Delivery**: QR email fetching uses `{ muteHttpExceptions: true }` so network glitches never abort pass issuance.
- **Auto-Formatting**: Built-in sheet prettifying colors status rows automatically.
