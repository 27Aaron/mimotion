"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
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

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="page-title">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      {/* Overview stats */}
      <div className="stats-grid">
        <Card className="stat-card">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="stat-label">{t("statUsers")}</CardTitle>
              <div className="stat-icon-box bg-blue-500/10">
                <Users className="text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-1">
            <div className="stat-value">{totalUsers}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("statUsersDetail")}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="stat-label">{t("statAccounts")}</CardTitle>
              <div className="stat-icon-box bg-emerald-500/10">
                <Smartphone className="text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-1">
            <div className="stat-value">{totalAccounts}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("statAccountsDetail")}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="stat-label">{t("statActiveTasks")}</CardTitle>
              <div className="stat-icon-box bg-amber-500/10">
                <Calendar className="text-amber-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-1">
            <div className="stat-value">{totalActive}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("statActiveTasksDetail")}</p>
          </CardContent>
        </Card>
      </div>

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
                        className={`flex h-6 w-6 items-center justify-center rounded ${u.barkUrl ? "bg-emerald-500/10" : "bg-muted"}`}
                        title={u.barkUrl ? t("barkConfigured") : t("barkNotConfigured")}
                      >
                        <Smartphone
                          className={`h-3 w-3 ${u.barkUrl ? "text-emerald-500" : "text-muted-foreground/40"}`}
                        />
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded ${u.telegramBotToken ? "bg-blue-500/10" : "bg-muted"}`}
                        title={u.telegramBotToken ? t("telegramConfigured") : t("telegramNotConfigured")}
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
                    {new Date(u.updatedAt).toLocaleString(locale, {
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
