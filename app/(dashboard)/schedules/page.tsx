"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Clock, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    } else {
      setError(data.error || "创建失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该任务？")) return;
    await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    fetchSchedules();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/schedules?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchSchedules();
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">定时任务</h1>
          <p className="mt-1 text-muted-foreground">管理自动刷步计划</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> 创建任务
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

      {/* Content */}
      {schedules.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center text-muted-foreground">
            <Clock className="mb-3 h-10 w-10 opacity-30" />
            <p>暂无任务，点击上方按钮创建</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead>Cron</TableHead>
                <TableHead>步数范围</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.accountNickname}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-muted-foreground">
                      {s.cronExpression}
                    </code>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {s.minStep.toLocaleString()} - {s.maxStep.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleToggle(s.id, s.isActive)}
                    >
                      {s.isActive ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <Badge variant="default">运行中</Badge>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <Badge variant="secondary">已停用</Badge>
                        </>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
