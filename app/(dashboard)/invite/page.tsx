"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Ticket } from "lucide-react";
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

interface InviteCode {
  code: string;
  usedBy: string | null;
  createdAt: string;
}

export default function InvitePage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(false);

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
    }
    setLoading(false);
  }

  async function handleDelete(code: string) {
    if (!confirm("确定删除该邀请码？")) return;
    await fetch(`/api/invite?code=${code}`, { method: "DELETE" });
    fetchCodes();
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">邀请码管理</h1>
          <p className="mt-1 text-muted-foreground">生成和管理注册邀请码</p>
        </div>
        <Button onClick={handleCreate} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          {loading ? "生成中..." : "生成邀请码"}
        </Button>
      </div>

      {/* New code highlight */}
      {newCode && (
        <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              新邀请码
            </p>
            <code className="text-lg font-semibold text-primary">
              {newCode}
            </code>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(newCode)}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> 复制
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {codes.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center text-muted-foreground">
            <Ticket className="mb-3 h-10 w-10 opacity-30" />
            <p>暂无邀请码</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邀请码</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((c) => (
                <TableRow key={c.code}>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                      {c.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.usedBy ? "default" : "secondary"}>
                      {c.usedBy ? "已使用" : "未使用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {new Date(c.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!c.usedBy && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c.code)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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
