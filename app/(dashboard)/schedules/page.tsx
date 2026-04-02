"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Clock,
  Play,
  Pause,
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

function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  const [, hour, , , dow] = parts;
  const hourStr = hour !== "*" ? `${hour}:00` : "每小时";
  const dowStr =
    dow === "*"
      ? "每天"
      : dow === "1-5"
        ? "工作日"
        : `周${["日", "一", "二", "三", "四", "五", "六"][parseInt(dow) % 7]}`;
  if (hour === "*") return `${dowStr}，每小时执行`;
  return `${dowStr} ${hourStr}`;
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; nickname: string }[]>(
    [],
  );
  const [form, setForm] = useState({
    xiaomiAccountId: "",
    cronExpression: "0 9 * * *",
    minStep: 1000,
    maxStep: 1500,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchAccounts();
  }, []);

  async function fetchSchedules() {
    const res = await fetch("/api/schedules");
    if (res.ok) setSchedules(await res.json());
  }

  async function fetchAccounts() {
    const res = await fetch("/api/xiaomi");
    if (res.ok) setAccounts(await res.json());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setOpen(false);
      setForm({
        xiaomiAccountId: "",
        cronExpression: "0 9 * * *",
        minStep: 1000,
        maxStep: 1500,
      });
      fetchSchedules();
      toast.success("任务创建成功");
    } else {
      toast.error(data.error || "创建失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该任务？")) return;
    await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    fetchSchedules();
    toast.success("任务已删除");
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/schedules?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchSchedules();
  }

  const activeCount = schedules.filter((s) => s.isActive).length;
  const totalMin = schedules.reduce((sum, s) => sum + s.minStep, 0);
  const totalMax = schedules.reduce((sum, s) => sum + s.maxStep, 0);

  const stats = [
    {
      title: "任务总数",
      value: schedules.length,
      icon: CalendarClock,
      detail: "已创建的刷步计划",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "运行中",
      value: activeCount,
      icon: Activity,
      detail: activeCount > 0 ? "任务正常执行中" : "暂无活跃任务",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "日步数合计",
      value: totalMin > 0 ? `${totalMin.toLocaleString()}-${totalMax.toLocaleString()}` : "0",
      icon: Zap,
      detail: "所有任务的步数范围",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="page-title">定时任务</h1>
          <p className="mt-1 text-muted-foreground">
            创建自动刷步计划，设置时间和步数范围
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button>
              <IconCalendarPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" /> 创建任务
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建定时任务</DialogTitle>
              <DialogDescription>
                设置自动刷步的时间和步数范围
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>小米账号</Label>
                  <Select
                    value={form.xiaomiAccountId}
                    onValueChange={(v) =>
                      setForm({ ...form, xiaomiAccountId: v ?? "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择账号" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cron 表达式</Label>
                  <Input
                    value={form.cronExpression}
                    onChange={(e) =>
                      setForm({ ...form, cronExpression: e.target.value })
                    }
                    placeholder="0 9 * * *"
                    required
                  />
                  <p className="font-mono text-xs text-muted-foreground">
                    例: 0 9 * * * = 每天9点 | 0 12 * * * = 每天12点
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>最小步数</Label>
                    <Input
                      type="number"
                      value={form.minStep}
                      onChange={(e) =>
                        setForm({ ...form, minStep: parseInt(e.target.value) })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>最大步数</Label>
                    <Input
                      type="number"
                      value={form.maxStep}
                      onChange={(e) =>
                        setForm({ ...form, maxStep: parseInt(e.target.value) })
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
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "创建中..." : "创建"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats overview */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-glow relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="stat-label">
                  {stat.title}
                </CardTitle>
                <div
                  className={`stat-icon-box ${stat.bg}`}
                >
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="stat-value">
                {stat.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task list */}
      {schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="empty-state">
            <div className="empty-icon">
              <Timer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">创建你的第一个定时任务</p>
              <p className="mt-1 text-sm text-muted-foreground">
                先添加小米账号，然后创建定时任务自动刷步
              </p>
            </div>
            <div className="fade-divider max-w-[240px]" />
            <div className="flex gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  1
                </span>
                选择账号
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  2
                </span>
                设定时间
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">
                  3
                </span>
                配置步数
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="card-grid">
          {schedules.map((s) => (
            <Card
              key={s.id}
              className={`card-glow group relative overflow-hidden ${
                !s.isActive ? "opacity-60" : ""
              }`}
            >
              {/* Active indicator bar */}
              {s.isActive && (
                <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
              )}

              <CardContent className="p-5 pl-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{s.accountNickname}</p>
                      {s.isActive ? (
                        <Badge variant="default" className="text-[10px]">
                          运行中
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          已暂停
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{cronToHuman(s.cronExpression)}</span>
                      <span className="text-muted-foreground/40">|</span>
                      <code className="font-mono text-xs">
                        {s.cronExpression}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggle(s.id, s.isActive)}
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
                      className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="fade-divider my-4" />

                <div className="info-grid">
                  <div>
                    <p className="label-tiny">
                      步数范围
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-medium">
                      {s.minStep.toLocaleString()} -{" "}
                      {s.maxStep.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="label-tiny">
                      上次执行
                    </p>
                    <p className="mt-0.5 font-mono text-sm">
                      {s.lastRunAt
                        ? new Date(s.lastRunAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
