"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "@/platform/i18n";
import { toast } from "sonner";
import {
  Trash2,
  Copy,
  Ticket,
  Check,
  Users,
  Gift,
  Hash,
  Plus,
} from "lucide-react";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { formatShanghaiDateTime } from "@/lib/time/format";
import { cn } from "@/lib/utils";

type FilterType = "unused" | "all" | "used";

interface InviteCode {
  code: string;
  usedBy: string | null;
  createdAt: string;
}

export default function InviteScreen() {
  const t = useTranslations("invite");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [filter, setFilter] = useState<FilterType>("unused");

  useEffect(() => {
    fetchCodes();
  }, []);

  async function fetchCodes() {
    const res = await fetch("/api/invite");
    if (res.ok) setCodes(await res.json());
  }

  async function handleCreate() {
    setLoading(true);
    const res = await fetch("/api/invite", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setNewCode(data.code);
      fetchCodes();
      toast.success(t("toastGenerated"));
    }
    setLoading(false);
  }

  async function handleDelete(code: string) {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/invite?code=${code}`, { method: "DELETE" });
    fetchCodes();
    toast.success(t("toastDeleted"));
  }

  async function handleCopy(code: string) {
    const url = `${window.location.origin}/${locale}/login?code=${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success(t("toastCopied"));
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedCode(null), 2000);
  }

  const totalCodes = codes.length;
  const usedCodes = codes.filter((c) => c.usedBy).length;
  const unusedCodes = totalCodes - usedCodes;

  const filteredCodes = codes.filter((c) => {
    if (filter === "all") return true;
    if (filter === "used") return !!c.usedBy;
    return !c.usedBy;
  });

  const stats: {
    title: string;
    value: number;
    icon: typeof Hash;
    detail: string;
    filter: FilterType;
  }[] = [
    {
      title: t("statTotal"),
      value: totalCodes,
      icon: Hash,
      detail: t("statTotalDetail"),
      filter: "all",
    },
    {
      title: t("statUsed"),
      value: usedCodes,
      icon: Users,
      detail: t("statUsedDetail"),
      filter: "used",
    },
    {
      title: t("statUnused"),
      value: unusedCodes,
      icon: Gift,
      detail: unusedCodes > 0 ? t("statUnusedDetailOk") : t("statUnusedDetailEmpty"),
      filter: "unused",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={handleCreate} disabled={loading}>
            <Plus data-icon="inline-start" />
            {loading ? t("generating") : t("generateCode")}
          </Button>
        }
      />

      {/* New code highlight */}
      {newCode && (
        <div className="flex items-center gap-4 rounded-lg border border-primary/25 bg-primary/[0.04] px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-md border border-primary/25 text-primary">
            <Ticket className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t("newCode")}
            </p>
            <code className="text-lg font-semibold tabular-nums text-primary">
              {newCode}
            </code>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(newCode)}
          >
            {copiedCode === newCode ? (
              <>
                <Check data-icon="inline-start" className="text-emerald-500" /> {tc("copied")}
              </>
            ) : (
              <>
                <Copy data-icon="inline-start" /> {tc("copyLink")}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Stats overview — clickable filters */}
      <StatsGrid
        items={stats.map((stat) => ({
          ...stat,
          active: filter === stat.filter,
          onClick: () => setFilter(stat.filter),
        }))}
      />

      {/* Invite codes list */}
      {filteredCodes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={
            filter === "used"
              ? t("emptyUsed")
              : filter === "all"
                ? t("emptyAll")
                : t("emptyUnused")
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredCodes.map((c) => (
            <Card key={c.code}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-9 items-center justify-center rounded-md border border-border bg-card"
                    >
                      <Ticket
                        className={cn(
                          "size-4",
                          c.usedBy ? "text-muted-foreground" : "text-primary",
                        )}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-semibold">
                          {c.code}
                        </code>
                        <Badge
                          variant={c.usedBy ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {c.usedBy ? t("codeUsed") : t("codeUnused")}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {formatShanghaiDateTime(c.createdAt, locale)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!c.usedBy && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(c.code)}
                        title={tc("copyLink")}
                        aria-label={tc("copyLink")}
                      >
                        {copiedCode === c.code ? (
                          <Check className="text-primary" />
                        ) : (
                          <Copy className="text-muted-foreground" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(c.code)}
                      title={tc("delete")}
                      aria-label={tc("delete")}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
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
