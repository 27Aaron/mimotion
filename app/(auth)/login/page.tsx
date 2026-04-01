"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regInviteCode, setRegInviteCode] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });

    const data = await res.json();
    setLoginLoading(false);

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setLoginError(data.error || "登录失败");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: regEmail,
        password: regPassword,
        inviteCode: regInviteCode,
      }),
    });

    const data = await res.json();
    setRegLoading(false);

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setRegError(data.error || "注册失败");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      {/* Theme toggle */}
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="relative z-10 grid w-full max-w-3xl overflow-hidden rounded-2xl border border-border/50 shadow-2xl md:grid-cols-2">
        {/* Left panel - branding */}
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
              小米运动自动刷步服务。
              <br />
              绑定小米账号，设置定时任务，自动同步步数。
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              {["自动定时刷步", "多账号管理", "执行结果推送通知"].map(
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
              {mode === "login" ? "还没有账号？" : "已有账号？"}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="ml-1 font-medium text-primary hover:underline"
              >
                {mode === "login" ? "去注册" : "去登录"}
              </button>
            </p>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="bg-card p-8">
          {mode === "login" ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight">
                  欢迎回来
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">登录以继续</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">邮箱</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="请输入邮箱"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="请输入密码"
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
                  {loginLoading ? "登录中..." : "登录"}
                </Button>
                <p className="text-center text-sm text-muted-foreground md:hidden">
                  还没有账号？{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="font-medium text-primary hover:underline"
                  >
                    注册
                  </button>
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight">
                  创建账号
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  创建你的账号
                </p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">邮箱</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="请输入邮箱"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">密码</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="请输入密码"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-invite">邀请码</Label>
                  <Input
                    id="reg-invite"
                    type="text"
                    value={regInviteCode}
                    onChange={(e) => setRegInviteCode(e.target.value)}
                    placeholder="请输入邀请码"
                    required
                  />
                </div>
                {regError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {regError}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={regLoading}>
                  {regLoading ? "注册中..." : "注册"}
                </Button>
                <p className="text-center text-sm text-muted-foreground md:hidden">
                  已有账号？{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-medium text-primary hover:underline"
                  >
                    登录
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
