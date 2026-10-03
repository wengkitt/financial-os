import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(80, "Use 80 characters or fewer."),
  email: z.email("Enter a valid email address."),
});

export type ProfileValues = z.infer<typeof profileSchema>;

export const profileFormOptions = formOptions({
  defaultValues: { name: "", email: "" } satisfies z.input<typeof profileSchema>,
  validators: {
    onChange: profileSchema,
    onSubmit: profileSchema,
  },
});
