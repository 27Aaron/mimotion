"use client";

import { useState, useEffect } from "react";
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

const DAY_OPTIONS = [
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
  { value: "0", label: "周日" },
];

function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  const [minute, hour, , , dow] = parts;
  const hh = hour !== "*" ? hour.padStart(2, "0") : null;
  const mm = minute !== "*" ? minute.padStart(2, "0") : "00";
  const timeStr = hh ? `${hh}:${mm}` : "每小时";

  const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

  function formatDow(d: string): string {
    if (d === "*") return "每天";
    if (d === "1-5") return "工作日";
    if (d === "1-6") return "周一至周六";
    if (d === "0-6" || d === "0,1,2,3,4,5,6") return "每天";
    // 单天
    if (!d.includes(",") && !d.includes("-")) {
      return `周${DAY_NAMES[parseInt(d) % 7]}`;
    }
    // 多天展开
    const days: number[] = [];
    for (const seg of d.split(",")) {
      if (seg.includes("-")) {
        const [s, e] = seg.split("-").map(Number);
        for (let i = s; i <= e; i++) days.push(i);
      } else {
        days.push(parseInt(seg));
      }
    }
    // 连续区间
    if (days.length >= 3) {
      const sorted = [...days].sort((a, b) => a - b);
      let isConsecutive = true;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) { isConsecutive = false; break; }
      }
      if (isConsecutive) return `周${DAY_NAMES[sorted[0] % 7]}至周${DAY_NAMES[sorted[sorted.length - 1] % 7]}`;
    }
    // 非连续
    const sorted = [...days].sort((a, b) => ((a % 7) - (b % 7)));
    return `周${sorted.map((v) => DAY_NAMES[v % 7]).join("、")}`;
  }

  const dowStr = formatDow(dow);
  if (!hh) return `${dowStr}，每小时执行`;
  return `${dowStr} ${timeStr}`;
}

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
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; nickname: string }[]>(
    [],
  );
  const [form, setForm] = useState({ ...DEFAULT_FORM });
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

    if (form.days.length === 0) {
      setError("请至少选择一天");
      return;
    }

    setLoading(true);

    // 构建 cron 表达式
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
      toast.success("任务创建成功");
    } else {
      toast.error(data.error || "创建失败");
    }
  }

  function openEdit(s: Schedule) {
    const { hour, minute, days } = parseCron(s.cronExpression);
    setEditingId(s.id);
    setForm({
      xiaomiAccountId: s.xiaomiAccountId,
      hour,
      minute,
      days,
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
      setError("请至少选择一天");
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
      toast.success("任务已更新");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "更新失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该任务？")) return;
    await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    fetchSchedules();
    toast.success("任务已删除");
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
      toast.error(data.error || "操作失败");
    }
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
          <DialogTrigger render={<Button />}>
            <IconCalendarPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" /> 创建任务
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
                  <Label>执行时间</Label>
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
                            {String(i).padStart(2, "0")} 时
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
                            {String(i).padStart(2, "0")} 分
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>重复日期</Label>
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

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑定时任务</DialogTitle>
              <DialogDescription>
                修改时间、步数或关联账号
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEdit}>
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
                  <Label>执行时间</Label>
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
                            {String(i).padStart(2, "0")} 时
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
                            {String(i).padStart(2, "0")} 分
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>重复日期</Label>
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
                  onClick={() => setEditOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "保存中..." : "保存"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">状态</TableHead>
                <TableHead className="text-center">小米账号</TableHead>
                <TableHead className="text-center">执行时间</TableHead>
                <TableHead className="text-center">步数范围</TableHead>
                <TableHead className="text-center">上次执行</TableHead>
                <TableHead className="text-center w-[120px]">操作</TableHead>
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
                          运行中
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          已暂停
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {s.accountNickname}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{cronToHuman(s.cronExpression)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {s.minStep.toLocaleString()} - {s.maxStep.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm text-muted-foreground">
                      {s.lastRunAt
                        ? new Date(s.lastRunAt).toLocaleString("zh-CN", {
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
                          title={s.isActive ? "暂停" : "启动"}
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
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(s.id)}
                          title="删除"
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
