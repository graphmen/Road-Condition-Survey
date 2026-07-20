# Zimbabwe Ministry of Transport - Road Condition Survey System

A comprehensive central repository and data collection system built for the Zimbabwe Ministry of Transport Infrastructural Development (Department of Roads). 

This system enables field surveyors to collect detailed road condition data (bridges, culverts, shelvets, road signs) offline in remote areas and sync them to a central analytics dashboard.

---

## 📂 Directory Structure

The project is structured as a monorepo:

*   `app/` - Next.js React frontend dashboard layout, pages, assets, and proxy API router.
*   `components/` - Shared UI components (dynamic Leaflet Map rendering, custom markers).
*   `public/` - Static assets and `roads-data.json` database telemetry cache.
*   `backend/` - FastAPI Python server connecting to Supabase database.
*   `mobile/` - Vite + React + TypeScript mobile app wrapped with Capacitor.

---

## ⚡ Setup & Local Development

### Prerequisites
*   Node.js (v18+) & npm
*   Python (v3.9+) & pip

### 1. Run the Next.js Frontend Dashboard
1.  Navigate to the root directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Run the FastAPI Backend Service
1.  Navigate to the `backend/` directory.
2.  Install python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Configure variables in `backend/.env` (override Supabase credentials or database settings here).
4.  Run the server:
    ```bash
    python -m uvicorn main:app --reload --port 8000
    ```
    *   API Documentation (Swagger UI) is available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Run the Mobile Client App
1.  Navigate to the `mobile/` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run Vite dev server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:5173](http://localhost:5173) in your browser to test the surveyor collect form interface.
5.  To build and sync with Capacitor:
    ```bash
    npm run build
    npx cap sync
    ```

---

## 🚀 GitHub Setup & Push Guide

To push this monorepo to your GitHub repository:

1.  **Initialize Git**:
    ```bash
    git init
    ```
2.  **Add files to tracking**:
    ```bash
    git add .
    ```
3.  **Commit changes**:
    ```bash
    git commit -m "feat: initial commit of Zimbabwe Roads condition survey system stack"
    ```
4.  **Link to your remote GitHub repository** (replace with your URL):
    ```bash
    git remote add origin https://github.com/your-username/zimbabwe-roads-condition-survey.git
    git branch -M main
    ```
5.  **Push to GitHub**:
    ```bash
    git push -u origin main
    ```

---

## 🌐 Vercel Web App Deployment

Vercel natively builds and hosts the Next.js web application serverlessly.

### Steps to Deploy:
1.  Go to the [Vercel Dashboard](https://vercel.com) and click **Add New > Project**.
2.  Import your GitHub repository: `zimbabwe-roads-condition-survey`.
3.  Configure Project Settings:
    *   **Framework Preset**: Next.js
    *   **Root Directory**: `./` (Root directory of the monorepo, since Next.js configuration sits at the root).
4.  Add **Environment Variables**:
    *   `SUPABASE_URL` = `https://your-project.supabase.co`
    *   `SUPABASE_ANON_KEY` = `your-anon-key`
    *   `DATABASE_URL` = `postgresql://postgres:password@db.your-project.supabase.co:5432/postgres`
    *   `OFFLINE_MODE` = `false` (Set to `false` on Vercel to fetch directly from the Supabase database when a user loads the dashboard!).
5.  Click **Deploy**. Vercel will build the frontend, package static assets, and deploy the serverless API proxy routes.

---

## 📱 Mobile App Native Build (Android)

To add Android platform capabilities to the Capacitor app:

1.  Navigate to `mobile/`:
    ```bash
    cd mobile
    ```
2.  Add Android platform support:
    ```bash
    npx cap add android
    ```
3.  Build and copy assets:
    ```bash
    npm run build
    npx cap sync
    ```
4.  Open the project in Android Studio:
    ```bash
    npx cap open android
    ```
5.  Run/Build APK in Android Studio. The `CapacitorHttp` plugin is pre-configured in `capacitor.config.ts` to automatically bypass strict CORS webview constraints.

Or build from the command line:

```bash
cd mobile/android
.\gradlew.bat assembleDebug
```

The APK is written to `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📲 Distribute APK to field collectors

Collectors install the app from a public download page on the web dashboard:

**Share this link:** `https://<your-domain>/download`

### Publish a new APK build

1. Build the Android APK (Android Studio or `gradlew assembleDebug` as above).
2. From the repo root, copy it into the hosted downloads folder:

```powershell
npm run publish:apk
# or with options:
powershell -ExecutionPolicy Bypass -File scripts/publish-apk.ps1 -Version "1.1" -ApkPath "path\to\app.apk"
```

This copies the file to `public/downloads/motid-road-survey.apk` and updates `public/downloads/app-info.json`.

3. Commit the APK + `app-info.json`, then redeploy the Next.js app (e.g. push to Vercel).
4. Send collectors: `https://<your-domain>/download`

Local test: [http://localhost:3000/download](http://localhost:3000/download)

The Settings panel on the dashboard also links to this page.
