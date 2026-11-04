"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { voidPayment } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function VoidButton({ paymentId, summary }: { paymentId: string; summary: string }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">
          Void
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void {summary}?</AlertDialogTitle>
          <AlertDialogDescription>
            The payment stays in the records with a line through it. If it paid for a membership, the days it added are taken back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep payment</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            variant="solidDestructive"
            onClick={() =>
              start(async () => {
                const form = new FormData();
                form.set("payment_id", paymentId);
                const result = await voidPayment(form);
                if (result?.message) toast.success(result.message);
              })
            }
          >
            Void payment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
