"use client";

import { useState, useEffect } from "react";
import {
  User,
  Bell,
  Shield,
  Key,
  Loader2,
  Smartphone,
  MessageSquare,
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

            {/* Username card */}
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

                <div className="fade-divider my-3" />

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    安全提示
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    修改密码和用户名均需重新登录。如忘记密码请联系管理员重置。
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
                配置任务执行结果的推送方式，可同时启用多个渠道
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Bark */}
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

                {/* Telegram */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Send className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label htmlFor="telegramChatId" className="text-xs">
                      Telegram 推送
                    </Label>
                  </div>
                  <Input
                    id="telegramChatId"
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="Chat ID，如 123456789"
                  />
                  <p className="text-xs text-muted-foreground">
                    向 Bot 发送 /start 获取 Chat ID，需管理员配置 Bot Token
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="fade-border-t flex items-center gap-4 pt-6">
          <Button
            type="button"
            onClick={() => {
              setUsername("");
              setCurrentPassword("");
              setNewPassword("");
              setBarkUrl("");
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
          {error && <span className="text-sm text-destructive">{error}</span>}
          {message && (
            <span className="text-sm text-primary">{message}</span>
          )}
        </div>
      </form>
    </div>
  );
}
