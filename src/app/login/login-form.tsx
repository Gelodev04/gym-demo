"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { login } from "../actions";

export function LoginForm({ staff }: { staff: { id: string; name: string; role: string }[] }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Select name="staff_id" defaultValue={staff[0]?.id} required>
          <SelectTrigger className="w-full" aria-label="Name">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.role === "owner" ? "owner" : "front desk"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          autoComplete="off"
          inputMode="numeric"
          className="h-14 text-center font-display text-3xl tracking-[0.5em]"
          required
          autoFocus
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button className="w-full" size="lg" disabled={pending}>
        Log in
      </Button>
    </form>
  );
}
