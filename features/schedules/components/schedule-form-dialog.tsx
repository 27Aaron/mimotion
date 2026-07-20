"use client";

import type { FormEventHandler } from "react";
import { IconCalendarPlus } from "@tabler/icons-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
          <IconCalendarPlus className="mr-1.5 h-4 w-4 stroke-[1.5]" />
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("xiaomiAccount")}</Label>
              <Select
                value={form.xiaomiAccountId}
                onValueChange={(value) => onFormChange({
                  ...form,
                  xiaomiAccountId: value ?? "",
                })}
              >
                <SelectTrigger className="w-full">
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
            </div>

            <div className="space-y-2">
              <Label>{t("executionTime")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={String(form.hour)}
                  onValueChange={(value) => onFormChange({
                    ...form,
                    hour: Number.parseInt(value ?? "0"),
                  })}
                >
                  <SelectTrigger className="w-full">
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
                  <SelectTrigger className="w-full">
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
            </div>

            <div className="space-y-2">
              <Label>{t("repeatDays")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {dayOptions.map((day) => {
                  const selected = form.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => onFormChange({
                        ...form,
                        days: selected
                          ? form.days.filter((value) => value !== day.value)
                          : [...form.days, day.value],
                      })}
                      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("minSteps")}</Label>
                <Input
                  type="number"
                  value={form.minStep}
                  onChange={(event) => onFormChange({
                    ...form,
                    minStep: Math.max(0, Number.parseInt(event.target.value) || 0),
                  })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("maxSteps")}</Label>
                <Input
                  type="number"
                  value={form.maxStep}
                  onChange={(event) => onFormChange({
                    ...form,
                    maxStep: Math.max(0, Number.parseInt(event.target.value) || 0),
                  })}
                  required
                />
              </div>
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
                ? tc(creating ? "creating" : "saving")
                : tc(creating ? "create" : "save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
