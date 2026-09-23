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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

      {/* Account cards */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        >
          <StepList steps={[t("step1"), t("step2"), t("step3")]} />
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="gap-4">
              <CardHeader className="grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                {acc.status === "active" ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> : <AlertCircle className="size-4 text-destructive" aria-hidden="true" />}
                <div className="min-w-0">
                  <CardTitle className="truncate" title={acc.nickname}>{acc.nickname}</CardTitle>
                  {acc.account && <p className="truncate text-xs text-muted-foreground" title={acc.account}>{acc.account}</p>}
                </div>
                <Badge variant={acc.status === "active" ? "default" : "destructive"}>
                  {acc.status === "active" ? t("statusActive") : t("statusError")}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {acc.lastError && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive [overflow-wrap:anywhere]">{acc.lastError}</p>}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("colSchedules")}</dt>
                    <dd className="mt-1 font-mono font-semibold tabular-nums">{acc.activeScheduleCount} / {acc.scheduleCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("colLastStep")}</dt>
                    <dd className="mt-1 font-mono font-semibold tabular-nums">{acc.lastStep != null ? acc.lastStep.toLocaleString() : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("colLastSync")}</dt>
                    <dd className="mt-1 text-xs tabular-nums">{formatShanghaiDateTime(acc.lastSyncAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("colCreatedAt")}</dt>
                    <dd className="mt-1 text-xs tabular-nums">{formatShanghaiDateTime(acc.createdAt, locale)}</dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter className="mt-auto justify-between gap-2 bg-muted/20 py-2">
                <p className="min-w-0 text-xs tabular-nums text-muted-foreground">
                  {t("colUpdatedAt")} · {formatShanghaiDateTime(acc.updatedAt, locale)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(acc)} title={tc("edit")} aria-label={`${tc("edit")} ${acc.nickname}`}>
                    <Pencil className="text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)} title={tc("delete")} aria-label={`${tc("delete")} ${acc.nickname}`}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
