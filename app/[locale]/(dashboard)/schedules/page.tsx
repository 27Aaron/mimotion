"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  Trash2,
  Clock,
  Play,
  Pause,
  Pencil,
  CalendarClock,
  Activity,
  Zap,
  Timer,
} from "lucide-react";
import { IconCalendarPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Schedule {
  id: string;
  xiaomiAccountId: string;
  accountNickname: string;
  cronExpression: string;
  minStep: number;
  maxStep: number;
  isActive: boolean;
  lastRunAt: string | null;
}

function cronToHuman(cron: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  const [minute, hour, , , dow] = parts;
  const hh = hour !== "*" ? hour.padStart(2, "0") : null;
  const mm = minute !== "*" ? minute.padStart(2, "0") : "00";
  const timeStr = hh ? `${hh}:${mm}` : t("cronEveryHour");

  const DAY_KEYS = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"];

  function formatDow(d: string): string {
    if (d === "*") return t("cronEveryDay");
    if (d === "1-5") return t("cronWeekday");
    if (d === "1-6") return t("cronMonToSat");
    if (d === "0-6" || d === "0,1,2,3,4,5,6") return t("cronEveryDay");
    // Single day
    if (!d.includes(",") && !d.includes("-")) {
      return `${t("cronDayPrefix")}${t(DAY_KEYS[parseInt(d) % 7])}`;
    }
    // Multiple days
    const days: number[] = [];
    for (const seg of d.split(",")) {
      if (seg.includes("-")) {
        const [s, e] = seg.split("-").map(Number);
        for (let i = s; i <= e; i++) days.push(i);
      } else {
        days.push(parseInt(seg));
      }
    }
    // Consecutive range
    if (days.length >= 3) {
      const sorted = [...days].sort((a, b) => a - b);
      let isConsecutive = true;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) { isConsecutive = false; break; }
      }
      if (isConsecutive) {
        return `${t("cronDayPrefix")}${t(DAY_KEYS[sorted[0] % 7])} ${t("cronDayRange", { start: t(DAY_KEYS[sorted[0] % 7]), end: t(DAY_KEYS[sorted[sorted.length - 1] % 7]) })}`;
      }
    }
    // Non-consecutive
    const sorted = [...days].sort((a, b) => ((a % 7) - (b % 7)));
    return `${t("cronDayPrefix")}${sorted.map((v) => t(DAY_KEYS[v % 7])).join(", ")}`;
  }

  const dowStr = formatDow(dow);
  if (!hh) return `${dowStr}, ${t("cronEveryHourExec")}`;
  return `${dowStr} ${timeStr}`;
}

const DEFAULT_FORM = {
  xiaomiAccountId: "",
  hour: 9,
  minute: 0,
  days: ["1", "2", "3", "4", "5"] as string[],
  minStep: 1000,
  maxStep: 1500,
};

function cronSortKey(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return 0;
  const minute = parts[0] !== "*" ? parseInt(parts[0]) : 0;
  const hour = parts[1] !== "*" ? parseInt(parts[1]) : 0;
  return hour * 60 + minute;
}

