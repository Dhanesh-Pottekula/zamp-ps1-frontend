import type { InputHTMLAttributes, ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/error-note";
import { cn } from "@/lib/utils";

export const INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40";

export function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function blank(value: string): boolean {
  return value.trim() === "";
}

export function focusFirstInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  labelClassName?: string;
}

export function Field({ id, label, error, hint, className, labelClassName, ...props }: FieldProps) {
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={cn("relative min-w-0 space-y-1", className)}>
      <label htmlFor={id} className={cn("block text-xs font-medium text-slate-700", labelClassName)}>
        {label}
      </label>
      <input
        id={id}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={INPUT_CLASS}
        {...props}
      />
      {note && (
        <p id={noteId} className={cn("text-xs", error ? "text-red-700" : "text-slate-500")}>
          {note}
        </p>
      )}
    </div>
  );
}

export interface PickerProps {
  id: string;
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  className?: string;
}

export function Picker({ id, label, placeholder, options, onPick, className }: PickerProps) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value=""
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
        className={INPUT_CLASS}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormFooter({ formId, busy, label, serverError, icon }: { formId: string; busy: boolean; label: string; serverError: string | null; icon?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (icon ?? <Plus className="h-3.5 w-3.5" />)}
        {label}
      </Button>
      <div id={`${formId}-server-error`} className="min-w-0 flex-1">
        <ErrorNote message={serverError} />
      </div>
    </div>
  );
}
