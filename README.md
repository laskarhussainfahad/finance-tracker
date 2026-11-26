# ₹ Finance Tracker

A personal finance app for tracking income and expenses, setting monthly budgets per category, and seeing where your money goes through charts.

**Live demo:** _(link coming soon)_ — log in with `demo@example.com` / `demo12345`, or sign up with any email.

It runs entirely in your browser: no server or database to set up, and your data is saved in your own browser (localStorage). An optional Express + PostgreSQL backend is included in `server/` for a full-stack setup.

![Dashboard](docs/screenshots/dashboard.png)

## Features

- **Accounts**: sign up and log in with hashed passwords (bcrypt) and JWT authentication
- **Transactions**: add, edit, delete and filter income and expenses by month and type
- **Categories**: sensible defaults (Food, Rent, Salary…) created for every new user
- **Dashboard**: monthly income, expenses and balance, a spending-by-category donut chart, and a 6-month income-vs-expense bar chart
- **Budgets**: set a monthly limit per category, with progress bars that turn amber at 80% and red when you go over, plus an over-budget alert on the dashboard
- **Light and dark theme**: follows your system setting by default, with a toggle to pick light, dark or system; the choice is remembered
- **Data isolation**: every query is scoped to the logged-in user, and this is covered by tests

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts, React Router |
| Backend | Node.js, Express, TypeScript, Zod (validation) |
| Database | PostgreSQL with Drizzle ORM (type-safe queries and SQL migrations) |
| Auth | JWT + bcrypt |
| Testing | Vitest + Supertest (API integration tests against a real database) |

## Project structure

```
finance-tracker/
├── client/                 # React frontend
│   └── src/
│       ├── api/            # fetch wrapper + shared types
│       ├── components/     # Layout, Modal, TransactionForm, MonthPicker
│       ├── context/        # AuthContext (login state)
│       └── pages/          # Dashboard, Transactions, Budgets, Login/Register
└── server/                 # Express API
    ├── drizzle/            # generated SQL migrations
    ├── src/
    │   ├── db/             # schema, connection, migrate + seed scripts
    │   ├── middleware/     # JWT auth, error handler
    │   └── routes/         # auth, transactions, categories, budgets, stats
    └── tests/              # API tests
```

## Running it locally

**Prerequisite:** Node.js 20+.

```bash
cd client
npm install
npm run dev        # open http://localhost:5173
```

That's it: the app uses its built-in browser backend (`client/src/api/localBackend.ts`), so no server or database is needed. Log in with **demo@example.com / demo12345** or create an account. Data is stored in your browser's localStorage, so each visitor has their own.

### Optional: run with the real backend

To use the Express + PostgreSQL API instead (shared data, real JWT auth):

1. Create a PostgreSQL database called `finance_tracker` (locally, or free on [Neon](https://neon.tech)).
2. Start the API:
   ```bash
   cd server
   npm install
   cp .env.example .env      # on Windows: copy .env.example .env
   # edit .env: DATABASE_URL and JWT_SECRET
   npm run db:migrate
   npm run db:seed           # optional demo data
   npm run dev               # http://localhost:4000
   ```
3. In `client/`, create a `.env` file containing `VITE_BACKEND=server`, then run `npm run dev`.

## Deployment

Deployed on [Vercel](https://vercel.com) from this repository (root directory `client`). Every push to `main` redeploys automatically.

## Running tests (backend)

```bash
cd server
npm test
```

## API overview

All routes except `/api/auth/*` need an `Authorization: Bearer <token>` header.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/transactions?month=YYYY-MM&type=INCOME\|EXPENSE` | List transactions |
| POST / PUT / DELETE | `/api/transactions[/:id]` | Create, update, delete |
| GET / POST | `/api/categories` | List or add categories |
| GET | `/api/budgets?month=YYYY-MM` | Budgets with amount spent |
| POST / DELETE | `/api/budgets[/:id]` | Set (create or update) or remove a budget |
| GET | `/api/stats/summary?month=YYYY-MM` | Income, expense, balance, spending by category |
| GET | `/api/stats/monthly?months=6` | Income vs expense per month |

## Screenshots

**Dark mode**

![Dashboard in dark mode](docs/screenshots/dashboard-dark.png)

| Transactions | Budgets |
|---|---|
| ![Transactions](docs/screenshots/transactions.png) | ![Budgets](docs/screenshots/budgets.png) |

## Roadmap

- [ ] CSV import for bank statements
- [ ] Recurring transactions (rent, subscriptions)
- [ ] Auto-categorisation from transaction notes (e.g. "Swiggy" → Food)
- [ ] Ask questions about your spending in plain English

## Author

Built by [@laskarhussainfahad](https://github.com/laskarhussainfahad).
