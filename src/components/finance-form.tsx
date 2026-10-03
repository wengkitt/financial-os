import { useState, useId, useRef } from "react";
import type { ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { useWrite, type Payload } from "@/queries/financial";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
export type Choice = { value: string; label: string };
export type FormField = {
  name: string;
  label: string;
  type?: "text" | "password" | "email" | "date" | "month";
  options?: Choice[];
  help?: string;
  disabled?: boolean;
  autocomplete?: string;
  optional?: boolean;
  segmented?: boolean;
};
export type FormSpec = {
  fields: FormField[];
  changes?: (name: string, value: string, values: Record<string, string>) => Record<string, string>;
  fieldsFor?: (values: Record<string, string>) => FormField[];
  preview?: (values: Record<string, string>) => ReactNode;
  defaults: Record<string, string>;
  schema: z.ZodType<Payload>;
  payload: (values: Record<string, string>) => Payload;
  path: string;
  method?: "POST" | "PATCH";
  submit?: string;
  pendingLabel?: string;
};
export function Pick({
  value,
  onChange,
  onBlur,
  options,
  label,
  id,
  invalid,
  disabled,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: Choice[];
  label: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(v) => onChange(v ?? "")}
      items={options}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={onBlur}
        className="w-full"
      >
        <SelectValue placeholder={label}>
          {options.find((o) => o.value === value)?.label ?? label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
export function FinanceForm({
  spec,
  onSaved,
  onCancel,
  onDirtyChange,
  onPendingChange,
  appearance = "default",
}: {
  spec: FormSpec;
  appearance?: "default" | "auth";
  onSaved?: (message: string, values: Record<string, string>) => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const write = useWrite();
  const prefix = useId();
  const element = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const validator = z.record(z.string(), z.string()).superRefine((values, context) => {
    const result = spec.schema.safeParse(spec.payload(values));
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({ code: "custom", message: issue.message, path: issue.path });
  });
  const form = useForm({
    defaultValues: spec.defaults,
    validators: { onBlur: validator, onChange: validator, onSubmit: validator },
    onSubmit: async ({ value }) => {
      onPendingChange?.(true);
      try {
        const result = await write.mutateAsync({
          path: spec.path,
          method: spec.method,
          payload: spec.schema.parse(spec.payload(value)),
        });
        setMessage(result.message);
        onDirtyChange?.(false);
        onSaved?.(result.message, value);
      } catch {
        /* The mutation supplies its accessible error below. */
      } finally {
        onPendingChange?.(false);
      }
    },
  });
  return (
    <form
      ref={element}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        setExpanded(true);
        void form
          .handleSubmit()
          .then(() =>
            element.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
          );
      }}
      className={
        onCancel ? "editor-form" : appearance === "auth" ? "auth-form" : "flex flex-col gap-5"
      }
    >
      <div className={onCancel ? "editor-fields" : "flex flex-col gap-5"}>
        <form.Subscribe selector={(state) => state.values}>
          {(values) => {
            const fields = spec.fieldsFor?.(values) ?? spec.fields;
            const result = submitted ? spec.schema.safeParse(spec.payload(values)) : null;
            const messages =
              result && !result.success
                ? result.error.issues
                    .filter(
                      (issue) =>
                        issue.path.length === 0 ||
                        !fields.some((field) => field.name === issue.path[0]),
                    )
                    .map((issue) => issue.message)
                : [];
            return (
              <>
                <FieldGroup>
                  {fields
                    .filter((def) => !def.optional || expanded)
                    .map((def) => (
                      <form.Field key={def.name} name={def.name}>
                        {(field) => {
                          const invalid =
                            (field.state.meta.isTouched || submitted) && !field.state.meta.isValid;
                          const id = `${prefix}-${def.name}`;
                          const describedBy =
                            [def.help ? `${id}-help` : "", invalid ? `${id}-error` : ""]
                              .filter(Boolean)
                              .join(" ") || undefined;
                          const Control = def.type === "password" ? InputGroupInput : Input;
                          const input = (
                            <Control
                              id={id}
                              type={
                                def.type === "password" && showPassword
                                  ? "text"
                                  : (def.type ?? "text")
                              }
                              name={def.name}
                              disabled={def.disabled}
                              autoComplete={def.autocomplete}
                              inputMode={
                                [
                                  "amount",
                                  "actualBalance",
                                  "openingBalance",
                                  "exchangeRate",
                                  "sentAmount",
                                  "receivedAmount",
                                  "budget",
                                ].includes(def.name)
                                  ? "decimal"
                                  : undefined
                              }
                              value={field.state.value}
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                                for (const [key, next] of Object.entries(
                                  spec.changes?.(def.name, e.target.value, {
                                    ...values,
                                    [def.name]: e.target.value,
                                  }) ?? {},
                                ))
                                  form.setFieldValue(key, next);
                                onDirtyChange?.(true);
                              }}
                              onBlur={field.handleBlur}
                              aria-invalid={invalid}
                              aria-describedby={describedBy}
                            />
                          );
                          return (
                            <Field data-invalid={invalid} data-disabled={def.disabled}>
                              <FieldLabel htmlFor={id}>{def.label}</FieldLabel>
                              {def.options &&
                              (def.segmented ||
                                ["kind", "status", "mode", "preparation"].includes(def.name)) ? (
                                <ToggleGroup
                                  id={id}
                                  aria-label={def.label}
                                  aria-invalid={invalid}
                                  aria-describedby={describedBy}
                                  value={[field.state.value]}
                                  onValueChange={(selected) => {
                                    const value = selected[0];
                                    if (!value) return;
                                    field.handleChange(value);
                                    for (const [key, next] of Object.entries(
                                      spec.changes?.(def.name, value, {
                                        ...values,
                                        [def.name]: value,
                                      }) ?? {},
                                    ))
                                      form.setFieldValue(key, next);
                                    onDirtyChange?.(true);
                                  }}
                                  onBlur={field.handleBlur}
                                  variant="outline"
                                  spacing={0}
                                  disabled={def.disabled}
                                  className="flex-wrap"
                                >
                                  {def.options.map((option) => (
                                    <ToggleGroupItem key={option.value} value={option.value}>
                                      {option.label}
                                    </ToggleGroupItem>
                                  ))}
                                </ToggleGroup>
                              ) : def.options ? (
                                <Pick
                                  id={id}
                                  label={def.label}
                                  value={field.state.value}
                                  onChange={(value) => {
                                    field.handleChange(value);
                                    for (const [key, next] of Object.entries(
                                      spec.changes?.(def.name, value, {
                                        ...values,
                                        [def.name]: value,
                                      }) ?? {},
                                    ))
                                      form.setFieldValue(key, next);
                                    onDirtyChange?.(true);
                                  }}
                                  onBlur={field.handleBlur}
                                  options={def.options}
                                  invalid={invalid}
                                  disabled={def.disabled}
                                  describedBy={describedBy}
                                />
                              ) : def.type === "password" ? (
                                <InputGroup>
                                  {input}
                                  <InputGroupAddon align="inline-end">
                                    <InputGroupButton
                                      type="button"
                                      size="icon-xs"
                                      aria-label={showPassword ? "Hide password" : "Show password"}
                                      aria-controls={id}
                                      aria-pressed={showPassword}
                                      disabled={def.disabled}
                                      onClick={() => setShowPassword((visible) => !visible)}
                                    >
                                      {showPassword ? <EyeOff /> : <Eye />}
                                    </InputGroupButton>
                                  </InputGroupAddon>
                                </InputGroup>
                              ) : (
                                input
                              )}
                              {def.help && (
                                <FieldDescription id={`${id}-help`}>{def.help}</FieldDescription>
                              )}
                              {invalid && (
                                <FieldError id={`${id}-error`} errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                    ))}
                </FieldGroup>
                {fields.some((def) => def.optional) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? "Hide optional details" : "Notes and optional details"}
                  </Button>
                )}
                {spec.preview?.(values)}
                {!!messages.length && (
                  <Alert variant="destructive">
                    <AlertDescription>{messages.join(" ")}</AlertDescription>
                  </Alert>
                )}
              </>
            );
          }}
        </form.Subscribe>
        {write.isError && (
          <Alert variant="destructive">
            <AlertDescription>{write.error.message}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert role="status">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </div>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <div className={onCancel ? "editor-actions" : "flex gap-2"}>
            {onCancel && (
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={pending}
              className={appearance === "auth" ? "w-full" : undefined}
              size={appearance === "auth" ? "lg" : "default"}
            >
              {pending ? (spec.pendingLabel ?? "Saving…") : (spec.submit ?? "Save changes")}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
