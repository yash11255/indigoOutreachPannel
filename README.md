# Indigo GWF Outreach Dashboard

A web app that replaces the manual `Indigo_GWF_Outreach_Tracker.xlsx` workflow. Team members log
in, create outreach leads with a planned date, and move them to execution once the activity
happens. Admins get a cross-team view of every lead plus an upcoming-events calendar.

Stack: Next.js 16 (App Router) + Supabase (Postgres + Auth, free tier).

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project (free tier).
2. Once it's provisioned, open **Project Settings -> API**. You'll need:
   - **Project URL**
   - **anon public** key
   - **service_role** key (keep this secret — server-only)

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the three values from step 1.

## 3. Set up the database schema

Open the Supabase project's **SQL Editor** and run, in order:

1. `supabase/migrations/0001_schema.sql` — tables, triggers, Row Level Security policies.
2. `supabase/migrations/0002_seed_lookups.sql` — the 9 teams, canonical statuses, region/state
   list, and institution types (all taken from the original workbook's `Data Validation Sheet`).

## 4. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on `/login` — there is no public
sign-up, so you need at least one admin account first (next step).

## 5. Create your first admin

There's no UI for this yet since it requires an admin to already exist. In the Supabase
dashboard: **Authentication -> Users -> Add user**, create yourself with a password. Then in the
**SQL Editor**, promote that account:

```sql
update profiles set role = 'admin', team_id = null
where email = 'you@example.com';
```

Log in at `/login`. From **Admin -> Users** you can now create logins for everyone else and
assign them to a team — team members cannot self-register.

## 6. Import the existing Excel data (optional, one-time)

```bash
npm run migrate -- "/path/to/Indigo_GWF_Outreach_Tracker.xlsx"
```

This reads the original workbook and imports:

- The 9 pipeline sheets (BC_IGWF_Outreach, BC_Other Team, BC_Livelihood_Team, CB_Impact Practice,
  BC_NE_Outreach, BC_FutureTech, BC KA Outreach, CB_PCM Team, Gov Outreach & Partnerships) into
  the `leads` table.
- RTO Centers (unpivoted from its daily columns), Digital Outreach, Press, and Outreach Updates
  into `activity_log` — browsable read-only under **Admin -> Logs**.
- Activity Reference by Category into `activity_playbook` — a reference guide, also under
  **Admin -> Logs**.

It refuses to run if `leads` already has rows, to avoid double-importing. Requires
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

## How the pipeline works

Every lead has a `status` drawn from the workbook's original 11-value vocabulary (Planned,
Contact Identified, Outreach Request sent, Approval Awaited, Approved, Activity Scheduled,
Activity Completed, Rejected, No Response, Closed, Contact Details Pending). The UI derives a
5-stage view from that — **Planned / Outreach Sent / Scheduled / Completed / Stalled** — shown as
a Kanban board on `/leads`. Filling in an **Executed date** via "Move to execution" is what moves
a lead out of the Planned stage.

Team members only see and manage their own team's leads (enforced by Postgres Row Level
Security, not just the UI). Admins see everything, plus `/admin` (cross-team stats), `/admin/users`
(create and reassign logins), and `/admin/logs` (the imported read-only historical data).

## Running in Docker

A production Docker image is set up (`Dockerfile`, `docker-compose.yml`), verified working end to
end (build, container start, full login flow against the real Supabase project).

`NEXT_PUBLIC_*` variables get baked into the browser bundle at build time, not read at runtime —
so they must be passed as build args, not just container env vars, or the client bundle will have
no Supabase URL/key at all.

**Plain Docker:**

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=<your-url> \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key> \
  -t outreach-dashboard .

docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=<your-url> \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key> \
  -e SUPABASE_SERVICE_ROLE_KEY=<your-secret-key> \
  outreach-dashboard
```

**Docker Compose:** copy `.env.local` to `.env` first (Compose auto-loads `.env`, not
`.env.local`, for both build-arg substitution and the container's runtime environment), then:

```bash
cp .env.local .env
docker compose up --build
```

## Deploying

Two paths are ready:

- **Docker image** (above) — run it anywhere that runs containers: a VM, the EC2 instance from
  `infra/` (in place of the pm2/nginx steps in `infra/README.md`), ECS, etc.
- **Vercel** (free tier) pairs naturally with Supabase without Docker at all: connect the repo, add
  the same three env vars in the Vercel project settings, deploy.
