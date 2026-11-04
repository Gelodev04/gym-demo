"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import { checkIn, type CheckinResult } from "../actions";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const STATUS_STYLE = {
  active: "bg-plate-green text-white",
  expiring: "bg-plate-yellow text-ink",
  expired: "bg-plate-red text-white",
};

export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const lastToken = useRef("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [pending, start] = useTransition();

  function submit(token: string, override = false) {
    start(async () => setResult(await checkIn(token.trim(), override)));
  }

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    function tick() {
      const v = video.current;
      if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        // Same QR held in front of the camera shouldn't check in twice.
        if (code?.data && code.data !== lastToken.current) {
          lastToken.current = code.data;
          setTimeout(() => (lastToken.current = ""), 5000);
          submit(code.data);
        }
      }
      frame = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        video.current!.srcObject = s;
        frame = requestAnimationFrame(tick);
      })
      .catch(() => setCameraError("Camera is blocked or missing. Allow camera access, or type the member code below."));

    return () => {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const r = result?.ok ? result : null;
  const m = r?.member;
  return (
    <div className="space-y-4 md:max-h-full md:overflow-y-auto">
      {m && (
        // key forces the landing animation on every new scan
        <div key={`${m.id}-${r!.recorded}`} role="status" className={`land flex items-center gap-5 rounded-md p-5 ${STATUS_STYLE[m.status]}`}>
          {m.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photo_url} alt="" className="h-32 w-32 shrink-0 rounded-md object-cover ring-4 ring-white/60" />
          ) : (
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md bg-white/25 font-display text-6xl font-bold">
              {m.name[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-5xl font-bold leading-none">{m.name}</p>
            <p className="mt-2 text-xl font-medium">
              {m.status === "expired"
                ? m.end_date
                  ? `Membership ended ${fmtDate(m.end_date)}`
                  : "No active membership"
                : m.days_left === 0
                  ? "Last day today. Remind them to renew."
                  : `${m.days_left} day${m.days_left === 1 ? "" : "s"} left, until ${fmtDate(m.end_date!)}`}
            </p>
            {r!.recorded ? (
              <p className="mt-2 text-lg font-semibold">Checked in</p>
            ) : (
              <Button size="lg" variant="outline" className="mt-3 border-white bg-white font-semibold text-plate-red" onClick={() => submit(m.qr_token, true)} disabled={pending}>
                Let in anyway (owner will see this)
              </Button>
            )}
          </div>
        </div>
      )}
      {result && !result.ok && (
        <Card role="alert" className="land edge-expired px-4">
          {result.error}. Ask the member to open their card, or search them on Members.
        </Card>
      )}

      <Card>
        <CardContent>
        <video ref={video} autoPlay playsInline muted className="aspect-video max-h-[40dvh] w-full rounded-md bg-rubber object-cover" />
        {cameraError ? (
          <p className="mt-2 text-sm text-plate-red">{cameraError}</p>
        ) : (
          <p className="muted mt-2">Hold the member&apos;s QR in front of the camera.</p>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget).get("token") as string);
          }}
        >
          <label htmlFor="token" className="sr-only">Member code</label>
          <Input id="token" name="token" placeholder="Or type the member code" />
          <Button disabled={pending}>Check in</Button>
        </form>
        </CardContent>
      </Card>
    </div>
  );
}
