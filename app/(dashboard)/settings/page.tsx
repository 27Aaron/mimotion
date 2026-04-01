"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
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
  const [loading, setLoading] = useState(false);
  const [testingBark, setTestingBark] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

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

  async function handleTestPush(type: "bark" | "telegram") {
    if (type === "bark") setTestingBark(true);
    else setTestingTelegram(true);

    try {
      const res = await fetch("/api/user/test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "bark"
            ? { type: "bark", barkUrl }
            : { type: "telegram", telegramBotToken, telegramChatId }
        ),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${type === "bark" ? "Bark" : "Telegram"} 推送测试成功`);
      } else {
        toast.error(data.error || "推送测试失败");
      }
    } catch {
      toast.error("请求失败");
    } finally {
      if (type === "bark") setTestingBark(false);
      else setTestingTelegram(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      toast.success("设置已保存");
      setCurrentPassword("");
      setNewPassword("");
      if (username) {
        setCurrentUsername(username);
        setUsername("");
      }
    } else {
      toast.error(data.error || "保存失败");
    }
  }

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-muted-foreground">管理你的账号和安全偏好</p>
      </div>

      {/* Profile */}
      <Card className="mb-3">
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
        {/* Section headers */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex items-center gap-2">
            <div className="section-icon">
              <Shield className="h-3 w-3 text-primary" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              安全设置
            </h2>
            <div className="ml-2 h-px flex-1 bg-border" />
          </div>
          <div className="flex items-center gap-2">
            <div className="section-icon">
              <Bell className="h-3 w-3 text-primary" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              推送通知
            </h2>
            <div className="ml-2 h-px flex-1 bg-border" />
          </div>
        </div>

        {/* Row 1: Username ↔ Bark */}
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
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

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Bark 推送</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingBark || !barkUrl}
                  onClick={(e) => { e.preventDefault(); handleTestPush("bark"); }}
                >
                  {testingBark && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {testingBark ? "发送中..." : "测试推送"}
                </Button>
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
        </div>

        {/* Row 2: Password ↔ Telegram */}
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
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

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Telegram 推送</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingTelegram || !telegramBotToken || !telegramChatId}
                  onClick={(e) => { e.preventDefault(); handleTestPush("telegram"); }}
                >
                  {testingTelegram && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {testingTelegram ? "发送中..." : "测试推送"}
                </Button>
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
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setUsername("");
              setCurrentPassword("");
              setNewPassword("");
              setBarkUrl("");
              setTelegramBotToken("");
              setTelegramChatId("");
            }}
          >
            重置
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </form>
    </div>
  );
}
