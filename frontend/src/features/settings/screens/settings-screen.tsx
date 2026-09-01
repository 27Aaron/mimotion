"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "@/platform/i18n";
import { useLocale } from "@/platform/i18n";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeading } from "@/components/layout/section-heading";
export default function SettingsScreen() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();

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
      if (data.sessionInvalidated) {
        toast.success(t("settingsSaved"));
        setTimeout(() => { window.location.href = `/${locale}/login`; }, 1500);
        return;
      }
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
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      {/* User info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-card text-base font-bold text-primary">
              {currentUsername ? currentUsername.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold">
                  {currentUsername || tc("loading")}
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  <User data-icon="inline-start" />
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section headers */}
        <div className="grid gap-3 lg:grid-cols-2">
          <SectionHeading icon={Shield}>{t("security")}</SectionHeading>
          <SectionHeading icon={Bell}>{t("pushNotifications")}</SectionHeading>
        </div>

        {/* Row 1: Username + Bark */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="size-4 text-primary" />
                <CardTitle className="text-base">{t("changeUsername")}</CardTitle>
              </div>
              <CardDescription>{t("changeUsernameDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="username">
                    {t("newUsername")}
                  </FieldLabel>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("newUsernamePlaceholder")}
                  />
                  <FieldDescription>{t("newUsernameHint")}</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-primary" />
                  <CardTitle className="text-base">{t("barkPush")}</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingBark || !barkUrl}
                  onClick={(e) => { e.preventDefault(); handleTestPush("bark"); }}
                >
                  {testingBark && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  {testingBark ? tc("sending") : tc("testPush")}
                </Button>
              </div>
              <CardDescription>{t("barkPushDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="barkUrl">
                    Bark URL
                  </FieldLabel>
                  <Input
                    id="barkUrl"
                    type="url"
                    value={barkUrl}
                    onChange={(e) => setBarkUrl(e.target.value)}
                    placeholder="https://api.day.app/yourkey"
                  />
                  <FieldDescription>{t("barkHint")}</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Password + Telegram */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Key className="size-4 text-primary" />
                <CardTitle className="text-base">{t("changePassword")}</CardTitle>
              </div>
              <CardDescription>{t("changePasswordDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="currentPassword">
                    {t("currentPassword")}
                  </FieldLabel>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t("currentPasswordPlaceholder")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="newPassword">
                    {t("newPassword")}
                  </FieldLabel>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("newPasswordPlaceholder")}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-primary" />
                  <CardTitle className="text-base">{t("telegramPush")}</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingTelegram || !telegramBotToken || !telegramChatId}
                  onClick={(e) => { e.preventDefault(); handleTestPush("telegram"); }}
                >
                  {testingTelegram && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  {testingTelegram ? tc("sending") : tc("testPush")}
                </Button>
              </div>
              <CardDescription>{t("telegramPushDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="telegramBotToken">
                    Bot Token
                  </FieldLabel>
                  <Input
                    id="telegramBotToken"
                    type="text"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="123456:ABC-DEF..."
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="telegramChatId">
                    Chat ID
                  </FieldLabel>
                  <Input
                    id="telegramChatId"
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="123456789"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
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
            {loading && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {loading ? tc("saving") : tc("saveSettings")}
          </Button>
        </div>
      </form>
    </div>
  );
}
