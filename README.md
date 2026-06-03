This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## PropertyIQ data (everypropertyAI)

The vendor report's **Just Sold** and **Just Listed** sections are filled from the
everypropertyAI **`/api/vendor-report`** endpoint. One call returns, for a subject
property, the **3 closest sold sales** and the **3 newest on-market listings within
500m** (distance, agency, image, listing URL included). The endpoint geocodes a
free-text address itself, so no client-side geocoding is needed.

### Config (env only — never hardcode)
- `EVERYPROPERTY_API_URL` — `https://geaeverypropertyai-production.up.railway.app`
- `EVERYPROPERTY_API_KEY` — project-dedicated Bearer key. **Server-side only.**

Set both in `.env.local` for dev **and** in this project's **Railway service
Variables** for prod.

### How it works
- `getVendorReportComps({ lat?, lng?, address?, radius?, excludeAddress? })` in
  `src/lib/everypropertyai.ts` — server-side `fetch` of `/api/vendor-report` with the
  Bearer header and a 30s timeout. **Fails soft**: any missing key / non-200 / network
  error returns empty arrays so a report still renders.
- `GET /api/local-market` (`src/app/api/local-market/route.ts`) is the **server-side
  holder of the Bearer key** — the browser only ever calls this same-origin route. It
  returns `{ solds, listings }`.
- `src/components/vendor/LocalMarket.tsx` renders up to 3 image cards per section
  (address, price, agency, "Xm away"), omitting a section when its array is empty and
  rendering nothing when both are empty.

> Coverage is **City of Casey + Shire of Cardinia** only — a subject outside that area
> returns empty arrays by design, and the sections simply don't render. Rentals are out
> of scope for this endpoint.
