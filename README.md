# Petty Cash Management System (PWA)

A progressive web application for tracking petty cash, photographing/scanning receipts, generating client-side PDF documents, managing expense claims, and syncing with Google Sheets.

---

## 🚀 How to Host on GitHub Pages

You have two easy ways to host this app on GitHub Pages:

### Option A: Automatic via GitHub Actions (Recommended)
1. Go to your repository on GitHub (`Cryo-Lab/pettycash` or `tekno-lab/pettycash`).
2. Go to **Settings** > **Pages** (under Code and automation).
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. That's it! Push any commit to `main` (or click **Actions** > **Deploy to GitHub Pages** > **Run workflow**).
5. Your live app URL will be:  
   `https://<your-username>.github.io/pettycash/`

### Option B: Deploy from Branch
1. Go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
3. Select branch: `main` (or `master`), folder: `/ (root)`, and click **Save**.
4. GitHub Pages will publish the site in 1–2 minutes.

---

## 📊 Backend Setup (Google Sheets & Apps Script)

The app connects to a Google Sheet with Google Apps Script for cloud persistence, receipt archiving to Google Drive, and automated email receipts.

### 1. Create the Sheet
1. Open [Google Sheets](https://sheets.new) and create a new sheet named **Petty Cash**.
2. Click **Extensions** > **Apps Script**.
3. Delete any default code in `Code.gs`.
4. Copy and paste everything from [`backend/Code.gs`](./backend/Code.gs).
5. Click **Save** (💾).

### 2. Initial Setup Run
1. In the Apps Script toolbar, select the function **`setup`** and click **Run**.
2. Review permissions (Google shows "Authorization required" -> Click *Advanced* -> *Go to Petty Cash (unsafe)* -> *Allow*).
3. This creates:
   - **Setup** sheet (stores keys, currency, categories, email)
   - **Received** sheet (company cash given to manager)
   - **Paid** sheet (cash distributed to expense user)
   - **Expenses** sheet (recorded receipts & details)
   - **Petty Cash Receipts** folder in your Google Drive

### 3. Deploy Web App
1. In Apps Script, click **Deploy** > **New deployment**.
2. Select type: **Web app** (gear icon).
3. Set:
   - **Description**: `Petty Cash API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. Copy the **Web app URL** (ends with `/exec`).

### 4. Connect the App
1. Open your hosted Petty Cash app in your browser or phone.
2. Tap **Settings** (top right).
3. Paste the **Script address** (`https://script.google.com/macros/s/.../exec`).
4. Paste your **Access key** (from the **Setup** sheet in Google Sheets — use `ManagerKey` for manager features or `UserKey` for expense submitter).
5. Tap **Test connection**, then **Save settings**.

---

## 📱 Features

- **Offline-First PWA**: Works offline via Service Worker & IndexedDB.
- **Receipt Camera & Scanning**: Capture photos, rotate, apply flat-scan contrast filter, and bundle multi-page receipts into a compact PDF client-side.
- **Role-Based Views**:
  - **Expense User**: Submit new expenses, save drafts, view sync queue, track personal balance.
  - **Manager**: Record cash given/received, approve/reject deletion requests, monitor company ledger.
- **Reports & Claims**:
  - Filter by date period or category.
  - Printable Kurdish claim form (داواکاری خەرجکردنەوە).
  - Export transactions and expenses to CSV.
  - Instant print/PDF export.
