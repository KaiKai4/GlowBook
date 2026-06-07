# App Router Data Access Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce high `application-code` time by using the right App Router data access pattern for each flow without changing GlowBook's modular monolith architecture.

**Architecture:** Keep the current `app -> features/use-cases -> data/domain -> Supabase` direction. Keep Server Actions for internal mutations, move interactive reads to URL-driven Server Component renders, memoize request-local auth/profile reads, and only introduce Supabase RPC/read models for heavy aggregate reads after measuring the low-risk fixes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/RLS, Vitest.

---

## Analysis Summary

### Current Problem

The slow log segment is not a file named `application-code`. In Next.js 16 dev output it is the elapsed time after framework internals finish and before the request ends. In this project that includes Server Component rendering, Server Actions, auth/session checks, Supabase reads, and view-model assembly.

Evidence:

- `src/proxy.ts` calls `supabase.auth.getUser()` on matching requests.
- `src/app/(dashboard)/layout.tsx` calls `getProfile()` and `getDashboardShell()`.
- Dashboard route `src/app/(dashboard)/page.tsx` calls `requireProfile()` and `getDashboardOverview()`.
- Calendar route `src/app/(dashboard)/appointments/page.tsx` calls `requireProfile()` and `getCalendarView()`.
- Calendar client `src/app/(dashboard)/appointments/appointments-client.tsx` calls `getCalendarViewAction()` for read-only date/view changes.
- Reports client `src/app/(dashboard)/reports/reports-view.tsx` calls `getReportAction()` for read-only filter changes, even though `src/app/(dashboard)/reports/page.tsx` already supports `searchParams`.
- `docs/performance-review-2026-06-01.md` shows staging route latency under 1s with a 100-salon scale dataset, so this should be optimized surgically, not rewritten.

### Best Option For This Project

Use a mixed strategy:

- Server Components for initial route reads.
- Server Actions only for UI-triggered mutations.
- URL `searchParams` for page-level interactive reads such as calendar date/view and report filters.
- React `cache()` for request-local auth/profile reads.
- Supabase RPC/read models only for aggregate reads that remain slow after measurement, especially dashboard/report summaries.

Rejected options:

- Do not move all reads to Route Handlers. Next's local docs warn that Server Components should fetch directly from the source because fetching a Route Handler from a Server Component adds an HTTP round trip.
- Do not use Server Actions for read fetching. Next's local docs state Server Actions are primarily for mutations and are queued, so using them for data fetching introduces sequential execution.
- Do not move sensitive reads directly to the browser unless there is a deliberate RLS-only UX reason. RLS is strong here, but the app already centralizes authorization and view-model shaping in use-cases.
- Do not change to microservices or a new global data layer. ADR 0009 and the architecture assessment show the modular monolith is the correct base.

## File Structure

Modify:

- `src/lib/auth/session.ts`: add request-local memoization for profile, active salon status, and platform admin checks.
- `src/lib/auth/session.test.ts`: verify repeated profile reads dedupe the Supabase auth/profile calls in a single render/request context.
- `src/app/(dashboard)/appointments/calendar-url.ts`: create a small URL builder for calendar date/view state.
- `src/app/(dashboard)/appointments/calendar-url.test.ts`: test calendar URL state generation.
- `src/app/(dashboard)/appointments/appointments-client.tsx`: replace read-only Server Action usage with URL navigation.
- `src/app/(dashboard)/appointments/actions.ts`: remove `getCalendarViewAction`; keep mutation actions.
- `src/app/(dashboard)/reports/report-url.ts`: create a small URL builder for report preset/custom date state.
- `src/app/(dashboard)/reports/report-url.test.ts`: test report URL generation.
- `src/app/(dashboard)/reports/reports-view.tsx`: replace read-only Server Action usage with URL navigation.
- `src/app/(dashboard)/reports/actions.ts`: delete if `getReportAction` is the only export after migration.
- `docs/performance-review-2026-06-01.md`: append the new decision and measurement notes after verification.

Optional later, only if measured route latency remains above budget:

- `supabase/migrations/<timestamp>_dashboard_overview_read_model.sql`: add a dashboard aggregate RPC/read model.
- `src/features/dashboard/data/dashboard.repo.ts`: switch aggregate reads to the RPC/read model.
- `src/features/dashboard/use-cases/get-dashboard-overview.test.ts`: keep view-model behavior stable.

---

### Task 1: Memoize Auth And Profile Reads

**Files:**

- Modify: `src/lib/auth/session.ts`
- Modify: `src/lib/auth/session.test.ts`

- [ ] **Step 1: Write the failing profile dedupe test**

