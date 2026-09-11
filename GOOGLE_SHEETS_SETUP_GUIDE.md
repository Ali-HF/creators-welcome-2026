# 📖 Comprehensive Guide: Connecting Google Sheets to Creators Welcome 2026

This guide provides step-by-step instructions on setting up your **Google Sheet**, installing the **Google Apps Script backend (`Code.gs`)**, deploying it as a serverless REST API, and connecting it to your live application hosted on **GitHub Pages**.

---

## 📑 Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Step 1: Create & Name Your Google Sheet](#step-1-create--name-your-google-sheet)
3. [Step 2: Open Google Apps Script Editor](#step-2-open-google-apps-script-editor)
4. [Step 3: Paste the Backend Code](#step-3-paste-the-backend-code)
5. [Step 4: Deploy as a Web Application](#step-4-deploy-as-a-web-application)
6. [Step 5: Authorize Google Account Permissions](#step-5-authorize-google-account-permissions)
7. [Step 6: Connect the Web App URL to the App](#step-6-connect-the-web-app-url-to-the-app)
8. [Step 7: Verification & Testing](#step-7-verification--testing)
9. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## 1. Overview & Architecture

The **Creators Welcome 2026** web application uses a serverless architecture where Google Sheets acts as a free, scalable, real-time database.

```
+------------------------------------+          JSON POST / GET           +------------------------------------+
|  GitHub Pages Web Application      | <--------------------------------> |  Google Apps Script (Code.gs)      |
|  https://ali-hf.github.io/...      |    (20s timeout, CORS resilient)   |  Serverless Endpoint               |
+------------------------------------+                                    +------------------------------------+
                                                                                            |
                                                                                            v
                                                                          +------------------------------------+
                                                                          |  Google Sheets Master Database     |
                                                                          |  Cols: A - I (Passes tab)          |
                                                                          +------------------------------------+
```

### Key Technical Specs:
- **Database Table**: Automatically creates a tab named `Passes`.
- **Columns**: `Pass ID`, `Full Name`, `Roll Number`, `Amount Paid (PKR)`, `Status`, `Created ISO`, `Scanned ISO`, `Email`, `WhatsApp`.
- **Concurrency Protection**: Google `LockService` locks database writes for ~50ms to prevent duplicate pass IDs even when multiple gate operators scan simultaneously.
- **Automated Emailing**: Automatically dispatches HTML ticket emails with inline QR code attachments via `MailApp`.

---

## Step 1: Create & Name Your Google Sheet

1. Open your browser and navigate to **[sheets.google.com](https://sheets.google.com)**.
2. Sign in with the Google Account you wish to host the database on.
3. Click **Blank spreadsheet** (`+` icon).
4. At the top left, replace "Untitled spreadsheet" with:
   ```text
   Creators Welcome 2026 - Master Database
   ```

---

## Step 2: Open Google Apps Script Editor

1. In your newly created Google Sheet, click on the **Extensions** menu at the top.
2. Select **Apps Script** from the dropdown menu.
   *(This opens a new tab with the Google Apps Script IDE)*.

---

## Step 3: Paste the Backend Code

1. In the Apps Script IDE, you will see a default file named `Code.gs` containing:
   ```javascript
   function myFunction() {
     
   }
   ```
2. Select all text in `Code.gs` and **delete it**.
3. Open [`backend/Code.gs`](file:///d:/vibes/creators%20welcome/backend/Code.gs) from this repository (or copy it from [GitHub Code.gs](https://github.com/Ali-HF/creators-welcome-2026/blob/main/backend/Code.gs)).
4. Paste the complete code into the `Code.gs` editor.
5. Click the 💾 **Save** icon at the top toolbar (or press `Ctrl + S`).

---

## Step 4: Deploy as a Web Application

1. At the top right corner of the Apps Script page, click the blue **Deploy** button.
2. Select **New deployment** from the menu.
3. In the deployment popup:
   - Click the **Gear Icon (⚙️)** next to *Select type*.
   - Click **Web app**.
4. Configure the parameters **EXACTLY** as follows:

   | Setting | Value to Select |
   | :--- | :--- |
   | **Description** | `Creators Welcome 2026 API v1` |
   | **Execute as** | `Me (your-email@gmail.com)` |
   | **Who has access** | `Anyone` |

   > ⚠️ **CRITICAL**: *Who has access* MUST be set to **Anyone**. If left as *Only myself*, the web application running on GitHub Pages will fail to connect with CORS/403 errors.

5. Click the blue **Deploy** button.

---

## Step 5: Authorize Google Account Permissions

The first time you deploy, Google requires authorization so the script can write to your sheet and send emails.

1. A popup titled **Authorization required** will appear. Click **Authorize access**.
2. Choose your Google account.
3. Google may show a warning: *"Google hasn't verified this app"*.
   - Click **Advanced** (small text at bottom).
   - Click **Go to Creators Welcome 2026 (unsafe)**.
4. On the permission list screen, click **Allow**.
5. Once deployment completes, copy the **Web App URL**.
   - It will look like:
     `https://script.google.com/macros/s/AKfycbx123456789abcdefghijklmnopqrstuvwxyz/exec`

---

## Step 6: Connect the Web App URL to the App

Now link your deployed backend URL to your live web application.

### Method A: Via Web Application Interface (Recommended)
1. Open your live app: **[https://ali-hf.github.io/creators-welcome-2026/](https://ali-hf.github.io/creators-welcome-2026/)**
2. Look at the top right of the navigation bar. You will see a badge that says:
   ```text
   🟡 DEMO / MOCK MODE
   ```
3. Click on the badge (or click **Refresh / Settings**).
4. In the popup modal titled **⚙️ Backend API Configuration**:
   - Paste your copied **Google Apps Script Web App URL**.
5. Click **Save & Connect**.
6. The status badge will change to:
   ```text
   🟢 LIVE GOOGLE SHEET
   ```

---

## Step 7: Verification & Testing

### 1. Test Issuing a Pass:
- Navigate to **[Issue Pass](https://ali-hf.github.io/creators-welcome-2026/generate.html)**.
- Fill out attendee name (e.g. `Test Attendee`), Roll No (`CS-2026-001`), and Email.
- Click **Generate Official Pass Credential**.
- Open your Google Sheet — a new row with `#CW26-001` will appear instantly formatted with purple headers!

### 2. Test Gate Scanner:
- Navigate to **[Gate Scanner](https://ali-hf.github.io/creators-welcome-2026/scan.html)**.
- Enter `#CW26-001` in the **Manual Pass ID Override** box and click **Verify Entry**.
- You will hear a success dual chime tone, see the 🟢 **Entry Approved** banner, and in your Google Sheet, column `E` (*Status*) will update to `used` and column `G` (*Scanned ISO*) will populate with the exact timestamp!
- Scan `#CW26-001` a second time — the app will play a low warning buzz and display 🔴 **Already Scanned / Duplicate**.

---

## Troubleshooting & FAQ

### Q: The badge still says "DEMO / MOCK MODE"?
**A**: Ensure you pasted the complete URL starting with `https://script.google.com/macros/s/.../exec`. Make sure there are no trailing spaces.

### Q: Requests are timing out or returning Network Error?
**A**: Re-check Step 4. Ensure *Who has access* is set to **Anyone**. If it was set to *Only myself*, click **Deploy** → **Manage deployments** → Edit ✏️ → Change *Who has access* to **Anyone** → New Version → **Deploy**.

### Q: Email is not being delivered to attendees?
**A**: Check your Google account's Sent Mail folder. Google Apps Script uses `MailApp`, which has a daily quota of 100 free emails/day for standard Gmail accounts (2,000/day for Google Workspace accounts). Pass creation will still succeed even if email quota is reached.
