import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "@/platform/i18n";
import { toast } from "sonner";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { PageHeader } from "@/components/layout/page-header";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { jsonRequest } from "@/lib/api";
import { formatShanghaiDateTime } from "@/lib/time/format";
import { cn } from "@/lib/utils";
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
    try {
      setUsers(await jsonRequest<UserRow[]>("/api/admin/users"));
    } catch {
      /* surfaced by mutations */
    }
    setLoading(false);
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(t("confirmDeleteUser", { username }))) return;
    try {
      await jsonRequest(`/api/admin/users?id=${id}`, { method: "DELETE" });
      fetchUsers();
      toast.success(t("toastDeleted"));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("deleteFailed"));
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

    try {
      await jsonRequest("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUser.id, newPassword }),
      });
      setResetOpen(false);
      setResetUser(null);
      toast.success(t("toastPasswordReset"));
    } catch (requestError) {
      setResetError(requestError instanceof Error ? requestError.message : t("resetFailed"));
    } finally {
      setResetLoading(false);
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
    },
    {
      title: t("statAccounts"),
      value: totalAccounts,
      detail: t("statAccountsDetail"),
      icon: Smartphone,
    },
    {
      title: t("statActiveTasks"),
      value: totalActive,
      detail: t("statActiveTasksDetail"),
      icon: Calendar,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Overview stats */}
      <StatsGrid items={stats} />

      {/* User table */}
      <Card className="py-0">
        {loading ? (
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            {tc("loading")}
          </CardContent>
        ) : users.length === 0 ? (
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            {t("noUsers")}
          </CardContent>
        ) : (
          <CardContent className="p-0">
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
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted">
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
                        <Shield data-icon="inline-start" />
                        {tn("roleAdmin")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{tn("roleUser")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className="flex size-6 items-center justify-center rounded-md border border-border bg-card"
                        title={u.barkConfigured ? t("barkConfigured") : t("barkNotConfigured")}
                      >
                        <Smartphone
                          className={cn(
                            "size-3",
                            u.barkConfigured ? "text-primary" : "text-muted-foreground/40",
                          )}
                        />
                      </span>
                      <span
                        className="flex size-6 items-center justify-center rounded-md border border-border bg-card"
                        title={u.telegramConfigured ? t("telegramConfigured") : t("telegramNotConfigured")}
                      >
                        <Send
                          className={cn(
                            "size-3",
                            u.telegramConfigured ? "text-primary" : "text-muted-foreground/40",
                          )}
                        />
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {u.accountCount}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm tabular-nums">{u.activeSchedules}</span>
                    <span className="text-muted-foreground"> / {u.totalSchedules}</span>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {formatShanghaiDateTime(u.updatedAt, locale)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {!u.isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openResetDialog(u)}
                            title={t("resetPassword")}
                            aria-label={t("resetPassword")}
                          >
                            <KeyRound className="text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(u.id, u.username)}
                            title={t("deleteUser")}
                            aria-label={t("deleteUser")}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </CardContent>
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
            <FieldGroup className="py-4">
              <Field data-invalid={Boolean(resetError)}>
                <FieldLabel htmlFor="admin-new-password">{t("newPassword")}</FieldLabel>
                <Input
                  id="admin-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("newPasswordPlaceholder")}
                  aria-invalid={Boolean(resetError) || undefined}
                  required
                />
                <FieldError>{resetError}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {resetLoading ? t("resetting") : t("confirmReset")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
