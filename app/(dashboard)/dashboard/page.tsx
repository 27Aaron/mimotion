import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { xiaomiAccounts, schedules, runLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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

  const accounts = await db
    .select()
    .from(xiaomiAccounts)
    .where(eq(xiaomiAccounts.userId, user.userId));

  const allSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, user.userId));

  const recentLogs = await db
    .select()
    .from(runLogs)
    .orderBy(desc(runLogs.executedAt))
    .limit(20);

  const todayLogs = recentLogs.filter(
    (l) =>
      l.executedAt &&
      new Date(l.executedAt).toDateString() === new Date().toDateString()
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
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}，{user.username}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} 个任务正在运行，一切正常`
              : "暂无运行中的任务，去创建一个吧"}
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border bg-background px-3 py-2 sm:flex">
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

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-glow relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}
                >
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono tracking-tight">
                {stat.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            最近执行记录
          </h2>
          {recentLogs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              最近 {recentLogs.length} 条
            </p>
          )}
        </div>

        {recentLogs.length === 0 ? (
          <Card>
            <CardContent className="flex h-32 flex-col items-center justify-center text-muted-foreground">
              <Footprints className="mb-2 h-8 w-8 opacity-20" />
              <p className="text-sm">暂无执行记录</p>
              <p className="text-xs text-muted-foreground/60">
                创建定时任务后将在此显示执行结果
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-col">
              {recentLogs.slice(0, 10).map((log, i) => (
                <div key={log.id}>
                  {i > 0 && <div className="fade-divider" />}
                  <div
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
                  >
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
                          <Badge variant="secondary" className="font-mono text-xs">
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

      {/* Quick tips when empty */}
      {accounts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">开始使用</p>
              <p className="mt-1 text-sm text-muted-foreground">
                先添加一个小米账号，然后创建定时任务自动刷步
              </p>
            </div>
            <div className="fade-divider max-w-[200px]" />
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>1. 添加小米账号</span>
              <span>2. 创建定时任务</span>
              <span>3. 自动执行</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