export default function SchedulesPage() {
  const t = useTranslations("schedules");
  const tc = useTranslations("common");
  const locale = useLocale();

  const DAY_OPTIONS = [
    { value: "1", label: t("daysMon") },
    { value: "2", label: t("daysTue") },
    { value: "3", label: t("daysWed") },
    { value: "4", label: t("daysThu") },
    { value: "5", label: t("daysFri") },
    { value: "6", label: t("daysSat") },
    { value: "0", label: t("daysSun") },
  ];

  function parseCron(cron: string) {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return { hour: 9, minute: 0, days: ["1","2","3","4","5"] };
    const [minute, hour, , , dow] = parts;
    let days: string[];
    if (dow === "*") {
      days = DAY_OPTIONS.map((d) => d.value);
    } else if (dow.includes("-")) {
      const [start, end] = dow.split("-").map(Number);
      days = [];
      for (let i = start; i <= end; i++) days.push(String(i));
    } else {
      days = dow.split(",");
    }
    return {
      hour: hour !== "*" ? parseInt(hour) : 9,
      minute: minute !== "*" ? parseInt(minute) : 0,
      days,
    };
  }

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; nickname: string; account: string }[]>(
    [],
  );
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
    fetchAccounts();
  }, []);

  async function fetchSchedules() {
    setDataLoading(true);
    try {
      const res = await fetch("/api/schedules");
      if (res.ok) setSchedules(await res.json());
    } finally {
      setDataLoading(false);
    }
  }

  async function fetchAccounts() {
    const res = await fetch("/api/xiaomi");
    if (res.ok) setAccounts(await res.json());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.days.length === 0) {
      setError(t("selectAtLeastOneDay"));
      return;
    }

    setLoading(true);

    // Build cron expression
    const sorted = [...form.days].sort((a, b) => Number(a) - Number(b));
    let dow: string;
    if (sorted.length === 7) {
      dow = "*";
    } else if (
      sorted.length === 5 &&
      sorted.join(",") === "1,2,3,4,5"
    ) {
      dow = "1-5";
    } else {
      dow = sorted.join(",");
    }
    const cronExpression = `${form.minute} ${form.hour} * * ${dow}`;

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        xiaomiAccountId: form.xiaomiAccountId,
        cronExpression,
        minStep: form.minStep,
        maxStep: form.maxStep,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setOpen(false);
      setForm({ ...DEFAULT_FORM });
      fetchSchedules();
      toast.success(t("toastCreated"));
    } else {
      toast.error(data.error || t("createFailed"));
    }
  }

  function openEdit(s: Schedule) {
    const parsed = parseCron(s.cronExpression);
    setEditingId(s.id);
    setForm({
      xiaomiAccountId: s.xiaomiAccountId,
      hour: parsed.hour,
      minute: parsed.minute,
      days: parsed.days,
      minStep: s.minStep,
      maxStep: s.maxStep,
    });
    setError("");
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!editingId) return;
    if (form.days.length === 0) {
      setError(t("selectAtLeastOneDay"));
      return;
    }

    setLoading(true);

    const sorted = [...form.days].sort((a, b) => Number(a) - Number(b));
    let dow: string;
    if (sorted.length === 7) {
      dow = "*";
    } else if (sorted.length === 5 && sorted.join(",") === "1,2,3,4,5") {
      dow = "1-5";
    } else {
      dow = sorted.join(",");
    }
    const cronExpression = `${form.minute} ${form.hour} * * ${dow}`;

    const res = await fetch(`/api/schedules?id=${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cronExpression,
        minStep: form.minStep,
        maxStep: form.maxStep,
        xiaomiAccountId: form.xiaomiAccountId,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setEditOpen(false);
      setEditingId(null);
      setForm({ ...DEFAULT_FORM });
      fetchSchedules();
      toast.success(t("toastUpdated"));
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("updateFailed"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    fetchSchedules();
    toast.success(t("toastDeleted"));
  }

  async function handleToggle(id: string, isActive: boolean) {
    const res = await fetch(`/api/schedules?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) {
      fetchSchedules();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("operationFailed"));
    }
  }

  const activeCount = schedules.filter((s) => s.isActive).length;
  const highestSchedule = schedules.length > 0
    ? schedules.reduce((a, b) => a.maxStep >= b.maxStep ? a : b)
    : null;

  const stats = [
    {
      title: t("statTotal"),
      value: schedules.length,
      icon: CalendarClock,
      detail: t("statTotalDetail"),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t("statRunning"),
      value: activeCount,
      icon: Activity,
      detail: activeCount > 0 ? t("statRunningDetailActive") : t("statRunningDetailEmpty"),
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: t("statDailySteps"),
      value: highestSchedule
        ? `${highestSchedule.minStep.toLocaleString()}-${highestSchedule.maxStep.toLocaleString()}`
        : "0",
      icon: Zap,
      detail: t("statDailyStepsDetail"),
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  // Shared form fields for create & edit dialogs
  function renderFormFields() {
    return (
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>{t("xiaomiAccount")}</Label>
          <Select
            value={form.xiaomiAccountId}
            onValueChange={(v) =>
              setForm({ ...form, xiaomiAccountId: v ?? "" })
            }
          >
            <SelectTrigger className="w-full">
              <span className="flex-1 truncate text-left">
                {form.xiaomiAccountId
                  ? (accounts.find((a) => a.id === form.xiaomiAccountId)?.nickname ||
                     accounts.find((a) => a.id === form.xiaomiAccountId)?.account ||
                     form.xiaomiAccountId)
                  : t("selectAccount")}
              </span>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.nickname || acc.account || acc.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("executionTime")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={String(form.hour)}
              onValueChange={(v) =>
                setForm({ ...form, hour: parseInt(v ?? "0") })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {String(i).padStart(2, "0")} {t("hour")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(form.minute)}
              onValueChange={(v) =>
                setForm({ ...form, minute: parseInt(v ?? "0") })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {Array.from({ length: 60 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {String(i).padStart(2, "0")} {t("minute")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("repeatDays")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_OPTIONS.map((d) => {
              const selected = form.days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? form.days.filter((v) => v !== d.value)
                      : [...form.days, d.value];
                    setForm({ ...form, days: next });
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("minSteps")}</Label>
            <Input
              type="number"
              value={form.minStep}
              onChange={(e) =>
                setForm({ ...form, minStep: Math.max(0, parseInt(e.target.value) || 0) })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("maxSteps")}</Label>
            <Input
              type="number"
              value={form.maxStep}
              onChange={(e) =>
                setForm({ ...form, maxStep: Math.max(0, parseInt(e.target.value) || 0) })
              }
              required
            />
          </div>
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ ...DEFAULT_FORM }); setError(""); } }}>
          <DialogTrigger render={<Button />}>
            <IconCalendarPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" /> {t("createTask")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createTaskTitle")}</DialogTitle>
              <DialogDescription>
                {t("createTaskDesc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              {renderFormFields()}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? tc("creating") : tc("create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog — rendered at top level, not nested inside create dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setForm({ ...DEFAULT_FORM }); setError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTaskTitle")}</DialogTitle>
            <DialogDescription>
              {t("editTaskDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit}>
            {renderFormFields()}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? tc("saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats overview */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <Card key={stat.title} className="stat-card card-glow relative overflow-hidden">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="stat-label">
                  {stat.title}
                </CardTitle>
                <div
                  className={`stat-icon-box ${stat.bg}`}
                >
                  <stat.icon className={stat.color} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-1">
              <div className="stat-value">
                {stat.value}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stat.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task table */}
      {schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="empty-state">
            <div className="empty-icon">
              <Timer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("emptyDesc")}
              </p>
            </div>
            <div className="fade-divider max-w-[240px]" />
            <div className="flex gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  1
                </span>
                {t("step1")}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  2
                </span>
                {t("step2")}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  3
                </span>
                {t("step3")}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">{t("colStatus")}</TableHead>
                <TableHead className="text-center">{t("colAccount")}</TableHead>
                <TableHead className="text-center">{t("colTime")}</TableHead>
                <TableHead className="text-center">{t("colStepRange")}</TableHead>
                <TableHead className="text-center">{t("colLastRun")}</TableHead>
                <TableHead className="text-center w-[120px]">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...schedules]
                .sort((a, b) => cronSortKey(a.cronExpression) - cronSortKey(b.cronExpression))
                .map((s) => (
                  <TableRow key={s.id} className={!s.isActive ? "opacity-50" : ""}>
                    <TableCell className="text-center">
                      {s.isActive ? (
                        <Badge variant="default" className="text-[10px]">
                          {t("statusRunning")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("statusPaused")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {s.accountNickname}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{cronToHuman(s.cronExpression, t)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {s.minStep.toLocaleString()} - {s.maxStep.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm text-muted-foreground">
                      {s.lastRunAt
                        ? new Date(s.lastRunAt).toLocaleString(locale, {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggle(s.id, s.isActive)}
                          title={s.isActive ? t("pause") : t("start")}
                        >
                          {s.isActive ? (
                            <Pause className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Play className="h-4 w-4 text-emerald-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(s)}
                          title={tc("edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(s.id)}
                          title={tc("delete")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
