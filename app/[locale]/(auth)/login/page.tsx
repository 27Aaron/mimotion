"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AuthPageWrapper() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  );
}

function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [mode, setMode] = useState<"login" | "register">("login");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regInviteCode, setRegInviteCode] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setRegInviteCode(code);
      setMode("register");
    }
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setLoginError(data.error || t("loginFailed"));
      }
    } catch {
      setLoginError(te("networkError"));
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          inviteCode: regInviteCode,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setRegError(data.error || t("registerFailed"));
      }
    } catch {
      setRegError(te("networkError"));
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="absolute right-6 top-6 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 grid w-full max-w-3xl overflow-hidden rounded-2xl border border-border/50 shadow-2xl md:grid-cols-2">
        {/* Brand */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 md:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
                <Footprints className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-mono text-xl font-bold tracking-tight">
                <span className="text-primary">Mi</span>Motion
              </span>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              {t("brandDesc1")}
              <br />
              {t("brandDesc2")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              {[t("feature1"), t("feature2"), t("feature3")].map(
                (text) => (
                  <div
                    key={text}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {text}
                  </div>
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground/50">
              {mode === "login" ? t("noAccount") : t("hasAccount")}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="ml-1 font-medium text-primary hover:underline"
              >
                {mode === "login" ? t("goRegister") : t("goLogin")}
              </button>
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-card p-8">
          {mode === "login" ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t("welcomeBack")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("loginToContinue")}</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">{t("username")}</Label>
                  <Input
                    id="login-username"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder={t("enterUsername")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t("password")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={t("enterPassword")}
                    required
                  />
                </div>
                {loginError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {loginError}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginLoading}
                >
                  {loginLoading ? t("loggingIn") : t("login")}
                </Button>
                <p className="text-center text-sm text-muted-foreground md:hidden">
                  {t("noAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="font-medium text-primary hover:underline"
                  >
                    {t("goRegister")}
                  </button>
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t("createAccount")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("createYourAccount")}
                </p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">{t("username")}</Label>
                  <Input
                    id="reg-username"
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder={t("enterUsername")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{t("password")}</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder={t("enterPassword")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-invite">{t("inviteCode")}</Label>
                  <Input
                    id="reg-invite"
                    type="text"
                    value={regInviteCode}
                    onChange={(e) => setRegInviteCode(e.target.value)}
                    placeholder={t("enterInviteCode")}
                    required
                  />
                </div>
                {regError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {regError}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={regLoading}>
                  {regLoading ? t("registering") : t("register")}
                </Button>
                <p className="text-center text-sm text-muted-foreground md:hidden">
                  {t("hasAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-medium text-primary hover:underline"
                  >
                    {t("goLogin")}
                  </button>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
