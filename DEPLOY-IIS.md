# Deploying to IIS (Windows)

The app is a React build (`dist/`) **plus** a Node/Express backend (`server/index.mjs`) that
serves the API and the built site. IIS can't run the backend itself, so IIS acts as a
**reverse proxy** in front of Node.

```
Browser -> IIS (site, port, HTTPS) -> Node on http://localhost:4000 (SPA + /api)
```

## 1. Install prerequisites on the server

1. **IIS**: Windows Features -> *Internet Information Services* (or Server Manager -> Add Roles -> Web Server).
2. **URL Rewrite** module: https://www.iis.net/downloads/microsoft/url-rewrite
3. **Application Request Routing (ARR)**: https://www.iis.net/downloads/microsoft/application-request-routing
   Then in IIS Manager: server node -> *Application Request Routing Cache* -> *Server Proxy Settings* -> tick **Enable proxy** -> Apply.
4. **Node.js** (LTS) and **pnpm** (`npm i -g pnpm`).

## 2. Get and build the project

```powershell
git clone https://github.com/vinurockz/atelier-media-gallery.git C:\sites\atelier
cd C:\sites\atelier
pnpm install
pnpm build
```

`server/data/` (accounts, notes, uploads) is created on first run and is **not** in git.
Back it up, and keep it when you redeploy.

## 3. Run Node as a Windows service

Use [NSSM](https://nssm.cc/) so Node starts on boot and restarts on crash:

```powershell
nssm install AtelierApi "C:\Program Files\nodejs\node.exe" "C:\sites\atelier\server\index.mjs"
nssm set AtelierApi AppDirectory C:\sites\atelier
nssm set AtelierApi AppEnvironmentExtra PORT=4000
nssm start AtelierApi
```

Check it: open `http://localhost:4000` on the server. The app should load.

Optional env vars (only if you use Google sign-in), added to `AppEnvironmentExtra`:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
(set the redirect to your real public URL, e.g. `https://yourdomain/api/auth/google/callback`).

## 4. Create the IIS site

1. IIS Manager -> **Sites** -> **Add Website**.
2. *Site name*: `Atelier`. *Physical path*: `C:\sites\atelier` (the folder containing `web.config`).
3. *Binding*: choose a port (e.g. 80), and a host name if you have one.
4. For HTTPS, add an `https` binding with your certificate.
5. Browse the site. All requests are proxied to Node via `web.config`.

If you change the Node port, edit the `url` in `web.config` to match.

## Updating later

```powershell
cd C:\sites\atelier
git pull
pnpm install
pnpm build
nssm restart AtelierApi
```

## Troubleshooting

- **HTTP 500.19 / 404 on everything**: URL Rewrite or ARR isn't installed, or proxy isn't enabled.
- **502 Bad Gateway**: the Node service isn't running (`nssm status AtelierApi`).
- **Upload fails with 404.13**: `web.config` upload limit missing; keep the `requestLimits` entry.
- **Teams messages only appear after a long delay**: ARR is buffering. Run `scripts\setup-iis.ps1`
  again, or as Administrator:
  `appcmd set config -section:system.webServer/proxy /responseBufferLimit:"0" /commit:apphost`
  (this is a server-wide ARR setting).

## Before putting it on the internet

**Do not expose the site publicly yet.** Check each of these first:

1. **HTTPS only**, with a real certificate, and set the env var `SECURE_COOKIES=1` for Node.
2. **Block port 4000** from outside; only IIS should be reachable.
3. **Registration is open**: anyone who finds the site can create an account.
4. **API Tester** (`POST /api/api-tester/send`) lets any signed-in user make the server request
   any address, including machines on your private network. Restrict or disable it first.
5. **Back up `server/data/`.** It holds accounts, messages and uploaded files.
6. There is no password reset, email verification, or storage limit per account.
