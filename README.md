# Petty Cash Management System (PWA)

A progressive web application for tracking petty cash, photographing/scanning receipts, generating client-side PDF documents, managing expense claims, and syncing with Google Sheets.

---

## 🚀 How to Host on GitHub Pages

### Option A: Automatic via GitHub Actions (Recommended)
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **GitHub Actions**.
3. Push to `main` (or run **Actions** > **Deploy to GitHub Pages**).
4. The live site will be published at:  
   `https://<your-username>.github.io/<repo-name>/`

### Option B: Deploy from Branch
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **Deploy from a branch**.
3. Set the branch to **`main`** (or `master`) and folder to **`/ (root)`**, then click **Save**.

---

## 📊 Google Sheets Apps Script Setup

The app connects to a Google Sheet via Google Apps Script for persistent transaction records, receipt storage in Google Drive, and automated email receipts.

### 1. Create the Sheet & Apps Script
1. Open [Google Sheets](https://sheets.new) and name it **Petty Cash**.
2. Go to **Extensions** > **Apps Script**.
3. Paste your Apps Script code in the editor and click **Save**.

### 2. Run Setup
1. In the function dropdown, select **`setup`** and click **Run**.
2. Review and grant Google permissions.

### 3. Deploy Web App
1. Click **Deploy** > **New deployment**.
2. Select type: **Web app** (gear icon).
3. Set:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy** and copy the **Web app URL** (`.../exec`).

### 4. Connect the App
1. Open your hosted Petty Cash app.
2. Tap **Settings** (top right).
3. Enter your **Script address** (`.../exec`) and your **Access key** (Manager key or User key from the Setup sheet).
4. Tap **Test connection**, then **Save settings**.
