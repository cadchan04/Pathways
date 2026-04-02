# Pathways

## Install dependencies

From the repository root:

```bash
npm run setup
```

This installs root packages and then server and client dependencies.

Equivalent manual steps:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

## Environment variables

The app reads secrets from local `.env` files. Examples are `.env.example`.

### Server

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set the variables below (see `server/.env.example`):

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string |
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | API identifier for JWT validation |
| `GEOAPIFY_API_KEY` | Routing |
| `GOOGLE_ROUTES_API_KEY` | Google Routes API |
| `DUFFEL_ACCESS_TOKEN` | Flights (Duffel) |
| `VAPID_MAILTO` | Web push (contact URI for VAPID) |
| `VAPID_PUBLIC_KEY` | Web push (server) |
| `VAPID_PRIVATE_KEY` | Web push (server) |

### Client (Vite)

```bash
cp client/.env.example client/.env
```

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API base URL |
| `VITE_AUTH0_AUDIENCE` | Must align with `AUTH0_AUDIENCE` where the client sends tokens |
| `VITE_VAPID_PUBLIC_KEY` | Web push — must match server `VAPID_PUBLIC_KEY` |

## Run the application

1. Start MongoDB and ensure `server/.env` is configured.
2. From the repository root:

```bash
npm run dev
```
Open `http://localhost:5173` in the browser.

Alternatively,

```bash
npm run dev:server   # or: cd server && npm run dev
npm run dev:client   # or: cd client && npm run dev
```

Alternatively,

```bash
cd server && npm start
```