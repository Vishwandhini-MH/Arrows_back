# Superset Embed Backend

Node.js/Express backend for securely generating Apache Superset embedded dashboard guest tokens.

This backend exists so the frontend never stores Superset credentials. The frontend calls this backend, this backend logs in to Superset, generates a short-lived guest token, and returns only the data needed to embed the dashboard.

## Current Local Setup

```txt
Backend URL: http://localhost:5000
Health check: http://localhost:5000/health
Guest token API: http://localhost:5000/api/superset-token
Superset URL: http://localhost:8088
```

Allowed frontend origins are configured in `.env` through `FRONTEND_ORIGIN`.

Current expected frontend origins:

```txt
http://localhost:3000
http://localhost:5173
http://127.0.0.1:5173
```

## Important Security Note

Do not copy real Superset passwords, admin credentials, service-account passwords, or private production UUIDs into frontend code or committed documentation.

The local `.env` file contains backend-only configuration and is ignored by Git. The frontend team should receive the API contract below, not the Superset password.

Frontend may know:

```txt
Backend base URL
Guest token endpoint
Superset domain returned by the backend
Dashboard UUID returned by the backend response
```

Frontend must not know:

```txt
SUPERSET_USERNAME
SUPERSET_PASSWORD
Superset access token
Superset CSRF token
Superset session cookies
```

## Folder Structure

```txt
backend/
  config/
    superset.js
  controllers/
    supersetController.js
  routes/
    supersetRoutes.js
  services/
    supersetService.js
  .env
  .env.example
  .gitignore
  package.json
  package-lock.json
  README.md
  server.js
```

`node_modules/` is created after `npm install` and should not be copied into documentation or committed.

## File Details

### `server.js`

Main backend entrypoint.

Responsibilities:

- Loads `.env` using `dotenv`.
- Creates the Express app.
- Reads `PORT` from `.env`, defaulting to `5000`.
- Enables security middleware with `helmet`.
- Enables JSON request parsing.
- Enables request logging with `morgan`.
- Enables CORS using `FRONTEND_ORIGIN`.
- Adds `GET /health`.
- Mounts Superset API routes under `/api`.
- Adds a 404 handler.
- Adds a centralized error handler.
- Starts the server.

Important routes from this file:

```txt
GET /health
GET /api/superset-token
```

### `routes/supersetRoutes.js`

Defines the Superset route group.

Current route:

```txt
GET /api/superset-token
```

This route calls `getSupersetGuestToken` from `controllers/supersetController.js`.

### `controllers/supersetController.js`

Handles the HTTP request/response layer for Superset token generation.

Current behavior:

- Calls `generateGuestToken()` from `services/supersetService.js`.
- Sets `Cache-Control: no-store`.
- Returns HTTP `200` with the guest token payload.
- Passes failures to the Express error handler.

### `services/supersetService.js`

Contains the Superset API integration.

Superset API flow:

```txt
1. POST /api/v1/security/login
2. GET /api/v1/security/csrf_token/
3. POST /api/v1/security/guest_token/
```

What it does:

- Logs in to Superset using backend-only credentials.
- Extracts the Superset access token.
- Captures Superset session cookies.
- Requests a CSRF token.
- Generates a guest token for the configured dashboard UUID.
- Returns the token, dashboard UUID, and Superset domain to the frontend.
- Normalizes Superset errors before sending them through Express.

### `config/superset.js`

Loads Superset environment variables and validates them when a guest token is requested.

Required variables:

```env
SUPERSET_BASE_URL=
SUPERSET_USERNAME=
SUPERSET_PASSWORD=
SUPERSET_DASHBOARD_UUID=
```

Optional variables:

```env
SUPERSET_PROVIDER=db
SUPERSET_GUEST_USERNAME=embedded_user
SUPERSET_GUEST_FIRST_NAME=Embedded
SUPERSET_GUEST_LAST_NAME=User
```

If any required variable is missing, the backend still starts so Railway health checks can pass. The guest token endpoint returns a clear error like:

```txt
Missing required Superset environment variables: SUPERSET_PASSWORD
```

### `.env`

Local backend environment file. This file is ignored by Git and should not be shared publicly.

