import type { FormEventHandler } from "react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "@/platform/i18n";

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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
          <UserPlus data-icon="inline-start" />
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
          <FieldGroup className="gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="xiaomi-account">{t("accountField")}</FieldLabel>
              <Input
                id="xiaomi-account"
                value={form.account}
                onChange={(event) => onFormChange({ ...form, account: event.target.value })}
                placeholder={t("accountPlaceholder")}
                required={creating}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="xiaomi-password">{t("passwordField")}</FieldLabel>
              <Input
                id="xiaomi-password"
                type="password"
                value={form.password}
                onChange={(event) => onFormChange({ ...form, password: event.target.value })}
                placeholder={t(creating ? "passwordPlaceholder" : "editPasswordPlaceholder")}
                required={creating}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="xiaomi-nickname">{t("nicknameField")}</FieldLabel>
              <Input
                id="xiaomi-nickname"
                value={form.nickname}
                onChange={(event) => onFormChange({ ...form, nickname: event.target.value })}
                placeholder={t("nicknamePlaceholder")}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
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
