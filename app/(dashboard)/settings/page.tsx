"use client";

import { useState, useEffect } from "react";
import {
  User,
  Bell,
  Shield,
  Key,
  Loader2,
  Globe,
  Smartphone,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [barkUrl, setBarkUrl] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.email) setCurrentEmail(data.user.email);
        if (data.user?.barkUrl) setBarkUrl(data.user.barkUrl);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email || undefined,
        password: newPassword || undefined,
        currentPassword: currentPassword || undefined,
        barkUrl: barkUrl || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage("设置已保存");
      setCurrentPassword("");
      setNewPassword("");
      if (email) {
        setCurrentEmail(email);
        setEmail("");
      }
    } else {
      setError(data.error || "保存失败");
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-muted-foreground">管理你的账号和安全偏好</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile section */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              个人资料
            </h2>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {currentEmail ? currentEmail.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">
                      {currentEmail || "加载中..."}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      <Globe className="mr-1 h-3 w-3" />
                      登录邮箱
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    用于登录 MiMotion 的邮箱地址，不可与其他账号重复
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security section */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              安全设置
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Password card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">修改密码</CardTitle>
                </div>
                <CardDescription>修改后需重新登录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="text-xs">
                    当前密码
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="请输入当前密码"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs">
                    新密码
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Email card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">更换邮箱</CardTitle>
                </div>
                <CardDescription>修改后使用新邮箱登录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">
                    新邮箱
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入新邮箱"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  留空则不修改。更换后需用新邮箱登录。
                </p>

                <Separator className="my-3" />

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    安全提示
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    修改密码和邮箱均需重新登录。如忘记密码请联系管理员重置。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Notification section */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              推送通知
            </h2>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">通知渠道</CardTitle>
              </div>
              <CardDescription>
                配置任务执行结果的推送方式
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label htmlFor="barkUrl" className="text-xs">
                      Bark 推送
                    </Label>
                  </div>
                  <Input
                    id="barkUrl"
                    type="url"
                    value={barkUrl}
                    onChange={(e) => setBarkUrl(e.target.value)}
                    placeholder="https://api.day.app/yourkey"
                  />
                  <p className="text-xs text-muted-foreground">
                    填入你的 Bark Key，任务执行后自动推送结果
                  </p>
                </div>
                <div className="flex items-center justify-center rounded-lg border border-dashed p-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">
                      更多推送渠道
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Telegram、微信推送即将支持
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 border-t pt-6">
          <Button
            type="button"
            onClick={() => {
              setEmail("");
              setCurrentPassword("");
              setNewPassword("");
              setBarkUrl("");
              setMessage("");
              setError("");
            }}
            variant="outline"
          >
            重置
          </Button>
          <Button
            type="submit"
            disabled={loading}
            onClick={(e) => {
              const form = (e.target as HTMLButtonElement).closest("form");
              if (form) form.requestSubmit();
            }}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "保存中..." : "保存设置"}
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
          {message && (
            <span className="text-sm text-primary">{message}</span>
          )}
        </div>
      </form>
    </div>
  );
}
