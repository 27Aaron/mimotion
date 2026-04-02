"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
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
  const t = useTranslations("xiaomi");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ account: "", password: "", nickname: "" });
  const [editForm, setEditForm] = useState({ nickname: "", account: "", password: "" });
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setDataLoading(true);
    try {
      const res = await fetch("/api/xiaomi");
      if (res.ok) setAccounts(await res.json());
    } finally {
      setDataLoading(false);
    }
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
      toast.success(t("toastAdded"));
    } else {
      toast.error(data.error || t("addFailed"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/xiaomi?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchAccounts();
      toast.success(t("toastDeleted"));
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("deleteFailed"));
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
      toast.success(t("toastUpdated"));
    } else {
      setEditError(data.error || t("updateFailed"));
    }
  }

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const errorCount = accounts.filter((a) => a.status !== "active").length;

  const stats = [
    {
      title: t("statTotal"),
      value: accounts.length,
      icon: Smartphone,
      detail: t("statTotalDetail"),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t("statActive"),
      value: activeCount,
      icon: Wifi,
      detail: t("statActiveDetail"),
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: t("statAttention"),
      value: errorCount,
      icon: WifiOff,
      detail: errorCount > 0 ? t("statAttentionDetailBad") : t("statAttentionDetailOk"),
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  function formatDate(d: string | null) {
    if (!d) return "-";
    return new Date(d).toLocaleString(locale, {
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
          <h1 className="page-title">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <IconUserPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" /> {t("addAccount")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addAccountTitle")}</DialogTitle>
              <DialogDescription>
                {t("addAccountDesc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t("accountField")}</Label>
                  <Input
                    value={form.account}
                    onChange={(e) =>
                      setForm({ ...form, account: e.target.value })
                    }
                    placeholder={t("accountPlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("passwordField")}</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder={t("passwordPlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("nicknameField")}</Label>
                  <Input
                    value={form.nickname}
                    onChange={(e) =>
                      setForm({ ...form, nickname: e.target.value })
                    }
                    placeholder={t("nicknamePlaceholder")}
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
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? tc("adding") : tc("add")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit account dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editAccount")}</DialogTitle>
              <DialogDescription>
                {t("editAccountDesc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t("accountField")}</Label>
                  <Input
                    value={editForm.account}
                    onChange={(e) =>
                      setEditForm({ ...editForm, account: e.target.value })
                    }
                    placeholder={t("accountPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("passwordField")}</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm({ ...editForm, password: e.target.value })
                    }
                    placeholder={t("editPasswordPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("nicknameField")}</Label>
                  <Input
                    value={editForm.nickname}
                    onChange={(e) =>
                      setEditForm({ ...editForm, nickname: e.target.value })
                    }
                    placeholder={t("nicknamePlaceholder")}
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
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? tc("saving") : tc("save")}
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
              <p className="font-medium">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("emptyDesc")}
              </p>
            </div>
            <div className="fade-divider max-w-[240px]" />
            <div className="flex gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="step-circle">1</span> {t("step1")}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">2</span> {t("step2")}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="step-circle">3</span> {t("step3")}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] text-center">{t("colAccount")}</TableHead>
                <TableHead className="text-center">{t("colStatus")}</TableHead>
                <TableHead className="text-center">{t("colSchedules")}</TableHead>
                <TableHead className="text-center">{t("colLastStep")}</TableHead>
                <TableHead className="text-center">{t("colLastSync")}</TableHead>
                <TableHead className="text-center">{t("colCreatedAt")}</TableHead>
                <TableHead className="text-center">{t("colUpdatedAt")}</TableHead>
                <TableHead className="text-center w-[100px]">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-2.5 text-left">
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
                      <div className="min-w-0">
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
                      {acc.status === "active" ? t("statusActive") : t("statusError")}
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
                        title={tc("edit")}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(acc.id)}
                        title={tc("delete")}
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
