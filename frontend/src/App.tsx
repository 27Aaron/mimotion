import { useEffect, useMemo, useState } from "react";

import { Toaster } from "@/components/providers/toaster";
import AdminScreen from "@/features/admin/screens/admin-screen";
import InviteScreen from "@/features/invites/screens/invite-screen";
import LoginScreen from "@/features/auth/screens/login-screen";
import SchedulesScreen from "@/features/schedules/screens/schedules-screen";
import SettingsScreen from "@/features/settings/screens/settings-screen";
import XiaomiScreen from "@/features/xiaomi/screens/xiaomi-screen";
import { I18nProvider } from "./runtime/i18n-runtime";
import { currentLocale, navigate, stripLocale } from "./runtime/navigation";
import DashboardShell from "./components/dashboard-shell";
import DashboardScreen from "./screens/dashboard-screen";

interface SessionUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

function LoadingScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="pointer-events-none absolute right-[10%] top-[5%] h-72 w-72 rounded-full bg-primary/[0.06] blur-[90px]" />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        MiMotion
      </div>
    </div>
  );
}

export default function App() {
  const [location, setLocation] = useState(() => window.location.pathname);
  const [session, setSession] = useState<{
    path: string;
    user: SessionUser | null;
  }>({ path: "", user: null });
  const locale = currentLocale();
  const pagePath = stripLocale(location);
  const sessionReady = session.path === pagePath;
  const user = sessionReady ? session.user : null;

  useEffect(() => {
    const update = () => setLocation(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { user?: SessionUser };
        return data.user ?? null;
      })
      .catch(() => null)
      .then((nextUser) => {
        if (cancelled) return;
        setSession({ path: pagePath, user: nextUser });
      });
    return () => {
      cancelled = true;
    };
  }, [pagePath]);

  useEffect(() => {
    if (!sessionReady) return;
    if (pagePath === "/" || pagePath === "") {
      navigate(user ? "/dashboard" : "/login", locale, true);
      return;
    }
    if (pagePath === "/login" && user) {
      navigate("/dashboard", locale, true);
      return;
    }
    if (pagePath !== "/login" && !user) {
      navigate("/login", locale, true);
    }
  }, [locale, pagePath, sessionReady, user]);

  const screen = useMemo(() => {
    switch (pagePath) {
      case "/dashboard":
        return <DashboardScreen />;
      case "/xiaomi":
        return <XiaomiScreen />;
      case "/schedules":
        return <SchedulesScreen />;
      case "/settings":
        return <SettingsScreen />;
      case "/invite":
        return <InviteScreen />;
      case "/admin":
        return user?.isAdmin ? <AdminScreen /> : <DashboardScreen />;
      default:
        return <DashboardScreen />;
    }
  }, [pagePath, user?.isAdmin]);

  return (
    <I18nProvider locale={locale}>
      {!sessionReady ? (
        <LoadingScreen />
      ) : pagePath === "/login" ? (
        <LoginScreen />
      ) : user ? (
        <DashboardShell user={user}>{screen}</DashboardShell>
      ) : (
        <LoadingScreen />
      )}
      <Toaster />
    </I18nProvider>
  );
}
