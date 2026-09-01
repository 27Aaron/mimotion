import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "@/platform/i18n";
import {
  Trash2,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Pencil,
} from "lucide-react";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StepList } from "@/components/layout/step-list";
import { XiaomiAccountDialog } from "@/features/xiaomi/components/xiaomi-account-dialog";
import { EMPTY_XIAOMI_ACCOUNT_FORM } from "@/features/xiaomi/model";
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
import {
  createXiaomiAccount,
  deleteXiaomiAccount,
  listXiaomiAccounts,
  updateXiaomiAccount,
  type XiaomiAccount,
} from "@/features/xiaomi/client";
import { formatShanghaiDateTime } from "@/lib/time/format";

export default function XiaomiScreen() {
  const t = useTranslations("xiaomi");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [accounts, setAccounts] = useState<XiaomiAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_XIAOMI_ACCOUNT_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_XIAOMI_ACCOUNT_FORM });
  const [editError, setEditError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try { setAccounts(await listXiaomiAccounts()); } catch { /* surfaced by mutations */ }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await createXiaomiAccount(form);
      setOpen(false);
      setForm({ ...EMPTY_XIAOMI_ACCOUNT_FORM });
      await fetchAccounts();
      toast.success(t("toastAdded"));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("addFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteXiaomiAccount(id);
      await fetchAccounts();
      toast.success(t("toastDeleted"));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("deleteFailed"));
    }
  }

  function openEdit(acc: XiaomiAccount) {
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

    try {
      await updateXiaomiAccount(editingId, body);
      setEditOpen(false);
      setEditingId(null);
      await fetchAccounts();
      toast.success(t("toastUpdated"));
    } catch (requestError) {
      setEditError(requestError instanceof Error ? requestError.message : t("updateFailed"));
    } finally {
      setLoading(false);
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
    },
    {
      title: t("statActive"),
      value: activeCount,
      icon: Wifi,
      detail: t("statActiveDetail"),
    },
    {
      title: t("statAttention"),
      value: errorCount,
      icon: WifiOff,
      detail: errorCount > 0 ? t("statAttentionDetailBad") : t("statAttentionDetailOk"),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <XiaomiAccountDialog
            mode="create"
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) setForm({ ...EMPTY_XIAOMI_ACCOUNT_FORM });
            }}
            onSubmit={handleAdd}
            form={form}
            onFormChange={setForm}
            loading={loading}
          />
        }
      />

      <XiaomiAccountDialog
        mode="edit"
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);
          if (!nextOpen) {
            setEditingId(null);
            setEditError("");
            setEditForm({ ...EMPTY_XIAOMI_ACCOUNT_FORM });
          }
        }}
        onSubmit={handleEdit}
        form={editForm}
        onFormChange={setEditForm}
        error={editError}
        loading={loading}
      />

      {/* Stats overview */}
      <StatsGrid items={stats} />

      {/* Account table */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        >
          <StepList steps={[t("step1"), t("step2"), t("step3")]} />
        </EmptyState>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
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
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card"
                      >
                        {acc.status === "active" ? (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="size-4 text-red-500" />
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
                    <span className="text-sm tabular-nums">{acc.activeScheduleCount}</span>
                    <span className="text-muted-foreground"> / {acc.scheduleCount}</span>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {acc.lastStep != null ? (
                      <span>{acc.lastStep.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {formatShanghaiDateTime(acc.lastSyncAt, locale)}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {formatShanghaiDateTime(acc.createdAt, locale)}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {formatShanghaiDateTime(acc.updatedAt, locale)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(acc)}
                        title={tc("edit")}
                        aria-label={tc("edit")}
                      >
                        <Pencil className="text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(acc.id)}
                        title={tc("delete")}
                        aria-label={tc("delete")}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
