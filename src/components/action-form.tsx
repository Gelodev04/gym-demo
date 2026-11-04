"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions";

// A <form> that runs a server action and shows its result as a toast.
// Children can read the pending state through the :disabled fieldset.
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          try {
            const result = await action(form);
            if (result?.error) toast.error(result.error);
            else if (result?.message) toast.success(result.message);
            if (result?.redirectTo) router.push(result.redirectTo);
          } catch {
            toast.error("Something went wrong. Check your connection and try again.");
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
