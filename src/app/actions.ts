"use server";

import { getDeps } from "@/lib/waitlist/deps";
import { confirmSignup, signup } from "@/lib/waitlist/service";

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function joinWaitlist(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const result = await signup(Object.fromEntries(formData), getDeps());
    if (!result.ok) {
      return {
        status: "error",
        message:
          "Bitte gib eine gültige E-Mail-Adresse an und stimme der Datenverarbeitung zu.",
      };
    }
    return { status: "success" };
  } catch (err) {
    console.error("waitlist signup failed", err);
    return {
      status: "error",
      message:
        "Das hat leider nicht geklappt. Bitte versuche es später noch einmal.",
    };
  }
}

export async function confirmWaitlist(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length < 20) {
    return { status: "error", message: "Der Bestätigungslink ist ungültig." };
  }
  try {
    const result = await confirmSignup(token, getDeps());
    if (result.ok) return { status: "success" };
    return {
      status: "error",
      message:
        result.error === "expired"
          ? "Der Link ist abgelaufen. Bitte melde dich einfach noch einmal an."
          : "Der Bestätigungslink ist ungültig.",
    };
  } catch (err) {
    console.error("waitlist confirm failed", err);
    return {
      status: "error",
      message:
        "Das hat leider nicht geklappt. Bitte versuche es später noch einmal.",
    };
  }
}
