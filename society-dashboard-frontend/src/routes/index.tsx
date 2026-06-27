import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, ComponentType } from "react";
import {
  Bell,
  Search,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  Plus,
  Send,
  Download,
  Receipt,
  Zap,
  Sprout,
  Sparkles,
  MoreHorizontal,
  ChevronDown,
  CalendarDays,
  Clock,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type Status = "Paid" | "Pending" | "Overdue";

type House = { id: string; owner: string; due: number; paid: number; status: Status };
type Expense = {
  name: string;
  value: number;
  color: string;
  icon: ComponentType<{ className?: string }>;
};
type Transaction = { id: number; label: string; amount: number; type: "in" | "out"; date: string };
type Reminder = { id: number; owner: string; amount: number; due: string };

type SocietyInfo = {
  SocietyName?: string;
  Block?: string;
  TotalHouses?: number;
  TotalCollected?: number;
  TotalExpenses?: number;
  BalanceLeft?: number;
};

type Summary = {
  totalCollection?: number;
  totalExpenses?: number;
  balanceLeft?: number;
  collectionRate?: number;
};

type DashboardData = {
  societyInfo?: SocietyInfo;
  summary?: Summary;
  houses?: House[];
  expenses?: Expense[];
  transactions?: Transaction[];
  reminders?: Reminder[];
  // alternate keys from API
  housesPaymentStatus?: unknown;
  recentTransactions?: unknown;
  expenseBreakdown?: unknown;
  upcomingMaintenanceDue?: unknown;
  // allow extra fields like stats
  [k: string]: unknown;
};

const houses: { id: string; owner: string; due: number; paid: number; status: Status }[] = [
  { id: "A1", owner: "Sharma", due: 1500, paid: 1500, status: "Paid" },
  { id: "A2", owner: "Verma", due: 1500, paid: 0, status: "Pending" },
  { id: "A3", owner: "Patel", due: 1500, paid: 1500, status: "Paid" },
  { id: "A4", owner: "Iyer", due: 1500, paid: 750, status: "Pending" },
  { id: "B1", owner: "Khan", due: 1500, paid: 1500, status: "Paid" },
  { id: "B2", owner: "Mehta", due: 1500, paid: 0, status: "Overdue" },
  { id: "B3", owner: "Reddy", due: 1500, paid: 1500, status: "Paid" },
  { id: "B4", owner: "Nair", due: 1500, paid: 1500, status: "Paid" },
];

const expenses = [
  { name: "Electricity", value: 15000, color: "oklch(0.7 0.14 230)", icon: Zap },
  { name: "Gardening", value: 8000, color: "oklch(0.7 0.16 155)", icon: Sprout },
  { name: "Housekeeping", value: 7000, color: "oklch(0.65 0.18 290)", icon: Sparkles },
  { name: "Others", value: 2500, color: "oklch(0.8 0.16 80)", icon: MoreHorizontal },
];

const transactions = [
  { id: 1, label: "Sharma — Maintenance", amount: 1500, type: "in", date: "Today" },
  { id: 2, label: "Electricity Bill", amount: -4200, type: "out", date: "Yesterday" },
  { id: 3, label: "Patel — Maintenance", amount: 1500, type: "in", date: "2d ago" },
  { id: 4, label: "Gardener — Salary", amount: -2000, type: "out", date: "3d ago" },
];

const reminders = [
  { id: 1, owner: "Verma (A2)", amount: 1500, due: "May 15" },
  { id: 2, owner: "Mehta (B2)", amount: 1500, due: "May 10 — Overdue" },
  { id: 3, owner: "Iyer (A4)", amount: 750, due: "May 18" },
];

function Dashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | Status>("All");

  // month/year selection (0-11 for month)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Remote dashboard data (fetched from Apps Script). If null, UI falls back to
  // the static sample arrays defined above (houses, expenses, transactions, reminders).
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Helpers to parse and render values safely
  const parseNumber = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v as any);
    return Number.isNaN(n) ? undefined : n;
  };

  const fmtCurrencyOrNovalue = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "N/A";
    if (typeof v === "number") return `₹${v.toLocaleString()}`;
    const n = Number(v as any);
    return Number.isNaN(n) ? "N/A" : `₹${n.toLocaleString()}`;
  };

  const fmtNumberOrNovalue = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "N/A";
    if (typeof v === "number") return v;
    const n = Number(v as any);
    return Number.isNaN(n) ? "N/A" : n;
  };

  const normalizeStatus = (s: unknown): Status => {
    if (typeof s !== "string") return "Pending";
    const up = s.trim().toLowerCase();
    if (up === "paid") return "Paid";
    if (up === "overdue") return "Overdue";
    return "Pending";
  };

  // Normalize incoming API data into the shapes used by the UI. If any key is
  // missing, fall back to the mock values or to NOVALUE where appropriate.
  const normalized = useMemo(() => {
    const sd = (dashboardData ?? {}) as any;

    // Accept data either nested under `societyInfo`/`summary` or as root-level keys
    const societyInfoFromRoot: SocietyInfo = {
      SocietyName: sd.SocietyName ?? sd.societyName ?? sd.societyInfo?.SocietyName,
      Block: sd.Block ?? sd.block ?? sd.societyInfo?.Block,
      TotalHouses: (sd.TotalHouses ?? sd.totalHouses ?? sd.societyInfo?.TotalHouses) as number | undefined,
      TotalCollected: (sd.TotalCollected ?? sd.totalCollected ?? sd.societyInfo?.TotalCollected) as number | undefined,
      TotalExpenses: (sd.TotalExpenses ?? sd.totalExpenses ?? sd.societyInfo?.TotalExpenses) as number | undefined,
      BalanceLeft: (sd.BalanceLeft ?? sd.balanceLeft ?? sd.societyInfo?.BalanceLeft) as number | undefined,
    };

    const societyInfo = sd.societyInfo ?? societyInfoFromRoot;

    const summaryFromRoot: Summary = {
      totalCollection: parseNumber(sd.summary?.totalCollection ?? sd.totalCollection ?? sd.TotalCollected),
      totalExpenses: parseNumber(sd.summary?.totalExpenses ?? sd.totalExpenses ?? sd.TotalExpenses),
      balanceLeft: parseNumber(sd.summary?.balanceLeft ?? sd.balanceLeft ?? sd.BalanceLeft),
      collectionRate: parseNumber(sd.summary?.collectionRate ?? sd.collectionRate ?? sd.collectionRatePercent),
    };

    const summary = sd.summary ?? summaryFromRoot;

    const housesFromApi = (sd.housesPaymentStatus as any[] | undefined) ?? (sd.houses as any[] | undefined) ?? undefined;
    const housesMapped: House[] = housesFromApi
      ? housesFromApi.map((h: any, idx: number) => ({
          id: (h.id ?? h.houseId ?? `H${idx + 1}`).toString().trim(),
          owner: (h.owner ?? h.Owner ?? "N/A").toString().trim(),
          due: typeof h.due === "number" ? h.due : typeof h.dueAmount === "number" ? h.dueAmount : Number(h.due) || Number(h.dueAmount) || 0,
          paid: typeof h.paid === "number" ? h.paid : typeof h.paidAmount === "number" ? h.paidAmount : Number(h.paid) || Number(h.paidAmount) || 0,
          status: normalizeStatus(h.status ?? h.Status),
        }))
      : [];

    const txFromApi = (sd.recentTransactions as any[] | undefined) ?? (sd.transactions as any[] | undefined) ?? undefined;
    const txMapped: Transaction[] = txFromApi
      ? txFromApi.map((t: any, idx: number) => ({
          id: typeof t.id === 'number' ? t.id : idx + 1,
          label: (t.label ?? `${t.houseOwner ?? ''} ${t.activity ?? ''}`).toString().trim() || 'N/A',
          amount: typeof t.amount === 'number' ? t.amount : Number(t.amount) || 0,
          type: t.type === 'in' || t.type === 'income' ? 'in' : 'out',
          date: t.date ? t.date.toString() : 'N/A',
        }))
      : [];

    const expFromApi = (sd.expenseBreakdown as any[] | undefined) ?? (sd.expenses as any[] | undefined) ?? undefined;
    const colorMap: Record<string, string> = {
      Electricity: 'oklch(0.7 0.14 230)',
      Gardening: 'oklch(0.7 0.16 155)',
      Housekeeping: 'oklch(0.65 0.18 290)',
      Others: 'oklch(0.8 0.16 80)',
    };
    const iconMap: Record<string, any> = {
      Electricity: Zap,
      Gardening: Sprout,
      Housekeeping: Sparkles,
      Others: MoreHorizontal,
    };

    const expMapped: Expense[] = expFromApi
      ? expFromApi.map((e: any) => ({
          name: e.name ?? e.category ?? 'N/A',
          value: typeof e.value === 'number' ? e.value : typeof e.amount === 'number' ? e.amount : Number(e.value) || Number(e.amount) || 0,
          color: colorMap[e.name ?? e.category] ?? e.color ?? 'oklch(0.7 0.14 230)',
          icon: iconMap[e.name ?? e.category] ?? Zap,
        }))
      : [];

    const remFromApi = (sd.upcomingMaintenanceDue as any[] | undefined) ?? (sd.reminders as any[] | undefined) ?? undefined;
    const remMapped: Reminder[] = remFromApi
      ? remFromApi.map((r: any, idx: number) => ({
          id: typeof r.id === 'number' ? r.id : idx + 1,
          owner: r.owner ?? 'N/A',
          amount: typeof r.amount === 'number' ? r.amount : Number(r.amount) || 0,
          due: r.due ?? r.dueDate ?? 'N/A',
        }))
      : [];

    return {
      societyInfo,
      summary,
      housesMapped,
      txMapped,
      expMapped,
      remMapped,
    };
  }, [dashboardData]);

  // Use normalized values (prefer API values, fallback to existing mocks)
  const housesSource = normalized.housesMapped;
  const expensesSource = normalized.expMapped;
  const transactionsSource = normalized.txMapped;
  const remindersSource = normalized.remMapped;

  useEffect(() => {
    const fetchDashboardData = async () => {
      setDataLoading(true);
      try {
        const env = (import.meta as unknown as { env?: { VITE_BACKEND_URL?: string } }).env;
        const backendUrl = env?.VITE_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

        const [summaryRes, housesRes, expensesRes, transactionsRes] = await Promise.all([
          fetch(`${backendUrl}/api/dashboard/summary`, { method: "GET", mode: "cors", credentials: "omit" }),
          fetch(`${backendUrl}/api/houses`, { method: "GET", mode: "cors", credentials: "omit" }),
          fetch(`${backendUrl}/api/expenses/breakdown`, { method: "GET", mode: "cors", credentials: "omit" }),
          fetch(`${backendUrl}/api/transactions/recent`, { method: "GET", mode: "cors", credentials: "omit" }),
        ]);

        const errors = [
          !summaryRes.ok && `summary ${summaryRes.status}`,
          !housesRes.ok && `houses ${housesRes.status}`,
          !expensesRes.ok && `expenses ${expensesRes.status}`,
          !transactionsRes.ok && `transactions ${transactionsRes.status}`,
        ].filter(Boolean);

        if (errors.length) {
          throw new Error(`Dashboard fetch failed: ${errors.join(", ")}`);
        }

        const [summaryJson, housesJson, expensesJson, transactionsJson] = await Promise.all([
          summaryRes.json(),
          housesRes.json(),
          expensesRes.json(),
          transactionsRes.json(),
        ]);

        console.debug("Dashboard data loaded", {
          summaryJson,
          housesJson,
          expensesJson,
          transactionsJson,
        });

        setDashboardData({
          ...summaryJson,
          housesPaymentStatus: Array.isArray(housesJson) ? housesJson : undefined,
          expenseBreakdown: Array.isArray(expensesJson) ? expensesJson : undefined,
          recentTransactions: Array.isArray(transactionsJson) ? transactionsJson : undefined,
        } as DashboardData);
        setDataError(null);
      } catch (err: unknown) {
        console.error("Fetch dashboard data error:", err);
        const message = err instanceof Error ? err.message : String(err);
        setDataError(message);
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedMonth, selectedYear]);

  // Data sources are provided by the normalized object above (housesSource, expensesSource, etc.)
  // to prefer API values and fall back to mocks.

  const filtered: House[] = useMemo(
    () =>
      housesSource.filter(
        (h: House) =>
          (filter === "All" || h.status === filter) &&
          (h.id.toLowerCase().includes(search.toLowerCase()) ||
            h.owner.toLowerCase().includes(search.toLowerCase())),
      ),
    [search, filter, housesSource],
  );

  const totalExpenses = expensesSource.reduce((s: number, e: Expense) => s + (e.value || 0), 0);
  // Prefer server-provided total if present
  const serverTotalExpenses = typeof normalized.summary?.totalExpenses === "number" ? normalized.summary.totalExpenses : undefined;
  const displayedTotalExpenses = serverTotalExpenses ?? totalExpenses;
  // If we're loading the API data for the first time, render a loading placeholder
  // to avoid flashing NOVALUE before the API response arrives.
  if (dataLoading && !dashboardData) {
    return (
      <div className="min-h-screen bg-background">
        <Header societyInfo={undefined} />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="animate-pulse">
              <div className="h-6 w-1/3 rounded bg-muted mb-4" />
              <div className="h-6 w-1/4 rounded bg-muted mb-2" />
              <div className="h-4 w-full rounded bg-muted/80 mt-4" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        societyInfo={normalized.societyInfo}
        month={selectedMonth}
        year={selectedYear}
        onPrev={() => {
          setSelectedMonth((m) => {
            if (m === 0) {
              setSelectedYear((y) => y - 1);
              return 11;
            }
            return m - 1;
          });
        }}
        onNext={() => {
          setSelectedMonth((m) => {
            if (m === 11) {
              setSelectedYear((y) => y + 1);
              return 0;
            }
            return m + 1;
          });
        }}
          onSelectMonthYear={(m: number, y: number) => {
            setSelectedMonth(m);
            setSelectedYear(y);
          }}
          loading={dataLoading}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Stat cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Wallet className="h-5 w-5" />}
            title="Total Collection"
            value={fmtCurrencyOrNovalue(normalized.societyInfo?.TotalCollected ?? normalized.summary?.totalCollection)}
            trend=""
            tone="success"
          />
          <StatCard
            icon={<Receipt className="h-5 w-5" />}
            title="Total Expenses"
            value={fmtCurrencyOrNovalue(normalized.societyInfo?.TotalExpenses ?? normalized.summary?.totalExpenses)}
            trend="+4.2% vs last month"
            tone="destructive"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Balance Left"
            value={fmtCurrencyOrNovalue(normalized.societyInfo?.BalanceLeft ?? normalized.summary?.balanceLeft)}
            trend="Healthy reserves"
            tone="info"
          />
          <StatCard
            icon={<Target className="h-5 w-5" />}
            title="Collection Rate"
            value={
              (typeof normalized.summary?.collectionRate === 'number'
                ? `${normalized.summary.collectionRate}%`
                : (normalized.societyInfo?.TotalHouses ? `${((Number(normalized.societyInfo?.TotalCollected || 0) / (Number(normalized.societyInfo?.TotalHouses || 1) * 1500) * 100)).toFixed(1)}%` : 'NOVALUE'))
            }
            trend="30 / 30 houses"
            tone="primary"
            ring={100}
          />
        </section>

        {/* Quick actions */}
        <section className="mt-6 flex flex-wrap gap-3">
          <QuickAction icon={<Plus className="h-4 w-4" />} label="Add Expense" />
          <QuickAction icon={<Wallet className="h-4 w-4" />} label="Add Payment" />
          <QuickAction icon={<Send className="h-4 w-4" />} label="Send Reminder" />
          <QuickAction icon={<Download className="h-4 w-4" />} label="Download Report" />
        </section>

        {/* Main grid */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Houses table */}
          <Card className="lg:col-span-2">
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Houses Payment Status</h2>
                <p className="text-sm text-muted-foreground">Track maintenance dues per house</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search house or owner"
                    className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-64"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as typeof filter)}
                    className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option>All</option>
                    <option>Paid</option>
                    <option>Pending</option>
                    <option>Overdue</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">House</th>
                    <th className="px-5 py-3 font-medium">Owner</th>
                    <th className="px-5 py-3 font-medium">Due</th>
                    <th className="px-5 py-3 font-medium">Paid</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => (
                    <tr key={h.id} className="border-t border-border transition hover:bg-muted/40">
                      <td className="px-5 py-3.5 font-medium text-foreground">{h.id ?? 'N/A'}</td>
                      <td className="px-5 py-3.5 text-foreground">{h.owner ?? 'N/A'}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {fmtCurrencyOrNovalue(h.due)}
                      </td>
                      <td className="px-5 py-3.5 text-foreground">{fmtCurrencyOrNovalue(h.paid)}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={h.status} />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-sm text-muted-foreground"
                      >
                        No houses match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
              <span>
                Showing {filtered.length} of {housesSource.length}
              </span>
              <div className="flex gap-1">
                <PageBtn>Prev</PageBtn>
                <PageBtn active>1</PageBtn>
                <PageBtn>2</PageBtn>
                <PageBtn>3</PageBtn>
                <PageBtn>Next</PageBtn>
              </div>
            </div>
          </Card>

          {/* Right: Expense breakdown */}
          <div className="flex flex-col gap-6">
            <Card>
              <div className="border-b border-border p-5">
                <h2 className="text-lg font-semibold text-foreground">Expense Breakdown</h2>
                <p className="text-sm text-muted-foreground">
                  {fmtCurrencyOrNovalue(displayedTotalExpenses)} total this month
                </p>
              </div>
              <div className="space-y-4 p-5">
                {expensesSource.map((e: Expense) => {
                  const pct = totalExpenses > 0 ? Math.round((e.value / totalExpenses) * 100) : 0;
                  const Icon = e.icon;
                  return (
                    <div key={e.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-foreground">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md"
                            style={{
                              background: `color-mix(in oklab, ${e.color} 18%, transparent)`,
                              color: e.color,
                            }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-medium">{e.name}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {fmtCurrencyOrNovalue(e.value)} <span className="ml-1 text-xs">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${pct}%`, background: e.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="border-b border-border p-5">
                <h2 className="text-lg font-semibold text-foreground">Expense by Category</h2>
                <p className="text-sm text-muted-foreground">Distribution overview</p>
              </div>
              <div className="h-64 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesSource}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {expensesSource.map((e: Expense) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(v) => `₹${Number(v).toLocaleString()}`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </section>

        {/* Bottom: transactions + reminders */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
                <p className="text-sm text-muted-foreground">Latest activity</p>
              </div>
              <button className="text-sm font-medium text-primary hover:underline">View all</button>
            </div>
            <ul className="divide-y divide-border">
              {transactionsSource.map((t: Transaction) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between px-5 py-4 transition hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        t.type === "in"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {t.type === "in" ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.label ?? 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{t.date ?? 'N/A'}</p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      t.amount > 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {t.amount > 0 ? "+" : "-"}{fmtCurrencyOrNovalue(Math.abs(t.amount))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Upcoming Maintenance Due</h2>
                <p className="text-sm text-muted-foreground">Send reminders in one click</p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <ul className="divide-y divide-border">
              {remindersSource.map((r: Reminder) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between px-5 py-4 transition hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.owner ?? 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {fmtCurrencyOrNovalue(r.amount)} • {r.due ?? 'N/A'}
                    </p>
                  </div>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary">
                    Remind
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Header({
  societyInfo,
  month,
  year,
  onPrev,
  onNext,
  onSelectMonthYear,
  loading,
}: {
  societyInfo?: SocietyInfo;
  month?: number;
  year?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onSelectMonthYear?: (m: number, y: number) => void;
  loading?: boolean;
}) {
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const displayMonth = typeof month === "number" ? MONTHS[month] : MONTHS[new Date().getMonth()];
  const displayYear = typeof year === "number" ? year : new Date().getFullYear();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground sm:text-lg">
              {societyInfo?.SocietyName ?? 'Society Management Dashboard'}
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {societyInfo?.Block ?? 'Greenwood Heights · Block A & B'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative hidden items-center gap-2 rounded-lg border border-border px-2 py-1 text-sm text-foreground transition hover:border-primary hover:text-primary sm:flex">
            <button
              onClick={onPrev}
              className="rounded px-2 py-1 text-sm hover:bg-muted"
              aria-label="Previous month"
            >
              ‹
            </button>
            <MonthPicker
              month={month}
              year={year}
              onSelect={(m: number, y: number) => onSelectMonthYear?.(m, y)}
              loading={loading}
            >
              <span className="flex items-center gap-2 px-2 text-sm cursor-pointer">
                <CalendarDays className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {displayMonth} {displayYear}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </MonthPicker>
            <button
              onClick={onNext}
              className="rounded px-2 py-1 text-sm hover:bg-muted"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <button className="relative rounded-lg border border-border p-2 text-foreground transition hover:border-primary hover:text-primary">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2 transition hover:border-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              AK
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  trend,
  tone,
  ring,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  trend: string;
  tone: "success" | "destructive" | "info" | "primary";
  ring?: number;
}) {
  const toneMap = {
    success: { bg: "bg-success/15", text: "text-success", trend: "text-success" },
    destructive: { bg: "bg-destructive/15", text: "text-destructive", trend: "text-destructive" },
    info: { bg: "bg-info/15", text: "text-info", trend: "text-info" },
    primary: { bg: "bg-primary/15", text: "text-primary", trend: "text-primary" },
  }[tone];

  return (
    <Card className="p-5 transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap.bg} ${toneMap.text}`}
        >
          {icon}
        </div>
        {ring !== undefined && (
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--muted)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeDasharray={`${ring}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
              {ring}%
            </span>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className={`mt-2 text-xs font-medium ${toneMap.trend}`}>{trend}</p>
    </Card>
  );
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="group flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary hover:bg-primary hover:text-primary-foreground">
      <span className="text-muted-foreground transition group-hover:text-primary-foreground">
        {icon}
      </span>
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map = {
    Paid: "bg-success/15 text-success",
    Pending: "bg-warning/20 text-warning-foreground",
    Overdue: "bg-destructive/15 text-destructive",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function PageBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`min-w-8 rounded-md px-2.5 py-1 text-xs font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function MonthPicker({
  month,
  year,
  onSelect,
  loading,
  children,
}: {
  month?: number;
  year?: number;
  onSelect?: (m: number, y: number) => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const [selMonth, setSelMonth] = useState<number>(month ?? new Date().getMonth());
  const [selYear, setSelYear] = useState<number>(year ?? new Date().getFullYear());

  // keep local state in sync if parent changes
  useEffect(() => {
    if (typeof month === "number") setSelMonth(month);
  }, [month]);
  useEffect(() => {
    if (typeof year === "number") setSelYear(year);
  }, [year]);

  return (
    <div className="relative">
      <div onClick={() => setOpen((s) => !s)}>{children}</div>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[260px] rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              className="rounded px-2 py-1 text-sm hover:bg-muted"
              onClick={() => setSelYear((y) => y - 1)}
            >
              -
            </button>
            <div className="text-sm font-medium">{selYear}</div>
            <button
              className="rounded px-2 py-1 text-sm hover:bg-muted"
              onClick={() => setSelYear((y) => y + 1)}
            >
              +
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {MONTHS.map((mName, idx) => (
              <button
                key={mName}
                onClick={() => setSelMonth(idx)}
                className={`rounded px-2 py-1 text-sm ${idx === selMonth ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {mName.slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded px-3 py-1 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onSelect?.(selMonth, selYear);
              }}
              className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
