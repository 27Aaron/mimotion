"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { IconUserPlus } from "@tabler/icons-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Account {
  id: string;
  nickname: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

export default function XiaomiPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ account: "", password: "", nickname: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    const res = await fetch("/api/xiaomi");
    if (res.ok) setAccounts(await res.json());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/xiaomi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setOpen(false);
      setForm({ account: "", password: "", nickname: "" });
      fetchAccounts();
      toast.success("账号添加成功");
    } else {
      toast.error(data.error || "添加失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该账号？")) return;
    await fetch(`/api/xiaomi?id=${id}`, { method: "DELETE" });
    fetchAccounts();
    toast.success("账号已删除");
  }

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const errorCount = accounts.filter((a) => a.status !== "active").length;

  const stats = [
    {
      title: "账号总数",
      value: accounts.length,
      icon: Smartphone,
      detail: "已绑定账号",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "正常连接",
      value: activeCount,
      icon: Wifi,
      detail: "同步状态良好",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "需要关注",
      value: errorCount,
      icon: WifiOff,
      detail: errorCount > 0 ? "请检查账号状态" : "一切正常",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="page-title">小米账号</h1>
          <p className="mt-1 text-muted-foreground">
            管理你的小米运动账号，添加后可用于创建定时刷步任务
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button>
              <IconUserPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" /> 添加账号
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加小米账号</DialogTitle>
              <DialogDescription>
                输入你的小米/Zepp 账号和密码
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>小米账号（手机号 / 邮箱）</Label>
                  <Input
                    value={form.account}
                    onChange={(e) =>
                      setForm({ ...form, account: e.target.value })
                    }
                    placeholder="请输入手机号或邮箱"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>密码</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="请输入密码"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>显示名称（可选）</Label>
                  <Input
                    value={form.nickname}
                    onChange={(e) =>
                      setForm({ ...form, nickname: e.target.value })
                    }
                    placeholder="给账号起个名字"
                  />
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
                  {loading ? "添加中..." : "添加"}
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

      {/* Account list */}
      {accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="empty-state">
            <div className="empty-icon">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">添加你的第一个小米账号</p>
              <p className="mt-1 text-sm text-muted-foreground">
                绑定小米运动账号后，即可创建定时任务自动刷步
              </p>
            </div>
            <div className="fade-divider max-w-[240px]" />
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
      ) : (
        <div className="card-grid">
          {accounts.map((acc) => (
            <Card key={acc.id} className="card-glow group relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        acc.status === "active"
                          ? "bg-emerald-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {acc.status === "active" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{acc.nickname}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          variant={
                            acc.status === "active" ? "default" : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {acc.status === "active" ? "正常" : "异常"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => handleDelete(acc.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="fade-divider my-4" />

                <div className="info-grid">
                  <div>
                    <p className="label-tiny">
                      最后同步
                    </p>
                    <p className="mt-0.5 font-mono text-sm">
                      {acc.lastSyncAt
                        ? new Date(acc.lastSyncAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="label-tiny">
                      状态
                    </p>
                    <p className="mt-0.5 text-sm">
                      {acc.lastError ? (
                        <span className="text-destructive/80 truncate">
                          {acc.lastError}
                        </span>
                      ) : acc.status === "active" ? (
                        <span className="text-emerald-500">运行正常</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
