"use client";

import type { FormEventHandler } from "react";
import { IconUserPlus } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { XiaomiAccountFormValue } from "@/features/xiaomi/model";

interface XiaomiAccountDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  form: XiaomiAccountFormValue;
  onFormChange: (value: XiaomiAccountFormValue) => void;
  error?: string;
  loading: boolean;
}

export function XiaomiAccountDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  form,
  onFormChange,
  error,
  loading,
}: XiaomiAccountDialogProps) {
  const t = useTranslations("xiaomi");
  const tc = useTranslations("common");
  const creating = mode === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {creating && (
        <DialogTrigger render={<Button />}>
          <IconUserPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" />
          {t("addAccount")}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(creating ? "addAccountTitle" : "editAccount")}</DialogTitle>
          <DialogDescription>
            {t(creating ? "addAccountDesc" : "editAccountDesc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("accountField")}</Label>
              <Input
                value={form.account}
                onChange={(event) => onFormChange({ ...form, account: event.target.value })}
                placeholder={t("accountPlaceholder")}
                required={creating}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("passwordField")}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => onFormChange({ ...form, password: event.target.value })}
                placeholder={t(creating ? "passwordPlaceholder" : "editPasswordPlaceholder")}
                required={creating}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("nicknameField")}</Label>
              <Input
                value={form.nickname}
                onChange={(event) => onFormChange({ ...form, nickname: event.target.value })}
                placeholder={t("nicknamePlaceholder")}
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? tc(creating ? "adding" : "saving")
                : tc(creating ? "add" : "save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
