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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

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
      ? "夜深了"
      : hour < 12
        ? "早上好"
        : hour < 18
          ? "下午好"
          : "晚上好";

  const stats = [
    {
      title: "小米账号",
      value: accounts.length,
      icon: Smartphone,
      detail: `${accounts.filter((a) => a.status === "active").length} 个正常`,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "活跃任务",
      value: activeCount,
      icon: ClockCheck,
      detail: `共 ${allSchedules.length} 个任务`,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "今日执行",
      value: todayLogs.length,
      icon: Footprints,
      detail: `${todaySuccess} 成功 / ${todayFailed} 失败`,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* 欢迎头部 */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">控制台</h1>
          <p className="mt-1 text-muted-foreground">
            {greeting}，{user.username}
            {activeCount > 0
              ? ` · ${activeCount} 个任务正在运行`
              : " · 暂无运行中的任务"}
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border bg-background/80 backdrop-blur-sm px-3 py-2 sm:flex">
          <TrendingUp className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">今日成功率</p>
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
              <p className="font-medium">开始使用</p>
              <p className="mt-1 text-sm text-muted-foreground">
                先添加一个小米账号，然后创建定时任务自动刷步
              </p>
            </div>
            <div className="fade-divider max-w-[200px]" />
            <div className="flex gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  1
                </span>
                添加账号
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  2
                </span>
                创建任务
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  3
                </span>
                自动刷步
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
          最近执行记录
        </h2>
        <div className="ml-2 h-px flex-1 bg-border" />
        {recentLogs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            最近 {recentLogs.length} 条
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
                <p className="font-medium">暂无执行记录</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  创建定时任务后将在此显示执行结果
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
                          {log.status === "success" ? "同步成功" : "同步失败"}
                        </span>
                        {log.stepWritten && (
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {Number(log.stepWritten).toLocaleString()} 步
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
                        ? new Date(log.executedAt).toLocaleString("zh-CN", {
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
