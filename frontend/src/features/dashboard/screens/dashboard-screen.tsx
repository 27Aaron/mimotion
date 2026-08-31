import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ClockCheck,
  Footprints,
  Smartphone,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "@/platform/i18n";

import { StatsGrid } from "@/components/dashboard/stats-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatShanghaiDateTime } from "@/lib/time/format";

interface DashboardData {
  accountCount: number;
  activeAccountCount: number;
  scheduleCount: number;
  activeScheduleCount: number;
  todayTotal: number;
  todaySuccess: number;
  recentLogs: Array<{
    id: string;
    executedAt: string;
    stepWritten: number | null;
    status: string | null;
    errorMessage: string | null;
  }>;
}

export default function DashboardScreen() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => setData(value))
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        {tc("loading")}
      </div>
    );
  }

  const todayFailed = data.todayTotal - data.todaySuccess;
  const stats = [
    {
      title: t("statAccounts"),
      value: data.accountCount,
      icon: Smartphone,
      detail: t("statAccountsDetail", { count: data.activeAccountCount }),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t("statActiveTasks"),
      value: data.activeScheduleCount,
      icon: ClockCheck,
      detail: t("statActiveTasksDetail", { count: data.scheduleCount }),
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: t("statTodayExec"),
      value: data.todayTotal,
      icon: Footprints,
      detail: t("statTodayExecDetail", {
        success: data.todaySuccess,
        failed: todayFailed,
      }),
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("description")}</p>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 backdrop-blur-sm sm:flex">
          <TrendingUp className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("todaySuccessRate")}</p>
            <p className="text-sm font-semibold">
              {data.todayTotal > 0
                ? Math.round((data.todaySuccess / data.todayTotal) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      <StatsGrid items={stats} cardClassName="card-glow relative overflow-hidden" />

      <div className="flex items-center gap-2">
        <div className="section-icon">
          <Footprints className="h-3 w-3 text-primary" />
        </div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("recentLogs")}
        </h2>
        <div className="ml-2 h-px flex-1 bg-border" />
      </div>

      <div className="mt-3">
        {data.recentLogs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="empty-state py-12">
              <div className="empty-icon">
                <Footprints className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t("noLogs")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("noLogsDesc")}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-glow relative overflow-hidden">
            <div className="flex flex-col">
              {data.recentLogs.slice(0, 10).map((log, index) => (
                <div key={log.id}>
                  {index > 0 && <div className="fade-divider" />}
                  <div className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 md:gap-4 md:px-5">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {log.status === "success" ? t("syncSuccess") : t("syncFailed")}
                        </span>
                        {log.stepWritten != null && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {tc("steps", {
                              count: log.stepWritten.toLocaleString(),
                            })}
                          </Badge>
                        )}
                      </div>
                      {log.errorMessage && (
                        <p className="mt-0.5 truncate text-xs text-destructive/80">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                    <time className="shrink-0 font-mono text-[10px] text-muted-foreground sm:text-xs">
                      {formatShanghaiDateTime(log.executedAt, locale)}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
