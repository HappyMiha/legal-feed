"use client";
import {useI18n} from '../i18n/client';

import type { Locale } from "../i18n/core";
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
  translateOptions=true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  translateOptions?: boolean;
}) {
 const {t:tr,locale}=useI18n();

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
              {translateOptions?tr(l):l}
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
  translateOptions=true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  translateOptions?: boolean;
}) {
 const {t:tr,locale}=useI18n();

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
            <span>{translateOptions?tr(l):l}</span>
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
 const {t:tr,locale}=useI18n();

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
export function formatDate(date: string,locale:Locale="en") {
  if(!Number.isFinite(new Date(date).getTime()))return date;
  return new Intl.DateTimeFormat(locale==="en"?"en-CH":locale,{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(date));
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
