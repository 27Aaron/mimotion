"use client";

import { useState, useEffect } from "react";
import { Users, Trash2, Shield, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface UserRow {
  id: string;
  email: string;
  isAdmin: boolean;
  barkUrl: string | null;
  createdAt: string;
  accountCount: number;
  activeSchedules: number;
  totalSchedules: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function handleDelete(id: string, email: string) {
    if (!confirm(`确定删除用户 ${email}？该操作不可恢复。`)) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || "删除失败");
    }
  }

  const totalUsers = users.length;
  const totalAccounts = users.reduce((sum, u) => sum + u.accountCount, 0);
  const totalActive = users.reduce((sum, u) => sum + u.activeSchedules, 0);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
        <p className="mt-1 text-muted-foreground">查看和管理所有注册用户</p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-3">
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
              <Mail className="h-5 w-5 text-emerald-500" />
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
                <TableHead>用户</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>小米账号</TableHead>
                <TableHead>定时任务</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <span className="text-xs font-medium">
                          {u.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.isAdmin ? (
                      <Badge variant="default" className="gap-1">
                        <Shield className="h-3 w-3" />
                        管理员
                      </Badge>
                    ) : (
                      <Badge variant="secondary">用户</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {u.accountCount}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{u.activeSchedules}</span>
                    <span className="text-muted-foreground"> / {u.totalSchedules}</span>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    {!u.isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(u.id, u.email)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
