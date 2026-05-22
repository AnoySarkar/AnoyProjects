# 🚀 Aura Tracker: PWA Portfolio Deployment Guide

Aura Tracker is a Progressive Web App (PWA) configured with a fully relative build structure. This means the compiled bundle inside the `dist` folder can be uploaded to **any subfolder or path on GitHub Pages** and will function perfectly with instant offline availability!

Follow this step-by-step guide to push this to GitHub and deploy it in under 2 minutes:

## Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com) and click **New Repository**.
2. Name your repository (e.g., `aura-tracker`).
3. Set the repository to **Public**.
4. Leave "Add a README", "Add .gitignore", and "Choose a license" **UNCHECKED** (we already have clean custom configurations in this codebase).
5. Click **Create repository**.

---

## Step 2: Initialize Git and Push Code
Open your terminal (PowerShell or Git Bash) inside your workspace directory `subscription-tracker` and execute:

```bash
# Initialize git repository
git init

# Add all files (including PWA assets and configurations)
git add .

# Create the initial commit
git commit -m "feat: launch Aura Tracker PWA with 4 premium themes & fast logger"

# Rename branch to main
git branch -M main

# Link to your newly created GitHub repository
# (Replace USERNAME and REPO-NAME with your actual GitHub details)
git remote add origin https://github.com/USERNAME/REPO-NAME.git

# Push the codebase to GitHub
git push -u origin main
```

---

## Step 3: Deploy to GitHub Pages (Automatic in 1 Click)
GitHub Pages can deploy your tracker instantly using the compiled `dist` folder:

### Option A: Via GitHub Pages Settings (Easiest)
1. In your GitHub repository webpage, click on the **Settings** tab.
2. Under the left menu, select **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose **main** as the branch, and change the folder from `/ (root)` to `/docs` (if you build it to a docs folder).
   * *Pro-tip:* If you deploy the main branch root, you can use **GitHub Actions** or simply push your compiled files directly to a `gh-pages` branch.

### Option B: Quick Manual gh-pages deployment (Recommended)
You can deploy instantly using the `gh-pages` package:
1. Run `npm install gh-pages --save-dev`
2. Add a `deploy` script to your `package.json`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
3. Run `npm run deploy` inside your terminal!
4. GitHub Pages will instantly host your app, and you can view it at:
   `https://USERNAME.github.io/REPO-NAME/`

---

## 🎯 Premium PWA Installation
Once hosted on GitHub Pages (which automatically provides secure **HTTPS**):
- **On Mobile (iOS/Safari):** Open the URL, tap the **Share** button, and select **"Add to Home Screen"**.
- **On Mobile (Android/Chrome):** Open the URL, and click the **"Add Aura Tracker to Home Screen"** banner popup.
- **On Desktop (Chrome/Edge):** Look at the right side of the address bar for the **Install** icon, or open the browser menu and select **"Install Aura Tracker..."**.

Now, your customized performance tracking station resides directly in your phone or desktop taskbar, operates with instantaneous load times, and works 100% offline!
