import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { xiaomiAccounts, schedules, runLogs } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import {
  Smartphone,
  ClockCheck,
  Footprints,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTranslations, getLocale } from "next-intl/server";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");

  const [accounts, allSchedules] = await Promise.all([
    db.select().from(xiaomiAccounts).where(eq(xiaomiAccounts.userId, user.userId)),
    db.select().from(schedules).where(eq(schedules.userId, user.userId)),
  ]);

  // 查当前用户执行记录
  const scheduleIds = allSchedules.map((s) => s.id);
  const recentLogs = scheduleIds.length > 0
    ? await db
        .select()
        .from(runLogs)
        .where(inArray(runLogs.scheduleId, scheduleIds))
        .orderBy(desc(runLogs.executedAt))
        .limit(20)
    : [];

  const todayLogs = recentLogs.filter(
    (l) =>
      l.executedAt &&
      new Date(l.executedAt).toDateString() === new Date().toDateString(),
  );
  const todaySuccess = todayLogs.filter((l) => l.status === "success").length;
  const todayFailed = todayLogs.length - todaySuccess;
  const activeCount = allSchedules.filter((s) => s.isActive).length;

  const hour = new Date().getHours();
  const greeting =
    hour < 6
      ? t("greetingLateNight")
      : hour < 12
        ? t("greetingMorning")
        : hour < 18
          ? t("greetingAfternoon")
          : t("greetingEvening");

  const stats = [
    {
      title: t("statAccounts"),
      value: accounts.length,
      icon: Smartphone,
      detail: t("statAccountsDetail", { count: accounts.filter((a) => a.status === "active").length }),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t("statActiveTasks"),
      value: activeCount,
      icon: ClockCheck,
      detail: t("statActiveTasksDetail", { count: allSchedules.length }),
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: t("statTodayExec"),
      value: todayLogs.length,
      icon: Footprints,
      detail: t("statTodayExecDetail", { success: todaySuccess, failed: todayFailed }),
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* 欢迎头部 */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {greeting}，{user.username}
            {activeCount > 0
              ? ` · ${t("tasksRunning", { count: activeCount })}`
              : ` · ${t("noRunningTasks")}`}
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border bg-background/80 backdrop-blur-sm px-3 py-2 sm:flex">
          <TrendingUp className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("todaySuccessRate")}</p>
            <p className="text-sm font-semibold">
              {todayLogs.length > 0
                ? Math.round((todaySuccess / todayLogs.length) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
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

      {/* 空态引导 */}
      {accounts.length === 0 && (
        <Card className="mb-3 border-dashed">
          <CardContent className="empty-state">
            <div className="empty-icon">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t("gettingStarted")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("gettingStartedDesc")}
              </p>
            </div>
            <div className="fade-divider max-w-[200px]" />
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
      )}

      {/* 最近执行 */}
      <div className="-mt-3 flex items-center gap-2">
        <div className="section-icon">
          <Footprints className="h-3 w-3 text-primary" />
        </div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("recentLogs")}
        </h2>
        <div className="ml-2 h-px flex-1 bg-border" />
        {recentLogs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("recentCount", { count: recentLogs.length })}
          </span>
        )}
      </div>

      <div className="mt-3">
        {recentLogs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="empty-state py-12">
              <div className="empty-icon">
                <Footprints className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t("noLogs")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("noLogsDesc")}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-glow relative overflow-hidden">
            <div className="flex flex-col">
              {recentLogs.slice(0, 10).map((log, i) => (
                <div key={log.id}>
                  {i > 0 && <div className="fade-divider" />}
                  <div className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {log.status === "success" ? t("syncSuccess") : t("syncFailed")}
                        </span>
                        {log.stepWritten && (
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {tc("steps", { count: Number(log.stepWritten).toLocaleString() })}
                          </Badge>
                        )}
                      </div>
                      {log.errorMessage && (
                        <p className="mt-0.5 text-xs text-destructive/80 truncate">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                    <time className="flex-shrink-0 font-mono text-xs text-muted-foreground">
                      {log.executedAt
                        ? new Date(log.executedAt).toLocaleString(locale, {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
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
