"use client";

import { ImagePlus, Music, X } from "lucide-react";
import { useRef } from "react";
import { Button, IconButton } from "../ui";

interface Props {
  imageUrl?: string;
  audioUrl?: string;
  onImage: (url?: string) => void;
  onAudio: (url?: string) => void;
}

/** B1 — Đính kèm hình ảnh / âm thanh (hiện thumbnail & trình nghe thử) */
export function MediaAttach({ imageUrl, audioUrl, onImage, onAudio }: Props) {
  const imgRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | undefined, cb: (url?: string) => void) => file && cb(URL.createObjectURL(file));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<ImagePlus className="h-4 w-4" />} onClick={() => imgRef.current?.click()}>
          Đính kèm hình ảnh
        </Button>
        <Button size="sm" icon={<Music className="h-4 w-4" />} onClick={() => audioRef.current?.click()}>
          Đính kèm âm thanh
        </Button>
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0], onImage); e.target.value = ""; }} />
        <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { pick(e.target.files?.[0], onAudio); e.target.value = ""; }} />
      </div>

      {imageUrl && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Hình đính kèm" className="h-20 w-20 rounded-xl object-cover" />
          <button type="button" aria-label="Gỡ hình ảnh" onClick={() => onImage(undefined)} className="absolute -right-2 -top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[#0B1C30] text-white shadow-md transition-transform active:scale-90">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {audioUrl && (
        <div className="flex items-center gap-2">
          <audio controls src={audioUrl} className="h-9 flex-1" />
          <IconButton label="Gỡ âm thanh" onClick={() => onAudio(undefined)}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
