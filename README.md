# Invoice Desk (frontend)

React + TypeScript + Vite front end for the invoice-processing pipeline. The API, the sample invoices and the full
documentation live in [zamp-ps1-backend](https://github.com/Dhanesh-Pottekula/zamp-ps1-backend).

```
npm install
npm run dev
```

The dev server runs on http://localhost:5173 and proxies `/v1` to `http://localhost:8000` (override with
`VITE_API_TARGET`). On Vercel, `vercel.json` forwards `/v1` to the deployed backend and serves `index.html` for the
app's own routes.
