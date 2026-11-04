"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Live front-camera photo that lands in a normal <input type="file" name={name}>,
// so the surrounding <form> submits it like any upload. Resized to keep uploads small.
// Falls back to a plain file picker when there's no camera.
export function Selfie({ name }: { name: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [noCamera, setNoCamera] = useState(false);

  useEffect(() => {
    if (preview) return;
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setNoCamera(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [preview]);

  function snap() {
    const v = video.current!;
    const scale = Math.min(1, 480 / v.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth * scale;
    canvas.height = v.videoHeight * scale;
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const files = new DataTransfer();
        files.items.add(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        input.current!.files = files.files;
        setPreview(canvas.toDataURL("image/jpeg"));
      },
      "image/jpeg",
      0.8,
    );
  }

  function retake() {
    input.current!.value = "";
    setPreview(null);
  }

  if (noCamera) return <Input name={name} type="file" accept="image/*" capture="user" className="pt-2.5 text-sm" />;

  return (
    <div className="space-y-2">
      <input ref={input} name={name} type="file" accept="image/*" hidden />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Your photo" className="aspect-[4/3] w-full rounded-lg object-cover" />
      ) : (
        <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full -scale-x-100 rounded-lg bg-rubber object-cover" />
      )}
      {preview ? (
        <Button type="button" variant="outline" className="w-full" onClick={retake}>
          <RotateCcwIcon /> Retake photo
        </Button>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={snap}>
          <CameraIcon /> Take photo
        </Button>
      )}
    </div>
  );
}
