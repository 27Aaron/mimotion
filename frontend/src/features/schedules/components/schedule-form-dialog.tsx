import type { FormEventHandler } from "react";
import { CalendarPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { XiaomiAccountOption } from "@/features/schedules/client";
import type { ScheduleFormValue } from "@/features/schedules/model";

interface ScheduleFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  form: ScheduleFormValue;
  onFormChange: (value: ScheduleFormValue) => void;
  accounts: XiaomiAccountOption[];
  error: string;
  loading: boolean;
}

export function ScheduleFormDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  form,
  onFormChange,
  accounts,
  error,
  loading,
}: ScheduleFormDialogProps) {
  const t = useTranslations("schedules");
  const tc = useTranslations("common");
  const creating = mode === "create";
  const dayOptions = [
    { value: "1", label: t("daysMon") },
    { value: "2", label: t("daysTue") },
    { value: "3", label: t("daysWed") },
    { value: "4", label: t("daysThu") },
    { value: "5", label: t("daysFri") },
    { value: "6", label: t("daysSat") },
    { value: "0", label: t("daysSun") },
  ];

  const selectedAccount = accounts.find((account) => account.id === form.xiaomiAccountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {creating && (
        <DialogTrigger render={<Button />}>
          <CalendarPlus data-icon="inline-start" />
          {t("createTask")}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(creating ? "createTaskTitle" : "editTaskTitle")}</DialogTitle>
          <DialogDescription>
            {t(creating ? "createTaskDesc" : "editTaskDesc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup className="gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="schedule-account">{t("xiaomiAccount")}</FieldLabel>
              <Select
                value={form.xiaomiAccountId}
                onValueChange={(value) => onFormChange({
                  ...form,
                  xiaomiAccountId: value ?? "",
                })}
              >
                <SelectTrigger id="schedule-account" className="w-full">
                  <span className="flex-1 truncate text-left">
                    {form.xiaomiAccountId
                      ? selectedAccount?.nickname || selectedAccount?.account || form.xiaomiAccountId
                      : t("selectAccount")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.nickname || account.account || account.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("executionTime")}</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={String(form.hour)}
                  onValueChange={(value) => onFormChange({
                    ...form,
                    hour: Number.parseInt(value ?? "0"),
                  })}
                >
                  <SelectTrigger id="schedule-hour" className="w-full">
                    <span className="flex-1 text-left">
                      {String(form.hour).padStart(2, "0")} {t("hour")}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {String(hour).padStart(2, "0")} {t("hour")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(form.minute)}
                  onValueChange={(value) => onFormChange({
                    ...form,
                    minute: Number.parseInt(value ?? "0"),
                  })}
                >
                  <SelectTrigger id="schedule-minute" className="w-full">
                    <span className="flex-1 text-left">
                      {String(form.minute).padStart(2, "0")} {t("minute")}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 60 }, (_, minute) => (
                      <SelectItem key={minute} value={String(minute)}>
                        {String(minute).padStart(2, "0")} {t("minute")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Field>

            <Field>
              <FieldLabel>{t("repeatDays")}</FieldLabel>
              <ToggleGroup
                multiple
                value={form.days}
                onValueChange={(days) => onFormChange({ ...form, days })}
                className="w-full flex-wrap"
                spacing={1}
                aria-label={t("repeatDays")}
              >
                {dayOptions.map((day) => (
                  <ToggleGroupItem key={day.value} value={day.value} size="sm">
                    {day.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="schedule-min-steps">{t("minSteps")}</FieldLabel>
                <Input
                  id="schedule-min-steps"
                  type="number"
                  value={form.minStep}
                  onChange={(event) => onFormChange({
                    ...form,
                    minStep: Math.max(0, Number.parseInt(event.target.value) || 0),
                  })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-max-steps">{t("maxSteps")}</FieldLabel>
                <Input
                  id="schedule-max-steps"
                  type="number"
                  value={form.maxStep}
                  onChange={(event) => onFormChange({
                    ...form,
                    maxStep: Math.max(0, Number.parseInt(event.target.value) || 0),
                  })}
                  required
                />
              </Field>
            </div>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? tc(creating ? "creating" : "saving")
                : tc(creating ? "create" : "save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
