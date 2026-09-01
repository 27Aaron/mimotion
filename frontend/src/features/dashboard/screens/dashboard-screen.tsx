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
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeading } from "@/components/layout/section-heading";
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
    },
    {
      title: t("statActiveTasks"),
      value: data.activeScheduleCount,
      icon: ClockCheck,
      detail: t("statActiveTasksDetail", { count: data.scheduleCount }),
    },
    {
      title: t("statTodayExec"),
      value: data.todayTotal,
      icon: Footprints,
      detail: t("statTodayExecDetail", {
        success: data.todaySuccess,
        failed: todayFailed,
      }),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 sm:flex">
            <TrendingUp className="size-4 text-primary" />
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
        }
      />

      <StatsGrid items={stats} />

      <SectionHeading icon={Footprints}>{t("recentLogs")}</SectionHeading>

      <div>
        {data.recentLogs.length === 0 ? (
          <EmptyState
            icon={Footprints}
            title={t("noLogs")}
            description={t("noLogsDesc")}
          />
        ) : (
          <Card className="py-0">
            <CardContent className="flex flex-col gap-1 p-2">
              {data.recentLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50 md:gap-4 md:px-4"
                >
                  {log.status === "success" ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {log.status === "success" ? t("syncSuccess") : t("syncFailed")}
                      </span>
                      {log.stepWritten != null && (
                        <Badge variant="secondary" className="tabular-nums text-xs">
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
                  <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatShanghaiDateTime(log.executedAt, locale)}
                  </time>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
