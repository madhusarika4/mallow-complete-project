# Mallow frontend

The frontend is a React, TypeScript and Vite application. For complete project architecture, Windows setup, environment configuration and test instructions, see the [root README](../README.md).

From this directory, run `npm ci` and `npm run dev` to start the development server. Vite proxies `/api` to `http://127.0.0.1:8000` unless `MALLOW_API` is set. Use `npm run build`, `npm run lint` and `npm run test:e2e` for checks.
