"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { LockIcon } from "lucide-react";
import { toast } from "sonner";
import { Selfie } from "@/components/selfie";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exitKiosk, kioskSignup } from "../actions";

const RESET_SECONDS = 10;

export function KioskForm({ gymName, prices }: { gymName: string; prices: string[] }) {
  // Bumping `round` remounts the form, wiping everything the last person typed.
  const [round, setRound] = useState(0);
  const [welcomed, setWelcomed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const next = useCallback(() => {
    setWelcomed(null);
    setRound((r) => r + 1);
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col p-4 md:p-8">
      <header className="mb-6">
        <h1 className="heading text-4xl">Join {gymName}</h1>
        <p className="mt-1 text-muted-foreground">Fill this in, then pay at the front desk.</p>
      </header>

      {welcomed ? (
        <Welcome name={welcomed} prices={prices} onDone={next} />
      ) : (
        <Card>
          <CardContent>
            <form
              key={round}
              autoComplete="off"
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                start(async () => {
                  const result = await kioskSignup(form);
                  if (result?.error) toast.error(result.error);
                  else if (result?.message) setWelcomed(result.message);
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-base">Full name</Label>
                <Input id="name" name="name" className="h-14 text-lg" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-base">Mobile number</Label>
                <Input id="phone" name="phone" placeholder="09171234567" inputMode="tel" pattern="(09|\+639)\d{9}" className="h-14 text-lg" required />
                <p className="muted">We text you when your membership is about to end.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-base">Your photo</Label>
                <Selfie name="photo" />
                <p className="muted">Staff use it to recognize you at check-in.</p>
              </div>
              <div className="flex gap-3">
                <Checkbox id="consent" name="consent" required className="mt-1 size-5" />
                <Label htmlFor="consent" className="text-base leading-snug font-normal">
                  I agree that {gymName} stores my name, mobile number, and photo for my membership.
                </Label>
              </div>
              <Button size="lg" className="h-14 w-full text-lg" disabled={pending}>
                {pending ? "Saving…" : "Sign up"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <ExitButton />
    </div>
  );
}

function Welcome({ name, prices, onDone }: { name: string; prices: string[]; onDone: () => void }) {
  const [left, setLeft] = useState(RESET_SECONDS);
  useEffect(() => {
    if (left <= 0) return onDone();
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);

  return (
    <Card className="land border-plate-green text-center">
      <CardContent className="space-y-3 py-6">
        <p className="heading text-4xl text-plate-green">Thanks, {name}!</p>
        <p className="text-lg">Please go to the front desk to pay. Cash or GCash.</p>
        <ul className="text-muted-foreground">
          {prices.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Button variant="outline" onClick={onDone}>
          Next person ({left})
        </Button>
      </CardContent>
    </Card>
  );
}

function ExitButton() {
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();

  return (
    <AlertDialog onOpenChange={() => setPin("")}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-auto self-center pt-8 text-muted-foreground">
          <LockIcon /> Staff: exit sign-up
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await exitKiosk(pin);
              if (result?.error) {
                toast.error(result.error);
                setPin("");
              // Full page load so the nav bar (hidden in kiosk mode) renders its links again.
              } else if (result?.redirectTo) window.location.assign(result.redirectTo);
            });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Staff PIN</AlertDialogTitle>
            <AlertDialogDescription>Enter any staff PIN to go back to the staff screens.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Staff PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="my-4 h-14 text-center font-display text-3xl tracking-[0.5em]"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button disabled={pending || !pin}>Unlock</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
