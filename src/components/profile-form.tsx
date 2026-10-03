import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  profileFormOptions,
  profileSchema,
  type ProfileValues,
} from "@/forms/profile-form-options";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ProfileForm() {
  const [preview, setPreview] = useState<ProfileValues | null>(null);
  const form = useForm({
    ...profileFormOptions,
    onSubmit: ({ value }) => {
      // Standard Schema validation does not apply Zod transforms to form values.
      setPreview(profileSchema.parse(value));
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Profile form example</CardTitle>
        <CardDescription>
          Validate your name and email to preview your profile. This demo stays in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          id="profile-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="profile-name">Name</FieldLabel>
                    <Input
                      id="profile-name"
                      name={field.name}
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={80}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        setPreview(null);
                        field.handleChange(event.target.value);
                      }}
                      aria-invalid={isInvalid}
                      aria-describedby={
                        isInvalid ? "profile-name-help profile-name-error" : "profile-name-help"
                      }
                    />
                    <FieldDescription id="profile-name-help">
                      Use 2 to 80 characters.
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError id="profile-name-error" errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="email">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                    <Input
                      id="profile-email"
                      name={field.name}
                      type="email"
                      autoComplete="email"
                      required
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        setPreview(null);
                        field.handleChange(event.target.value);
                      }}
                      aria-invalid={isInvalid}
                      aria-describedby={isInvalid ? "profile-email-error" : undefined}
                    />
                    {isInvalid && (
                      <FieldError id="profile-email-error" errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>
        </form>
        {preview && (
          <Alert role="status">
            <AlertTitle>Profile validated</AlertTitle>
            <AlertDescription>
              {preview.name} — {preview.email}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Field orientation="horizontal">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset();
              setPreview(null);
            }}
          >
            Reset
          </Button>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" form="profile-form" disabled={isSubmitting}>
                Validate profile
              </Button>
            )}
          </form.Subscribe>
        </Field>
      </CardFooter>
    </Card>
  );
}
