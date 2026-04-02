"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings");
  const tc = useTranslations("common");

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
  const [initialValues, setInitialValues] = useState({
    barkUrl: "",
    telegramBotToken: "",
    telegramChatId: "",
  });

  useEffect(() => {
    let mounted = true;
    fetch("/api/user/settings")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.username) setCurrentUsername(data.username);
        if (data.barkUrl) setBarkUrl(data.barkUrl);
        if (data.telegramBotToken) setTelegramBotToken(data.telegramBotToken);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
        setInitialValues({
          barkUrl: data.barkUrl || "",
          telegramBotToken: data.telegramBotToken || "",
          telegramChatId: data.telegramChatId || "",
        });
      })
      .catch(() => {});
    return () => { mounted = false; };
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
        toast.success(type === "bark" ? t("barkTestSuccess") : t("telegramTestSuccess"));
      } else {
        toast.error(data.error || t("pushTestFailed"));
      }
    } catch {
      toast.error(tc("requestFailed"));
    } finally {
      if (type === "bark") setTestingBark(false);
      else setTestingTelegram(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword && !currentPassword) {
      toast.error(t("passwordRequiredForChange"));
      return;
    }

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
      toast.success(t("settingsSaved"));
      setCurrentPassword("");
      setNewPassword("");
      if (username) {
        setCurrentUsername(username);
        setUsername("");
        window.location.reload();
        return;
      }
      setInitialValues({
        barkUrl: barkUrl || "",
        telegramBotToken: telegramBotToken || "",
        telegramChatId: telegramChatId || "",
      });
    } else {
      toast.error(data.error || t("saveFailed"));
    }
  }

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="page-title">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      {/* User info */}
      <Card className="mb-3">
        <CardContent className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
              {currentUsername ? currentUsername.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold">
                  {currentUsername || tc("loading")}
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  <User className="mr-1 h-3 w-3" />
                  {t("usernameLabel")}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("usernameDesc")}
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
              {t("security")}
            </h2>
            <div className="ml-2 h-px flex-1 bg-border" />
          </div>
          <div className="flex items-center gap-2">
            <div className="section-icon">
              <Bell className="h-3 w-3 text-primary" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("pushNotifications")}
            </h2>
            <div className="ml-2 h-px flex-1 bg-border" />
          </div>
        </div>

        {/* Row 1: Username + Bark */}
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("changeUsername")}</CardTitle>
              </div>
              <CardDescription>{t("changeUsernameDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs">
                  {t("newUsername")}
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("newUsernamePlaceholder")}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("newUsernameHint")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{t("barkPush")}</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingBark || !barkUrl}
                  onClick={(e) => { e.preventDefault(); handleTestPush("bark"); }}
                >
                  {testingBark && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {testingBark ? tc("sending") : tc("testPush")}
                </Button>
              </div>
              <CardDescription>{t("barkPushDesc")}</CardDescription>
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
                {t("barkHint")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Password + Telegram */}
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t("changePassword")}</CardTitle>
              </div>
              <CardDescription>{t("changePasswordDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword" className="text-xs">
                  {t("currentPassword")}
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("currentPasswordPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs">
                  {t("newPassword")}
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("newPasswordPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{t("telegramPush")}</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingTelegram || !telegramBotToken || !telegramChatId}
                  onClick={(e) => { e.preventDefault(); handleTestPush("telegram"); }}
                >
                  {testingTelegram && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {testingTelegram ? tc("sending") : tc("testPush")}
                </Button>
              </div>
              <CardDescription>{t("telegramPushDesc")}</CardDescription>
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
              setBarkUrl(initialValues.barkUrl);
              setTelegramBotToken(initialValues.telegramBotToken);
              setTelegramChatId(initialValues.telegramChatId);
            }}
          >
            {tc("reset")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? tc("saving") : tc("saveSettings")}
          </Button>
        </div>
      </form>
    </div>
  );
}