Add this test to `src/lib/auth/session.test.ts` inside `describe("requireActiveProfile", ...)`:

```ts
  it("dedupes repeated profile reads in one request context", async () => {
    const client = supabaseMock({});
    mockedCreateSupabaseServerClient.mockResolvedValue(client as never);

    const [first, second] = await Promise.all([requireActiveProfile(), requireActiveProfile()]);

    expect(first).toMatchObject({ id: "user-1", salon_id: "salon-1" });
    expect(second).toMatchObject({ id: "user-1", salon_id: "salon-1" });
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(client.from).toHaveBeenCalledWith("salons");
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- src/lib/auth/session.test.ts --run
```

Expected: the new test fails because `getProfile()` and the active salon check are not memoized.

- [ ] **Step 3: Memoize session reads with React cache**

Replace `src/lib/auth/session.ts` with this structure, preserving imports and existing behavior:

```ts
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { ProfileWithRole } from "@/types/app.types";

export const getProfile = cache(async (): Promise<ProfileWithRole | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, salon_id, role_id, is_owner, full_name, is_active, salon:salons(disabled_features), role:roles(id, name, role_permissions(permission:permissions(id, key, description)))")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  return data as unknown as ProfileWithRole;
});

const getActiveSalonStatus = cache(async (salonId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, is_active")
    .eq("id", salonId)
    .maybeSingle();

  return salon;
});

export async function requireProfile(): Promise<ProfileWithRole> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireActiveProfile(): Promise<ProfileWithRole> {
  const profile = await requireProfile();

  if (!profile.is_active) redirect("/login");

  const salon = await getActiveSalonStatus(profile.salon_id);

  if (!salon) redirect("/login");
  if (!salon.is_active) redirect("/");

  return profile;
}

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data !== null;
});

export async function requirePlatformAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) redirect("/login");
  return user.id;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npm test -- src/lib/auth/session.test.ts --run
```

Expected: all tests in `src/lib/auth/session.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "perf: dedupe server session reads"
```

---

### Task 2: Move Calendar Read State To URL Search Params

**Files:**

- Create: `src/app/(dashboard)/appointments/calendar-url.ts`
- Create: `src/app/(dashboard)/appointments/calendar-url.test.ts`
- Modify: `src/app/(dashboard)/appointments/appointments-client.tsx`
- Modify: `src/app/(dashboard)/appointments/actions.ts`

- [ ] **Step 1: Write the URL builder test**

Create `src/app/(dashboard)/appointments/calendar-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAppointmentsHref } from "./calendar-url";

describe("buildAppointmentsHref", () => {
  it("serializes date and view into the appointments route", () => {
    expect(buildAppointmentsHref({ date: "2026-06-06", view: "semanal" }))
      .toBe("/appointments?date=2026-06-06&view=semanal");
  });

  it("keeps worker view as a normal URL state", () => {
    expect(buildAppointmentsHref({ date: "2026-06-07", view: "trabajador" }))
      .toBe("/appointments?date=2026-06-07&view=trabajador");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- "src/app/(dashboard)/appointments/calendar-url.test.ts" --run
```

Expected: FAIL because `calendar-url.ts` does not exist.

- [ ] **Step 3: Implement the URL builder**

Create `src/app/(dashboard)/appointments/calendar-url.ts`:

```ts
import type { CalendarView } from "@/features/appointments/view-models";

export function buildAppointmentsHref({
  date,
  view,
}: {
  date: string;
  view: CalendarView;
}): string {
  const params = new URLSearchParams();
  params.set("date", date);
  params.set("view", view);
  return `/appointments?${params.toString()}`;
}
```

- [ ] **Step 4: Run the URL builder test and verify it passes**

Run:

```bash
npm test -- "src/app/(dashboard)/appointments/calendar-url.test.ts" --run
```

Expected: PASS.

- [ ] **Step 5: Replace the calendar read Server Action with router navigation**