Expected shape:

```env
PORT=5000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173

SUPERSET_BASE_URL=http://localhost:8088
SUPERSET_USERNAME=<backend-only-superset-user>
SUPERSET_PASSWORD=<backend-only-superset-password>
SUPERSET_PROVIDER=db
SUPERSET_DASHBOARD_UUID=<dashboard-uuid-from-superset-embed-settings>

SUPERSET_GUEST_USERNAME=embedded_user
SUPERSET_GUEST_FIRST_NAME=Embedded
SUPERSET_GUEST_LAST_NAME=User
```

Credential ownership:

```txt
SUPERSET_USERNAME: backend only
SUPERSET_PASSWORD: backend only
SUPERSET_DASHBOARD_UUID: backend config; frontend receives it from API response
SUPERSET_BASE_URL: backend config; frontend receives it as supersetDomain from API response
```

### `.env.example`

Template for creating `.env`.

Use it when setting up a new machine:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` with real local values.

### `package.json`

Defines project metadata, scripts, runtime type, and dependencies.

Scripts:

```json
{
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

Use `npm run dev` during development. Use `npm start` for a normal Node start.

Runtime:

```json
{
  "type": "module",
  "engines": {
    "node": ">=18"
  }
}
```

Main dependencies:

```txt
express: HTTP server and routing
axios: Superset API requests
cors: frontend origin allowlist
dotenv: load .env
helmet: security headers
morgan: request logging
nodemon: development auto-restart
```

### `.gitignore`

Prevents local and generated files from being committed.

Important ignored files:

```txt
node_modules/
.env
npm-debug.log*
```

## Setup

From the `backend` folder:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

For Git Bash/macOS/Linux:

```bash
npm install
cp .env.example .env
npm run dev
```

After copying `.env.example`, update `.env` with real Superset values.

## Run Commands

Development mode with auto-restart:

```powershell
npm run dev
```

Normal start:

```powershell
npm start
```

Health check:

```powershell
Invoke-RestMethod http://localhost:5000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Guest token check:

```powershell
Invoke-RestMethod http://localhost:5000/api/superset-token
```

## Frontend API Contract

### `GET /health`

Purpose: confirms backend is running.

Response:

```json
{
  "status": "ok"
}
```

### `GET /api/superset-token`

Purpose: returns a fresh Superset guest token payload for the embedded dashboard.

Frontend request:

```js
const response = await fetch("http://localhost:5000/api/superset-token");
const data = await response.json();
```

Success response:

```json
{
  "token": "guest-token-from-superset",
  "dashboardUuid": "dashboard-uuid-from-backend-env",
  "supersetDomain": "http://localhost:8088"
}
```

Response fields:

```txt
token: short-lived Superset guest token
dashboardUuid: dashboard ID to pass into embedDashboard
supersetDomain: Superset host to pass into embedDashboard
```

Frontend should not hardcode the dashboard UUID if it can read `dashboardUuid` from this response.

## Frontend Integration Example

Install the Superset Embedded SDK in the frontend project:

```powershell
npm install @superset-ui/embedded-sdk
```

For Vite, add this to the frontend `.env`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

React component example:

```jsx
import { useEffect, useRef } from "react";
import { embedDashboard } from "@superset-ui/embedded-sdk";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function SupersetDashboard() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    async function fetchTokenData() {
      const response = await fetch(`${BACKEND_URL}/api/superset-token`);

      if (!response.ok) {
        throw new Error("Failed to fetch Superset guest token");
      }

      return response.json();
    }

    async function mountDashboard() {
      const initialData = await fetchTokenData();

      if (!mounted || !containerRef.current) return;

      embedDashboard({
        id: initialData.dashboardUuid,
        supersetDomain: initialData.supersetDomain,
        mountPoint: containerRef.current,
        fetchGuestToken: async () => {
          const data = await fetchTokenData();
          return data.token;
        },
        dashboardUiConfig: {
          hideTitle: true,
          filters: {
            expanded: false,
          },
        },
      });
    }

    mountDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "800px" }} />;
}
```

For Create React App, use this frontend `.env` value instead:

```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

Then read it with:

