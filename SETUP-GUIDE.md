# Atelier — Setup Guide for Beginners (Windows + IIS)

This guide shows how to run the **Atelier** website on your own Windows PC using **IIS**
(the web server built into Windows), and how to let other devices open it.
No coding is needed. Just follow the steps in order.

**What you will end up with:** the app opens in your browser at `http://localhost:8080`.

**How it works (simple version):** the app has two parts — the website and a small program
(Node.js) behind it that saves your data. IIS is the "front door" on port 8080 that passes
everything to that program.

---

## Part A — One-time setup (about 20 minutes)

You need a Windows 10/11 **Pro** PC and an internet connection. Do the steps in order.

### Step 1. Turn on IIS
1. Press **Win + R**, type `optionalfeatures`, press **Enter**.
2. Tick **Internet Information Services**. Click **OK** and wait. Restart if asked.
3. Open a browser and go to `http://localhost`. A blue **Internet Information Services**
   page means it works.

> Can't find "Internet Information Services" in the list? Your Windows edition may not
> include it. Ask the person who sent you this guide.

### Step 2. Install the two IIS add-ons
Download and run each installer (click Next / Accept until it finishes):
1. **URL Rewrite** — https://www.iis.net/downloads/microsoft/url-rewrite
2. **Application Request Routing (ARR)** — https://www.iis.net/downloads/microsoft/application-request-routing

### Step 3. Install Node.js, Git and pnpm
1. **Node.js** (choose "LTS") — https://nodejs.org → run the installer.
2. **Git** — https://git-scm.com/download/win → run the installer (default options are fine).
3. Close all open windows, then open **PowerShell** (Start menu → type `PowerShell`) and run:
   ```
   npm install -g pnpm
   ```

### Step 4. Download the project
In PowerShell, run (you can pick another folder instead of `C:\sites`):
```
mkdir C:\sites
cd C:\sites
git clone https://github.com/vinurockz/atelier-media-gallery.git
cd atelier-media-gallery
```
> If it says the repo is not found or asks for a password, the repo is private. Ask the owner
> to add your GitHub account as a collaborator, or to send you the project as a ZIP file
> (unzip it, then `cd` into the folder).

### Step 5. Install and build the project
Still in that folder, run:
```
pnpm install
pnpm build
```
Each may take a minute or two. Warnings in yellow are fine; red **errors** are not.

### Step 6. Create the IIS site (needs Administrator)
1. Click Start, type `PowerShell`, right-click **Windows PowerShell** → **Run as administrator**.
2. Run:
   ```
   cd C:\sites\atelier-media-gallery
   powershell -ExecutionPolicy Bypass -File scripts\setup-iis.ps1
   ```
3. It should finish with **"Done."**

### Step 7. Start the app
1. In File Explorer, open the project folder and **double-click `start-server.bat`**.
2. A black window opens. **Keep it open** — it is the app's engine.
3. Open **http://localhost:8080** in your browser. The app should appear.

🎉 You're done with setup.

---

## Part B — Every day use

| I want to… | Do this |
|---|---|
| Start the app | Double-click `start-server.bat`, keep the black window open, then open `http://localhost:8080` |
| Stop the app | Close the black window |
| After restarting the PC | Double-click `start-server.bat` again (IIS starts by itself) |
| Start it automatically at login | Press **Win + R**, type `shell:startup`, Enter. Put a *shortcut* to `start-server.bat` in that folder |

If the PC is switched off, or the black window is closed, the site is offline and the browser
shows **502 Bad Gateway**. Just start it again.

---

## Part C — Let other devices open it (same Wi-Fi / network)

1. On the host PC, find its address: open PowerShell, run `ipconfig`, and note the
   **IPv4 Address** (for example `192.168.1.25`).
2. Allow the port through the firewall — in an **Administrator** PowerShell run:
   ```
   New-NetFirewallRule -DisplayName "Atelier 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```
3. On the other device (same network), open `http://192.168.1.25:8080` (use your own address).

The host PC must be on, and `start-server.bat` running, for others to connect.

---

## Updating to a newer version later

```
cd C:\sites\atelier-media-gallery
git pull
pnpm install
pnpm build
```
Then close and re-open `start-server.bat`.

---

## Problems and fixes

| What you see | Fix |
|---|---|
| **502 Bad Gateway** | The engine isn't running. Double-click `start-server.bat` |
| **500.19** or **404** on every page | URL Rewrite / ARR not installed (Step 2), or run Step 6 again as Administrator |
| Black window says **port 4000 already in use** | The app is already running — just open the site |
| Uploading a big video fails | Make sure `web.config` is in `C:\inetpub\atelier` (Step 6 puts it there) |
| `pnpm` / `node` is "not recognized" | Close PowerShell and open a new one after installing (Step 3) |
| Anything else | Copy the exact error text and send it to the person who shared this guide |

> **Your data** (accounts, notes, uploads) is stored in the project's `server\data` folder on
> this PC. It is not in GitHub, so back that folder up if it matters.
