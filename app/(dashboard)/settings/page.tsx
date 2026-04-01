"use client";

import { useState, useEffect } from "react";
import {
  User,
  Bell,
  Shield,
  Key,
  Loader2,
  Smartphone,
  Send,
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
export default function SettingsPage() {
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [barkUrl, setBarkUrl] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.username) setCurrentUsername(data.username);
        if (data.barkUrl) setBarkUrl(data.barkUrl);
        if (data.telegramBotToken) setTelegramBotToken(data.telegramBotToken);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
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
        username: username || undefined,
        password: newPassword || undefined,
        currentPassword: currentPassword || undefined,
        barkUrl: barkUrl || null,
        telegramBotToken: telegramBotToken || null,
        telegramChatId: telegramChatId || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage("设置已保存");
      setCurrentPassword("");
      setNewPassword("");
      if (username) {
        setCurrentUsername(username);
        setUsername("");
      }
    } else {
      setError(data.error || "保存失败");
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-muted-foreground">管理你的账号和安全偏好</p>
      </div>

      {/* Profile */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {currentUsername ? currentUsername.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">
                  {currentUsername || "加载中..."}
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  <User className="mr-1 h-3 w-3" />
                  用户名
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                用于登录 MiMotion 的用户名
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        {/* Two-column grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Security */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                安全设置
              </h2>
            </div>

            {/* Username */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">修改用户名</CardTitle>
                </div>
                <CardDescription>修改后使用新用户名登录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs">
                    新用户名
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入新用户名"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  留空则不修改。更换后需用新用户名登录。
                </p>
              </CardContent>
            </Card>

            {/* Password */}
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

          </div>

          {/* Right: Notifications */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                推送通知
              </h2>
            </div>

            {/* Bark */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Bark 推送</CardTitle>
                </div>
                <CardDescription>填入完整的 Bark 推送地址</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="barkUrl" className="text-xs">
                    Bark URL
                  </Label>
                  <Input
                    id="barkUrl"
                    type="url"
                    value={barkUrl}
                    onChange={(e) => setBarkUrl(e.target.value)}
                    placeholder="https://api.day.app/yourkey"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  留空则不推送，填入后任务执行结果将推送至 Bark
                </p>
              </CardContent>
            </Card>

            {/* Telegram */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Telegram 推送</CardTitle>
                </div>
                <CardDescription>通过 @userinfobot 获取 Chat ID</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="telegramBotToken" className="text-xs">
                    Bot Token
                  </Label>
                  <Input
                    id="telegramBotToken"
                    type="text"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="123456:ABC-DEF..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telegramChatId" className="text-xs">
                    Chat ID
                  </Label>
                  <Input
                    id="telegramChatId"
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="123456789"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action buttons — bottom right of notifications column */}
            <div className="mt-6 flex items-center justify-end gap-3">
              {error && (
                <span className="text-sm text-destructive">{error}</span>
              )}
              {message && (
                <span className="text-sm text-primary">{message}</span>
              )}
              <Button
                type="button"
                onClick={() => {
                  setUsername("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setBarkUrl("");
                  setTelegramBotToken("");
                  setTelegramChatId("");
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
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
