import { FieldApi, FormApi } from "@tanstack/react-form";
import { describe, expect, it, vi } from "vite-plus/test";
import { profileFormOptions, profileSchema } from "./profile-form-options";

describe("profile form validation", () => {
  it("blocks invalid submission and associates Zod errors with each field", async () => {
    const onSubmit = vi.fn();
    const form = new FormApi({ ...profileFormOptions, onSubmit });
    const unmountForm = form.mount();
    const name = new FieldApi({ form, name: "name" });
    const email = new FieldApi({ form, name: "email" });
    const unmountName = name.mount();
    const unmountEmail = email.mount();

    try {
      await form.handleSubmit();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(name.state.meta.isTouched).toBe(true);
      expect(name.state.meta.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "Enter at least 2 characters." }),
        ]),
      );
      expect(email.state.meta.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "Enter a valid email address." }),
        ]),
      );

      name.handleChange("Alex");
      email.handleChange("alex@example.com");
      await form.validateAllFields("change");
      expect(form.state.values).toEqual({ name: "Alex", email: "alex@example.com" });
      await form.handleSubmit();
      expect(onSubmit).toHaveBeenCalledTimes(1);

      form.reset();
      expect(form.state.values).toEqual({ name: "", email: "" });
      expect(name.state.meta.errors).toEqual([]);
      expect(email.state.meta.isTouched).toBe(false);
    } finally {
      unmountName();
      unmountEmail();
      unmountForm();
    }
  });

  it("trims the name when parsing validated submission values", () => {
    expect(profileSchema.parse({ name: "  Alex  ", email: "alex@example.com" })).toEqual({
      name: "Alex",
      email: "alex@example.com",
    });
    expect(profileSchema.safeParse({ name: "   ", email: "alex@example.com" }).success).toBe(false);
  });
});
