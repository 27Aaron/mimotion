"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Copy,
  Ticket,
  Check,
  Users,
  Gift,
  Hash,
} from "lucide-react";
import { IconSparkles } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FilterType = "unused" | "all" | "used";

interface InviteCode {
  code: string;
  usedBy: string | null;
  createdAt: string;
}

export default function InvitePage() {
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
    color: string;
    bg: string;
    filter: FilterType;
  }[] = [
    {
      title: t("statTotal"),
      value: totalCodes,
      icon: Hash,
      detail: t("statTotalDetail"),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      filter: "all",
    },
    {
      title: t("statUsed"),
      value: usedCodes,
      icon: Users,
      detail: t("statUsedDetail"),
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      filter: "used",
    },
    {
      title: t("statUnused"),
      value: unusedCodes,
      icon: Gift,
      detail: unusedCodes > 0 ? t("statUnusedDetailOk") : t("statUnusedDetailEmpty"),
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      filter: "unused",
    },
  ];

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
        <Button onClick={handleCreate} disabled={loading}>
          <IconSparkles className="mr-1.5 h-4 w-4 stroke-[1.5]" />
          {loading ? t("generating") : t("generateCode")}
        </Button>
      </div>

      {/* New code highlight */}
      {newCode && (
        <div className="mb-6 flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Ticket className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("newCode")}
            </p>
            <code className="text-lg font-semibold text-primary">
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
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> {tc("copied")}
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> {tc("copyLink")}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Stats overview — clickable filters */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            onClick={() => setFilter(stat.filter)}
            className={`stat-card relative cursor-pointer transition-all ${
              filter === stat.filter
                ? "ring-2 ring-primary/40"
                : "hover:ring-1 hover:ring-border"
            }`}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="stat-label">
                  {stat.title}
                </CardTitle>
                <div
                  className={`stat-icon-box ${stat.bg}`}
                >
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

      {/* Invite codes list */}
      {filteredCodes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="empty-state py-12">
            <div className="empty-icon">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {filter === "used"
                  ? t("emptyUsed")
                  : filter === "all"
                    ? t("emptyAll")
                    : t("emptyUnused")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("emptyDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="card-grid gap-3">
          {filteredCodes.map((c) => (
            <Card key={c.code} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        c.usedBy ? "bg-muted" : "bg-primary/10"
                      }`}
                    >
                      <Ticket
                        className={`h-4 w-4 ${
                          c.usedBy ? "text-muted-foreground" : "text-primary"
                        }`}
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
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString(locale, {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!c.usedBy && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(c.code)}
                      >
                        {copiedCode === c.code ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(c.code)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