Modify `src/app/(dashboard)/appointments/appointments-client.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { CalendarViewModel } from "@/features/appointments/view-models";
import { CalendarDays, Plus } from "lucide-react";
import { AppointmentsDayView } from "./appointments-day-view";
import { DateNav } from "./date-nav";
import { buildAppointmentsHref } from "./calendar-url";

export function AppointmentsClient({
  initialCalendar,
  canManage,
}: {
  initialCalendar: CalendarViewModel;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const calendar = initialCalendar;

  function changeCalendar(next: { date: string; view: CalendarViewModel["view"] }) {
    startTransition(() => {
      router.replace(buildAppointmentsHref(next));
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
            <CalendarDays className="h-6 w-6 text-brand-500" />
            Agenda
          </h1>
          <p className="mt-0.5 text-sm capitalize text-stone-500">
            {calendar.dateLabel}{" "}
            <span className="font-semibold text-brand-600">
              {calendar.activeCount} citas activas
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateNav
            date={calendar.date}
            view={calendar.view}
            showWorkerView={calendar.showWorkerView}
            loading={pending}
            onChange={changeCalendar}
          />
          {canManage && (
            <Link href="/appointments/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                Nueva cita
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className={pending ? "opacity-70 transition-opacity" : "transition-opacity"}>
        <AppointmentsDayView
          appointments={calendar.appointments}
          tz={calendar.timezone}
          canManage={canManage}
          view={calendar.view}
          weekDates={calendar.visibleWeekDates}
          employees={calendar.employees}
          businessStart={calendar.businessStart}
          businessEnd={calendar.businessEnd}
          salonName={calendar.salonName}
          cancellationTemplate={calendar.cancellationTemplate}
          paymentMethodOptions={calendar.paymentMethodOptions}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Remove the read-only calendar action**

In `src/app/(dashboard)/appointments/actions.ts`, delete only this export:

```ts
export async function getCalendarViewAction({
  date,
  view,
}: {
  date: string;
  view: string;
}): Promise<Result<CalendarViewModel>> {
  const profile = await requireActiveProfile();
  const canManage = hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE);
  const canView = canManage || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW);
  if (!canView) return { ok: false, error: "No tienes permiso para ver las citas." };

  const canViewAll = profile.is_owner || hasPermission(profile, PERMISSIONS.APPOINTMENTS_VIEW_ALL);

  try {
    const calendar = await getCalendarView({
      salonId: profile.salon_id,
      canViewAll,
      date,
      view,
    });
    return { ok: true, value: calendar };
  } catch {
    return { ok: false, error: "No se pudo cargar la agenda." };
  }
}
```

Then remove the now-unused imports from that file:

```ts
import { getCalendarView } from "@/features/appointments/use-cases/get-calendar-view";
import type { CalendarViewModel } from "@/features/appointments/view-models";
```

- [ ] **Step 7: Verify calendar route type-checks**

Run:

```bash
npm run type-check
```

Expected: PASS. If TypeScript reports unused imports in `actions.ts`, remove the exact unused imports it names.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/appointments/calendar-url.ts" "src/app/(dashboard)/appointments/calendar-url.test.ts" "src/app/(dashboard)/appointments/appointments-client.tsx" "src/app/(dashboard)/appointments/actions.ts"
git commit -m "perf: use URL state for calendar reads"
```

---

### Task 3: Move Reports Read State To URL Search Params

**Files:**

- Create: `src/app/(dashboard)/reports/report-url.ts`
- Create: `src/app/(dashboard)/reports/report-url.test.ts`
- Modify: `src/app/(dashboard)/reports/reports-view.tsx`
- Delete: `src/app/(dashboard)/reports/actions.ts`

- [ ] **Step 1: Write the report URL builder test**

Create `src/app/(dashboard)/reports/report-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildReportsHref } from "./report-url";

describe("buildReportsHref", () => {
  it("serializes a preset report filter", () => {
    expect(buildReportsHref({ preset: "90dias" })).toBe("/reports?preset=90dias");
  });

  it("serializes a custom date range", () => {
    expect(buildReportsHref({ from: "2026-06-01", to: "2026-06-07" }))
      .toBe("/reports?from=2026-06-01&to=2026-06-07");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- "src/app/(dashboard)/reports/report-url.test.ts" --run
```

Expected: FAIL because `report-url.ts` does not exist.

- [ ] **Step 3: Implement the report URL builder**

Create `src/app/(dashboard)/reports/report-url.ts`:

```ts
import type { ReportQueryInput } from "@/features/reports/schemas";

export function buildReportsHref(input: ReportQueryInput): string {
  const params = new URLSearchParams();

  if (input.from && input.to) {
    params.set("from", input.from);
    params.set("to", input.to);
  } else if (input.preset) {
    params.set("preset", input.preset);
  }

  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}
```

- [ ] **Step 4: Run the URL builder test and verify it passes**

Run:

```bash
npm test -- "src/app/(dashboard)/reports/report-url.test.ts" --run
```

Expected: PASS.

- [ ] **Step 5: Replace report read Server Action with router navigation**

In `src/app/(dashboard)/reports/reports-view.tsx`:

1. Replace this import:

```ts
import { useState, useTransition } from "react";
```

