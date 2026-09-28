"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
export { Button };
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Choices({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <RadioGroup
        aria-label={label}
        value={value}
        onValueChange={onChange}
        className="choice-group"
      >
        {options.map(([v, l]) => (
          <label className={`choice ${value === v ? "selected" : ""}`} key={v}>
            <RadioGroupItem value={v} />
            <span>{l}</span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  destructive = false,
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  if (destructive)
    return (
      <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {children}
        </AlertDialogContent>
      </AlertDialog>
    );
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function formatDate(date: string) {
  return date.slice(0, 10).split("-").reverse().join(".");
}
export const frequencies: [string, string][] = [
  ["instant", "Instant alerts"],
  ["weekly", "Weekly digest"],
  ["both", "Both"],
];
export const sections: [string, string][] = [
  ["government_federal", "Government — Federal"],
  ["government_cantonal", "Government — Cantonal"],
  ["non_government", "Non-government"],
  ["signal", "Signals"],
];
