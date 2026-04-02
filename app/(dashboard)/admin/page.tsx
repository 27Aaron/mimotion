"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Users,
  Trash2,
  Shield,
  Calendar,
  Smartphone,
  Send,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";

interface UserRow {
  id: string;
  username: string;
  isAdmin: boolean;
  barkUrl: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
  accountCount: number;
  activeSchedules: number;
  totalSchedules: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`确定删除用户 ${username}？该操作不可恢复。`)) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
      toast.success("用户已删除");
    } else {
      let msg = "删除失败";
      try { msg = (await res.json()).error || msg; } catch {}
      toast.error(msg);
    }
  }

  function openResetDialog(user: UserRow) {
    setResetUser(user);
    setNewPassword("");
    setResetError("");
    setResetOpen(true);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    setResetLoading(true);
    setResetError("");

    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetUser.id, newPassword }),
    });

    setResetLoading(false);

    if (res.ok) {
      setResetOpen(false);
      setResetUser(null);
      toast.success("密码已重置");
    } else {
      const data = await res.json();
      setResetError(data.error || "重置失败");
    }
  }

  const totalUsers = users.length;
  const totalAccounts = users.reduce((sum, u) => sum + u.accountCount, 0);
  const totalActive = users.reduce((sum, u) => sum + u.activeSchedules, 0);

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="page-title">用户管理</h1>
        <p className="mt-1 text-muted-foreground">查看和管理所有注册用户</p>
      </div>

      {/* Overview stats */}
      <div className="stats-grid">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">注册用户</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Smartphone className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{totalAccounts}</p>
              <p className="text-xs text-muted-foreground">绑定账号总数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Calendar className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{totalActive}</p>
              <p className="text-xs text-muted-foreground">活跃任务总数</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User table */}
      <Card>
        {loading ? (
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            加载中...
          </CardContent>
        ) : users.length === 0 ? (
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            暂无用户
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] text-center">用户</TableHead>
                <TableHead className="text-center">角色</TableHead>
                <TableHead className="text-center">推送配置</TableHead>
                <TableHead className="text-center">小米账号</TableHead>
                <TableHead className="text-center">定时任务</TableHead>
                <TableHead className="text-center">最后活跃</TableHead>
                <TableHead className="text-center w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <span className="text-xs font-medium">
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium">{u.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {u.isAdmin ? (
                      <Badge variant="default" className="gap-1">
                        <Shield className="h-3 w-3" />
                        管理员
                      </Badge>
                    ) : (
                      <Badge variant="secondary">用户</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded ${u.barkUrl ? "bg-emerald-500/10" : "bg-muted"}`}
                        title={u.barkUrl ? "Bark 已配置" : "Bark 未配置"}
                      >
                        <Smartphone
                          className={`h-3 w-3 ${u.barkUrl ? "text-emerald-500" : "text-muted-foreground/40"}`}
                        />
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded ${u.telegramBotToken ? "bg-blue-500/10" : "bg-muted"}`}
                        title={u.telegramBotToken ? "Telegram 已配置" : "Telegram 未配置"}
                      >
                        <Send
                          className={`h-3 w-3 ${u.telegramBotToken ? "text-blue-500" : "text-muted-foreground/40"}`}
                        />
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {u.accountCount}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm">{u.activeSchedules}</span>
                    <span className="text-muted-foreground"> / {u.totalSchedules}</span>
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm text-muted-foreground">
                    {new Date(u.updatedAt).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {!u.isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openResetDialog(u)}
                            title="重置密码"
                          >
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(u.id, u.username)}
                            title="删除用户"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为用户 <strong>{resetUser?.username}</strong> 设置新密码
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>新密码</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  required
                />
              </div>
              {resetError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {resetError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resetLoading ? "重置中..." : "确认重置"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
