import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "@/platform/i18n";
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
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StepList } from "@/components/layout/step-list";
import { ScheduleFormDialog } from "@/features/schedules/components/schedule-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cronSortKey,
  cronToHuman,
  DEFAULT_SCHEDULE_FORM,
  parseCron,
  type Schedule,
} from "@/features/schedules/model";
import { formatShanghaiDateTime } from "@/lib/time/format";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  listXiaomiAccounts,
  updateSchedule,
  type XiaomiAccountOption,
} from "@/features/schedules/client";

export default function SchedulesScreen() {
  const t = useTranslations("schedules");
  const tc = useTranslations("common");
  const locale = useLocale();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<XiaomiAccountOption[]>([]);
  const [form, setForm] = useState({ ...DEFAULT_SCHEDULE_FORM });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchAccounts();
  }, []);

  async function fetchSchedules() {
    try { setSchedules(await listSchedules()); } catch { /* surfaced by mutations */ }
  }

  async function fetchAccounts() {
    try { setAccounts(await listXiaomiAccounts()); } catch { /* surfaced by mutations */ }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.calendarMode === "weekly" && form.days.length === 0) {
      setError(t("selectAtLeastOneDay"));
      return;
    }

    setLoading(true);
    try {
      await createSchedule(form);
      setOpen(false);
      setForm({ ...DEFAULT_SCHEDULE_FORM });
      await fetchSchedules();
      toast.success(t("toastCreated"));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("createFailed"));
    } finally {
      setLoading(false);
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
      calendarMode: s.calendarMode ?? "weekly",
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
    if (form.calendarMode === "weekly" && form.days.length === 0) {
      setError(t("selectAtLeastOneDay"));
      return;
    }

    setLoading(true);
    try {
      await updateSchedule(editingId, form);
      setEditOpen(false);
      setEditingId(null);
      setForm({ ...DEFAULT_SCHEDULE_FORM });
      await fetchSchedules();
      toast.success(t("toastUpdated"));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("updateFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteSchedule(id);
      await fetchSchedules();
      toast.success(t("toastDeleted"));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("operationFailed"));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await updateSchedule(id, { isActive: !isActive });
      await fetchSchedules();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("operationFailed"));
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
    },
    {
      title: t("statRunning"),
      value: activeCount,
      icon: Activity,
      detail: activeCount > 0 ? t("statRunningDetailActive") : t("statRunningDetailEmpty"),
    },
    {
      title: t("statDailySteps"),
      value: highestSchedule
        ? `${highestSchedule.minStep.toLocaleString()}-${highestSchedule.maxStep.toLocaleString()}`
        : "0",
      icon: Zap,
      detail: t("statDailyStepsDetail"),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <ScheduleFormDialog
            mode="create"
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) {
                setForm({ ...DEFAULT_SCHEDULE_FORM });
                setError("");
              }
            }}
            onSubmit={handleAdd}
            form={form}
            onFormChange={setForm}
            accounts={accounts}
            error={error}
            loading={loading}
          />
        }
      />

      <ScheduleFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);
          if (!nextOpen) {
            setForm({ ...DEFAULT_SCHEDULE_FORM });
            setError("");
          }
        }}
        onSubmit={handleSaveEdit}
        form={form}
        onFormChange={setForm}
        accounts={accounts}
        error={error}
        loading={loading}
      />

      {/* Stats overview */}
      <StatsGrid items={stats} />

      {/* Task cards */}
      {schedules.length === 0 ? (
        <EmptyState
          icon={Timer}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        >
          <StepList steps={[t("step1"), t("step2"), t("step3")]} />
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...schedules]
            .sort((a, b) => cronSortKey(a.cronExpression) - cronSortKey(b.cronExpression))
            .map((s) => (
              <Card key={s.id} className="gap-4">
                <CardHeader className="grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <Clock className="size-4 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <CardTitle className="truncate" title={s.accountNickname}>{s.accountNickname}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t("colAccount")}</p>
                  </div>
                  <Badge variant={s.isActive ? "default" : "secondary"}>
                    {s.isActive ? t("statusRunning") : t("statusPaused")}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="rounded-md bg-muted/50 px-3 py-3">
                    <p className="text-xs text-muted-foreground">{t("colTime")}</p>
                    <p className="mt-1 text-base font-semibold">{cronToHuman(s.cronExpression, t)}</p>
                    {s.calendarMode === "china_workday" && (
                      <Badge variant="secondary" className="mt-2">{t("calendarChinaWorkdayShort")}</Badge>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("colStepRange")}</dt>
                      <dd className="mt-1 font-mono font-semibold tabular-nums">{s.minStep.toLocaleString()}–{s.maxStep.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("colLastRun")}</dt>
                      <dd className="mt-1 text-xs tabular-nums">{formatShanghaiDateTime(s.lastRunAt, locale)}</dd>
                    </div>
                  </dl>
                </CardContent>
                <CardFooter className="mt-auto justify-end gap-1 bg-muted/20 py-2">
                  <Button variant="ghost" size="icon" onClick={() => handleToggle(s.id, s.isActive)} title={s.isActive ? t("pause") : t("start")} aria-label={`${s.isActive ? t("pause") : t("start")} ${s.accountNickname}`}>
                    {s.isActive ? <Pause className="text-muted-foreground" /> : <Play className="text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title={tc("edit")} aria-label={`${tc("edit")} ${s.accountNickname}`}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} title={tc("delete")} aria-label={`${tc("delete")} ${s.accountNickname}`}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