```jsx
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
```

## Superset Configuration Checklist

In Superset, embedded dashboards must be enabled.

Example Superset config:

```python
FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
}

GUEST_TOKEN_JWT_SECRET = "replace-with-a-long-random-production-secret"
```

The dashboard's embed settings must allow the frontend origin.

For local development, allow whichever frontend URL is actually used:

```txt
http://localhost:3000
http://localhost:5173
http://127.0.0.1:5173
```

## How Dashboard Changes Reach Frontend

The frontend embeds the live Superset dashboard through an iframe created by `@superset-ui/embedded-sdk`.

When charts, filters, layout, or dashboard content are changed and saved in Superset, the embedded dashboard loads the latest saved Superset version. Usually the frontend page only needs a refresh.

## Troubleshooting

### `app crashed - waiting for file changes before starting`

Check the line above the Nodemon message. The real error is usually there.

Common cause in this project:

```txt
Error: listen EADDRINUSE: address already in use :::5000
```

That means another process is already using port `5000`.

Check the process:

```powershell
netstat -ano | findstr :5000
```

Stop the process by PID:

```powershell
Stop-Process -Id <PID>
```

Then restart:

```powershell
npm run dev
```

Alternative: change the backend port in `.env`.

```env
PORT=5001
```

Then update the frontend backend URL:

```env
VITE_BACKEND_URL=http://localhost:5001
```

### Missing Environment Variable

If `/api/superset-token` fails with:

```txt
Missing required Superset environment variables: SUPERSET_DASHBOARD_UUID
```

Open `.env` locally, or add the missing variable in Railway.

### CORS Error

If the frontend cannot call the backend, confirm the frontend origin is listed in `FRONTEND_ORIGIN`.

Example:

```env
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
```

Restart the backend after changing `.env`.

### `Not authorized`

If `/api/superset-token` returns:

```json
{
  "message": "Not authorized"
}
```

Superset rejected the configured backend credentials or the Superset user does not have permission to generate guest tokens.

Check:

```txt
SUPERSET_USERNAME
SUPERSET_PASSWORD
SUPERSET_PROVIDER
Superset user permissions
Superset embedded dashboard configuration
```

### Frontend Shows Blank Embed

Check:

```txt
Backend /health returns ok
Backend /api/superset-token returns token, dashboardUuid, supersetDomain
Superset is running at SUPERSET_BASE_URL
Dashboard embed settings allow the frontend origin
Frontend is using the same URL listed in FRONTEND_ORIGIN
Browser console has no iframe, CORS, or Superset permission errors
```

## Production Notes

- Do not expose Superset admin credentials in frontend code.
- Use a dedicated Superset service account instead of a personal admin account.
- Keep `.env` out of Git.
- Restrict `FRONTEND_ORIGIN` to real frontend domains.
- Configure allowed embed domains inside Superset dashboard embed settings.
- Set a strong `GUEST_TOKEN_JWT_SECRET` in Superset.
- Keep guest tokens short-lived and fetch fresh tokens from the backend.
- Add application authentication before `/api/superset-token` in production.
- Use row-level security rules in `rls` if users should only see scoped data.
- Serve the backend behind HTTPS in production.

## Railway Deployment Notes

Railway should use the existing `npm start` script:

```powershell
npm start
```

The server already listens on `process.env.PORT`, which Railway provides automatically. Do not hardcode a Railway port.

Add these variables in Railway project settings:

```env
NODE_ENV=production
FRONTEND_ORIGIN=<your-deployed-frontend-url>
SUPERSET_BASE_URL=<your-public-superset-url>
SUPERSET_USERNAME=<backend-only-superset-user>
SUPERSET_PASSWORD=<backend-only-superset-password>
SUPERSET_PROVIDER=db
SUPERSET_DASHBOARD_UUID=<dashboard-uuid-from-superset-embed-settings>
SUPERSET_GUEST_USERNAME=embedded_user
SUPERSET_GUEST_FIRST_NAME=Embedded
SUPERSET_GUEST_LAST_NAME=User
```

After deployment, test:

```txt
https://<your-railway-domain>/health
https://<your-railway-domain>/api/superset-token
```
