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
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ScheduleFormDialog } from "@/features/schedules/components/schedule-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
  cronSortKey,
  cronToHuman,
  DEFAULT_SCHEDULE_FORM,
  parseCron,
  type Schedule,
} from "@/features/schedules/model";
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

    if (form.days.length === 0) {
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
      </div>

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
      <StatsGrid items={stats} cardClassName="card-glow relative overflow-hidden" />

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
