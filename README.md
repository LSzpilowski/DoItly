# DoItly

A clean, minimal todo app built with React + Vite. Supports Google OAuth, cloud sync via Supabase, and works offline with localStorage for guests. Now with drag & drop planning, workspaces, Pomodoro focus mode, and private beta security.

**Live:** [doitly.vercel.app](https://doitly.vercel.app)

---

## Features

- **Tasks** – add, edit, complete, archive, delete, rich fields (title, description, due date, priority, repeat, tags, notes, subtasks)
- **Drag & Drop Planning** – plan your day/week/month with DnD in DayPlanner, WeekPlanner, CalendarView
- **Templates** – save reusable tasks for quick re-use
- **Workspaces & Categories** – multiple workspaces, custom categories per workspace
- **Pomodoro Focus Mode** – timer, session stats, sound alerts, push notifications
- **Statistics** – completion rate, overdue, Pomodoro history, charts (recharts)
- **Auth** – Google OAuth via Supabase, private beta whitelist access
- **Guest mode** – full functionality without an account (localStorage)
- **Security** – RLS, whitelist, rate limiting, CSP headers, GDPR delete
- **Dark / light / system theme** – Tailwind v4 + next-themes, WCAG AA contrast
- **Offline detector** – toast on network change
- **E2E tests** – Playwright scenarios I–IX
- **Roadmap & spec-driven development** – see `/docs/`

---

## Tech Stack

| Framework | React 19 + Vite 7 |
| Language | TypeScript 5 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand |
| DnD | @dnd-kit/core + @dnd-kit/sortable |
| Charts | recharts |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Testing | Playwright E2E |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/LSzpilowski/DoItly.git
cd DoItly
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

Run `supabase/complete-schema.sql` in the Supabase SQL Editor to create the `tasks` table, RLS policies, whitelist, rate limiting, and the `delete_user_account()` function.

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

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm test:e2e` | Run Playwright E2E tests |

---

## Deployment

The project is configured for Vercel with SPA rewrites in `vercel.json`. Every push to `main` deploys automatically.

For other platforms, run `pnpm build` and serve the `dist/` folder as a static SPA with a catch-all rewrite to `index.html`.

---

## License

MIT
