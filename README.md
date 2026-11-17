# Ana's Book Browse

A simple, public book catalog and borrowing-request system. Visitors can browse and search books without creating an account; authorized staff use a separate sign-in portal to manage the collection and requests.

## Features

- Public catalog with title, author, and category search; category filters; ratings; availability; and responsive book cards.
- Borrowing requests without visitor accounts. The backend checks availability and reserves a copy atomically; staff can approve or reject requests and record returns.
- Staff-only portal for managing books, cover images, categories, inventory, and borrowing requests.
- Supabase Auth for staff credentials, Supabase Postgres for library data, and Supabase Storage for uploaded covers.
- Vercel-ready frontend and serverless API in one deployment.

## Technologies

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database, authentication, and image storage:** Supabase
- **Deployment:** Vercel

## Project structure

```text
.
├── api/
│   └── [...path].ts          # Vercel serverless entry point
├── backend/
│   ├── src/
│   │   ├── app.ts            # Express API and staff authorization
│   │   ├── server.ts         # Local API server
│   │   └── supabase.ts       # Server-only Supabase clients
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Public catalog and staff portal
│   │   ├── api.ts            # Frontend API client
│   │   └── styles.css
│   └── package.json
├── supabase/
│   ├── schema.sql            # Tables, policies, atomic operations, and initial books
│   └── seed.sql              # Additional books to fill out every category
├── .env.example
├── package.json
└── vercel.json
```

## Requirements

- Node.js 20 or newer and npm.
- A Supabase project.

## Install and run locally

1. Install the workspace dependencies from the project root:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` in the project root, then fill in the values from **Supabase → Project Settings → API**:

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   PORT=4000
   FRONTEND_ORIGIN=http://localhost:5173
   VITE_API_URL=
   ```

   The publishable/anon key supports public catalog reads. The service-role key is required for borrowing transactions and staff administration so those operations stay behind the validated, rate-limited backend. Keep `.env` private; use the service-role key only in the backend, never with a `VITE_` prefix or in committed files.

3. Set up Supabase using the instructions below.

4. Start both applications from the project root:

   ```sh
   npm run dev
   ```

   The frontend is at `http://localhost:5173`; the API is at `http://localhost:4000`. Vite proxies local `/api` requests to the backend.

Run either side separately when needed:

```sh
npm run dev --workspace frontend
npm run dev --workspace backend
```

## Supabase setup

1. Open the Supabase SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql). It creates the categories, books, staff, and borrowing-record tables; read policies; transaction-safe database functions; a public `book-covers` storage bucket; and the initial sample books.
2. Run [`supabase/seed.sql`](./supabase/seed.sql) to add 18 more books. Together, the two seed scripts provide three books in each of the ten categories, with Open Library cover images. If you have already run the schema, you can run this seed script on its own.
3. In **Authentication → Users**, create an account for each staff member. Public visitors do not need an account.
4. Add authorized staff to the `staff` table, using the user ID and email of the account you just created:

   ```sql
   insert into public.staff (user_id, name, email, role)
   select id, 'Library Staff', email, 'admin'
   from auth.users
   where email = 'staff@example.com';
   ```

4. Set the server environment variables from `.env.example`. The service-role key must remain server-side. The database uses row-level security; frontend database access is through the API.

Borrowing requests reserve a copy in a single Postgres transaction. Requests have a 14-day due date. Rejecting a pending request or returning an approved loan restores exactly one copy. Staff cannot reduce the total inventory below the number of pending or active loans.

## API overview

- `GET /api/books`, `GET /api/categories` — public catalog.
- `POST /api/borrowings` — validate and submit a visitor request.
- `POST /api/staff/login` — authenticate through Supabase Auth and verify the staff allowlist.
- `/api/staff/books`, `/api/staff/categories`, `/api/staff/borrowings` — authenticated staff inventory and request management.
- `POST /api/staff/covers` — authenticated cover upload (JPG, PNG, or WebP; up to 5 MB).
- `POST /api/staff/borrowings/:id/approve`, `/reject`, or `/return` — process a request.

## Build and checks

```sh
npm run typecheck
npm run build
```

## Deploy to Vercel

This repository is configured as a **single Vercel project**: the static frontend is built from `frontend/`, and the Express backend is exposed as a Vercel Node.js function from `api/[...path].ts`. The Vercel configuration is at the repository root.

1. Import the repository in Vercel and set the **Root Directory** to the project root (the directory containing this README and `vercel.json`).
2. Keep the build settings from `vercel.json`: install with `npm install`, build with `npm run build --workspace frontend`, and serve `frontend/dist`. Do not add a competing `builds` configuration.
3. In the Vercel project’s environment-variable settings, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Add them for every environment you will deploy. They are read by the serverless API; do not expose the service-role key to the browser.
4. Leave `VITE_API_URL` empty for the default same-origin deployment. If the frontend is hosted separately, set `VITE_API_URL` to the backend’s origin and configure the backend’s `FRONTEND_ORIGIN` to the frontend URL.
5. Deploy. The rewrite in `vercel.json` sends browser routes such as `/staff` to the frontend while `/api/*` is handled by the serverless function.

Vercel serverless functions do not run the local Express listener. Both Vercel and local development use the same Express API routes and Supabase operations.

## About this project

This project, Ana's Book Browse, was created for my classmates. I wanted to help them with their projects while also gaining my own experience in developing a real-world application. I made this project as a personal learning experience to improve my skills in frontend development, backend development, database management, and system deployment.
