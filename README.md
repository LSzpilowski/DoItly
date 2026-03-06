# DoItly

A clean, minimal todo app built with React + Vite. Supports Google and GitHub OAuth, cloud sync via Supabase, and works offline with localStorage for guests.

**Live:** [doitly.vercel.app](https://doitly.vercel.app)

## Features

- **Tasks** – add, edit, complete, archive, delete
- **Templates** – save reusable tasks for quick re-use
- **History** – last 10 deleted tasks, restorable with one click
- **Statistics** – completion rate, monthly/yearly breakdown
- **Auth** – Google & GitHub OAuth via Supabase
- **Guest mode** – full functionality without an account (localStorage)
- **Dark / light mode**
- **GDPR** – data export (JSON) and account deletion

## Tech Stack

| Framework | React 19 + Vite 7 |
| Language | TypeScript 5 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand |
| Backend | Supabase (PostgreSQL + Auth) |
| Deployment | Vercel |

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/LSzpilowski/todolist-app-next.js.git
cd todolist-app-next.js
pnpm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

Both values are available in your Supabase project under **Settings → API**.

### 3. Supabase setup

Run `supabase/complete-schema.sql` in the Supabase SQL Editor to create the `tasks` table, RLS policies, and the `delete_user_account()` function.

Add the following to **Authentication → URL Configuration → Redirect URLs**:

```
http://localhost:5173/auth/callback
https://doitly.vercel.app/auth/callback
```

### 4. Run locally

```bash
pnpm dev
```

Opens at [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | Run ESLint |

## Deployment

The project is configured for Vercel with SPA rewrites in `vercel.json`. Every push to `main` deploys automatically.

For other platforms, run `pnpm build` and serve the `dist/` folder as a static SPA with a catch-all rewrite to `index.html`.