with:

```ts
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
```

2. Remove:

```ts
import { getReportAction } from "./actions";
```

3. Add:

```ts
import { buildReportsHref } from "./report-url";
```

4. Replace the local `report` state with route props:

```ts
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [pending, startTransition] = useTransition();

  const current: Props = {
    from,
    to,
    preset,
    revenue,
    retailRevenue,
    grossRevenue,
    discounts,
    manualExpenses,
    inventoryPurchases,
    totalExpenses,
    estimatedProfit,
    completedCount,
    totalCount,
    avgTicket,
    noShowRate,
    statusBreakdown,
    byEmployee,
    byService,
    newCustomers,
  };
```

5. Replace `goPreset` with:

```ts
  function goPreset(p: ReportPresetButton) {
    startTransition(() => {
      router.replace(buildReportsHref({ preset: p }));
    });
  }
```

6. Replace `applyCustom` with:

```ts
  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      startTransition(() => {
        router.replace(buildReportsHref({ from: customFrom, to: customTo }));
      });
    }
  }
```

7. Remove the JSX block that renders `error`, because invalid custom input is still guarded by `customFrom <= customTo`, and server-side invalid query input falls back through `parseReportFilters()`.

- [ ] **Step 6: Delete the unused read action file**

Delete `src/app/(dashboard)/reports/actions.ts` after verifying no imports remain:

```bash
rg -n "getReportAction|reports/actions" src
```

Expected: no results.

- [ ] **Step 7: Verify reports route type-checks**

Run:

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/reports/report-url.ts" "src/app/(dashboard)/reports/report-url.test.ts" "src/app/(dashboard)/reports/reports-view.tsx"
git add -u "src/app/(dashboard)/reports/actions.ts"
git commit -m "perf: use URL state for report reads"
```

---

### Task 4: Measure The Impact Before Adding RPCs

**Files:**

- Modify: `docs/performance-review-2026-06-01.md`

- [ ] **Step 1: Run unit and type verification**

Run:

```bash
npm test -- "src/app/(dashboard)/appointments/calendar-url.test.ts" "src/app/(dashboard)/reports/report-url.test.ts" src/lib/auth/session.test.ts --run
npm run type-check
```

Expected: all tests pass and TypeScript passes.

- [ ] **Step 2: Run full CI gate**

Run:

```bash
npm run ci:verify
```

Expected:

```text
npm run lint
npm run type-check
npm run test
npm run build
```

All gates pass.

- [ ] **Step 3: Measure local dev behavior**

Run:

```bash
npm run dev
```

Manual measurement:

1. Open `/appointments`.
2. Change date.
3. Change view.
4. Open `/reports`.
5. Change preset.
6. Apply a custom date range.

Expected:

- Calendar date/view changes log as route navigations with query strings, not `POST /appointments` Server Action reads.
- Reports filter changes log as route navigations with query strings, not `POST /reports` Server Action reads.
- Mutations such as creating/canceling/completing appointments still use Server Actions.

- [ ] **Step 4: Append the decision to the performance review**

Append this section to `docs/performance-review-2026-06-01.md`:

```md
## App Router Data Access Decision - 2026-06-07

Decision:

- Keep Server Actions for mutations.
- Move read-only interactive flows to URL search params and Server Component reads.
- Memoize request-local auth/profile reads with React cache.
- Defer dashboard/report RPC read models until after measuring the low-risk changes.

Reason:

Next.js 16 documents Server Actions as mutation-oriented and queued. Calendar and report filter changes were read-only Server Actions, so they added POST Server Function work to flows that already had route-level Server Component reads. URL state keeps those reads shareable, navigable and aligned with App Router.

Verification:

