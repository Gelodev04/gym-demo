"use client";

import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMember, enterKiosk } from "../actions";

const peso = (n: number) => "₱" + n.toLocaleString("en-PH");

export function NewMemberForm({ plans }: { plans: { id: string; name: string; price: number }[] }) {
  return (
    <Card className="order-first h-fit md:order-none md:max-h-full md:overflow-y-auto">
      <CardHeader>
        <CardTitle>New member</CardTitle>
        <CardDescription>Type it in for them, or hand them the tablet.</CardDescription>
        <form action={enterKiosk}>
          <Button variant="outline" className="mt-2 w-full">
            Let the member fill it in
          </Button>
        </form>
      </CardHeader>
      <CardContent>
        <ActionForm action={addMember} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <Input id="phone" name="phone" placeholder="09171234567" inputMode="tel" pattern="(09|\+639)\d{9}" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="photo">Photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" capture="user" className="pt-2.5 text-sm" />
            <p className="muted">Shown at check-in so staff can confirm it&apos;s them.</p>
          </div>
          <div className="space-y-1.5">
            <Label>First payment</Label>
            <Select name="plan_id" defaultValue="later">
              <SelectTrigger className="w-full" aria-label="First payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="later">Pay later</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} now, {peso(p.price)} cash
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Checkbox id="consent" name="consent" required className="mt-0.5" />
            <Label htmlFor="consent" className="leading-snug font-normal">
              Member agrees to storing their name, phone, and photo for gym membership use.
            </Label>
          </div>
          <Button className="w-full">Add member</Button>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
