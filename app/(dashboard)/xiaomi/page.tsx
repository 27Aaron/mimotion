"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Pencil,
} from "lucide-react";
import { IconUserPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  account: string | null;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  scheduleCount: number;
  activeScheduleCount: number;
  lastStep: number | null;
}

export default function XiaomiPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ account: "", password: "", nickname: "" });
  const [editForm, setEditForm] = useState({ nickname: "", account: "", password: "" });
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
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
    const res = await fetch(`/api/xiaomi?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchAccounts();
      toast.success("账号已删除");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "删除失败");
    }
  }

  function openEdit(acc: Account) {
    setEditingId(acc.id);
    setEditForm({ nickname: acc.nickname, account: acc.account || "", password: "" });
    setEditError("");
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError("");
    setLoading(true);

    const body: Record<string, string> = { nickname: editForm.nickname };
    if (editForm.account && editForm.password) {
      body.account = editForm.account;
      body.password = editForm.password;
    }

    const res = await fetch(`/api/xiaomi?id=${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setEditOpen(false);
      setEditingId(null);
      fetchAccounts();
      toast.success("账号已更新");
    } else {
      setEditError(data.error || "更新失败");
    }
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

  function formatDate(d: string | null) {
    if (!d) return "-";
    return new Date(d).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

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
          <DialogTrigger render={<Button />}>
            <IconUserPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" /> 添加账号
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

        {/* Edit account dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑账号</DialogTitle>
              <DialogDescription>
                修改信息或重新登录以刷新凭证
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>小米账号（手机号 / 邮箱）</Label>
                  <Input
                    value={editForm.account}
                    onChange={(e) =>
                      setEditForm({ ...editForm, account: e.target.value })
                    }
                    placeholder="请输入手机号或邮箱"
                  />
                </div>
                <div className="space-y-2">
                  <Label>密码</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm({ ...editForm, password: e.target.value })
                    }
                    placeholder="填写密码以重新验证登录"
                  />
                </div>
                <div className="space-y-2">
                  <Label>显示名称（可选）</Label>
                  <Input
                    value={editForm.nickname}
                    onChange={(e) =>
                      setEditForm({ ...editForm, nickname: e.target.value })
                    }
                    placeholder="给账号起个名字"
                  />
                </div>
                {editError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {editError}
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
      <div className="stats-grid mb-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="stat-card">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="stat-label">
                  {stat.title}
                </CardTitle>
                <div className={`stat-icon-box ${stat.bg}`}>
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

      {/* Account table */}
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
                <span className="step-circle">1</span> 添加账号
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">2</span> 创建任务
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">3</span> 自动刷步
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] text-center">账号</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead className="text-center">定时任务</TableHead>
                <TableHead className="text-center">最近步数</TableHead>
                <TableHead className="text-center">最后同步</TableHead>
                <TableHead className="text-center">添加时间</TableHead>
                <TableHead className="text-center">更新时间</TableHead>
                <TableHead className="text-center w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          acc.status === "active"
                            ? "bg-emerald-500/10"
                            : "bg-red-500/10"
                        }`}
                      >
                        {acc.status === "active" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-medium">{acc.nickname}</p>
                        {acc.account && (
                          <p className="truncate text-xs text-muted-foreground">
                            {acc.account}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={acc.status === "active" ? "default" : "destructive"}
                    >
                      {acc.status === "active" ? "正常" : "异常"}
                    </Badge>
                    {acc.lastError && (
                      <p className="mt-1 text-xs text-destructive/80 truncate max-w-[160px] mx-auto" title={acc.lastError}>
                        {acc.lastError}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm">{acc.activeScheduleCount}</span>
                    <span className="text-muted-foreground"> / {acc.scheduleCount}</span>
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {acc.lastStep != null ? (
                      <span>{acc.lastStep.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm text-muted-foreground">
                    {formatDate(acc.lastSyncAt)}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm text-muted-foreground">
                    {formatDate(acc.createdAt)}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm text-muted-foreground">
                    {formatDate(acc.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(acc)}
                        title="编辑"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(acc.id)}
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