- Calendar date/view changes no longer call `getCalendarViewAction`.
- Report filter changes no longer call `getReportAction`.
- `npm run ci:verify` passed.
```

- [ ] **Step 5: Commit**

```bash
git add docs/performance-review-2026-06-01.md
git commit -m "docs: record app router data access decision"
```

---

### Task 5: Add Dashboard RPC Read Model Only If Measurements Still Fail

**Files:**

- Create: `supabase/migrations/20260607000000_dashboard_overview_read_model.sql`
- Modify: `src/features/dashboard/data/dashboard.repo.ts`
- Modify: `src/features/dashboard/use-cases/get-dashboard-overview.test.ts`
- Modify: `src/types/database.types.ts` after regenerating types

Do this task only if, after Tasks 1-4, `/` still exceeds the agreed server duration budget in staging or Vercel logs.

- [ ] **Step 1: Record the threshold before starting**

Add this note to the active issue or implementation branch description:

```text
Proceeding with dashboard RPC because / remains above 800ms p95 function duration in staging after URL-state and session-dedupe changes.
```

- [ ] **Step 2: Create the RPC migration**

Create `supabase/migrations/20260607000000_dashboard_overview_read_model.sql`:

```sql
create or replace function public.dashboard_overview_read_model(
  p_salon_id uuid,
  p_today_start timestamptz,
  p_today_end timestamptz,
  p_month_start timestamptz,
  p_chart_start timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with today_appointments as (
    select count(*)::int as total
    from appointments
    where salon_id = p_salon_id
      and start_time >= p_today_start
      and start_time <= p_today_end
  ),
  month_appointments as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'total_price', total_price,
      'status', status
    )), '[]'::jsonb) as rows
    from appointments
    where salon_id = p_salon_id
      and status = 'completed'
      and start_time >= p_month_start
  ),
  monthly_completed as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'start_time', start_time
    )), '[]'::jsonb) as rows
    from appointments
    where salon_id = p_salon_id
      and status = 'completed'
      and start_time >= p_chart_start
  ),
  customer_count as (
    select count(*)::int as total
    from customers
    where salon_id = p_salon_id
      and is_active = true
  ),
  booked_services as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'service', jsonb_build_object('name', services.name),
      'appointment', jsonb_build_object('status', appointments.status)
    )), '[]'::jsonb) as rows
    from appointment_items
    join services on services.id = appointment_items.service_id
    join appointments on appointments.id = appointment_items.appointment_id
    where appointment_items.salon_id = p_salon_id
      and appointment_items.start_time >= p_month_start
  )
  select jsonb_build_object(
    'todayAppointments', (select total from today_appointments),
    'monthAppointments', (select rows from month_appointments),
    'monthlyCompletedAppointments', (select rows from monthly_completed),
    'totalCustomers', (select total from customer_count),
    'bookedServices', (select rows from booked_services)
  );
$$;
```

- [ ] **Step 3: Update generated database types**

Run:

```bash
npm run db:types
```

Expected: `src/types/database.types.ts` includes `dashboard_overview_read_model`.

- [ ] **Step 4: Switch the dashboard repo to the RPC**

In `src/features/dashboard/data/dashboard.repo.ts`, replace the body of `findDashboardReportRows()` with:

```ts
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("dashboard_overview_read_model", {
    p_salon_id: salonId,
    p_today_start: todayStart,
    p_today_end: todayEnd,
    p_month_start: monthStart,
    p_chart_start: chartStart,
  });

  if (error) throw error;

  const payload = data as unknown as {
    todayAppointments?: number;
    monthAppointments?: DashboardMonthAppointmentRow[];
    monthlyCompletedAppointments?: DashboardMonthlyCompletedAppointmentRow[];
    totalCustomers?: number;
    bookedServices?: DashboardBookedServiceRow[];
  } | null;

  return {
    todayAppointments: payload?.todayAppointments ?? 0,
    monthAppointments: payload?.monthAppointments ?? [],
    monthlyCompletedAppointments: payload?.monthlyCompletedAppointments ?? [],
    totalCustomers: payload?.totalCustomers ?? 0,
    bookedServices: payload?.bookedServices ?? [],
  };
```

- [ ] **Step 5: Run dashboard tests**

Run:

```bash
npm test -- src/features/dashboard/use-cases/get-dashboard-overview.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Validate migrations and build**

Run:

```bash
npm run type-check
npm run build
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260607000000_dashboard_overview_read_model.sql src/features/dashboard/data/dashboard.repo.ts src/features/dashboard/use-cases/get-dashboard-overview.test.ts src/types/database.types.ts
git commit -m "perf: add dashboard overview read model"
```

---

## Self-Review

Spec coverage:

- Analyzes the whole project at the relevant architectural layer: App Router delivery, feature use-cases, Supabase Adapters, RLS, performance docs, and existing ADR direction.
- Determines the best option: mixed App Router data access, not a single replacement for Server Actions.
- Provides an implementation path to resolve the observed `application-code` problem without a rewrite.
- Keeps Server Actions for mutations.
- Moves read-only interactive flows away from Server Actions.
- Defers RPC work until measurement justifies it.

Placeholder scan:

- No task uses TBD or open-ended "add appropriate" steps.
- Each code-changing task lists concrete files and code.
- Verification commands and expected outcomes are included.

Type consistency:

- Calendar URL builder uses `CalendarView`.
- Report URL builder uses `ReportQueryInput`.
- Dashboard read model maps to existing `DashboardReportRows` types.
