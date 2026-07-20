"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { StatsGrid } from "@/components/dashboard/stats-grid";
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
import { formatShanghaiDateTime } from "@/lib/time/format";
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
  barkConfigured: boolean;
  telegramConfigured: boolean;
  createdAt: string;
  updatedAt: string;
  accountCount: number;
  activeSchedules: number;
  totalSchedules: number;
}

export default function AdminScreen() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const locale = useLocale();
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
    if (!confirm(t("confirmDeleteUser", { username }))) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
      toast.success(t("toastDeleted"));
    } else {
      let msg = t("deleteFailed");
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
      toast.success(t("toastPasswordReset"));
    } else {
      const data = await res.json();
      setResetError(data.error || t("resetFailed"));
    }
  }

  const totalUsers = users.length;
  const totalAccounts = users.reduce((sum, u) => sum + u.accountCount, 0);
  const totalActive = users.reduce((sum, u) => sum + u.activeSchedules, 0);
  const stats = [
    {
      title: t("statUsers"),
      value: totalUsers,
      detail: t("statUsersDetail"),
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t("statAccounts"),
      value: totalAccounts,
      detail: t("statAccountsDetail"),
      icon: Smartphone,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: t("statActiveTasks"),
      value: totalActive,
      detail: t("statActiveTasksDetail"),
      icon: Calendar,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="page-title">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      {/* Overview stats */}
      <StatsGrid items={stats} />

      {/* User table */}
      <Card>
        {loading ? (
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            {tc("loading")}
          </CardContent>
        ) : users.length === 0 ? (
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            {t("noUsers")}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] text-center">{t("colUser")}</TableHead>
                <TableHead className="text-center">{t("colRole")}</TableHead>
                <TableHead className="text-center">{t("colPush")}</TableHead>
                <TableHead className="text-center">{t("colAccounts")}</TableHead>
                <TableHead className="text-center">{t("colSchedules")}</TableHead>
                <TableHead className="text-center">{t("colLastActive")}</TableHead>
                <TableHead className="text-center w-[100px]">{t("colActions")}</TableHead>
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
                        {tn("roleAdmin")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{tn("roleUser")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded ${u.barkConfigured ? "bg-emerald-500/10" : "bg-muted"}`}
                        title={u.barkConfigured ? t("barkConfigured") : t("barkNotConfigured")}
                      >
                        <Smartphone
                          className={`h-3 w-3 ${u.barkConfigured ? "text-emerald-500" : "text-muted-foreground/40"}`}
                        />
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded ${u.telegramConfigured ? "bg-blue-500/10" : "bg-muted"}`}
                        title={u.telegramConfigured ? t("telegramConfigured") : t("telegramNotConfigured")}
                      >
                        <Send
                          className={`h-3 w-3 ${u.telegramConfigured ? "text-blue-500" : "text-muted-foreground/40"}`}
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
                    {formatShanghaiDateTime(u.updatedAt, locale)}
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
                            title={t("resetPassword")}
                          >
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(u.id, u.username)}
                            title={t("deleteUser")}
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
            <DialogTitle>{t("resetPasswordTitle")}</DialogTitle>
            <DialogDescription>
              {t("resetPasswordDesc", { username: resetUser?.username ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("newPassword")}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("newPasswordPlaceholder")}
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
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resetLoading ? t("resetting") : t("confirmReset")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
