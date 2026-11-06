"use client";

import { useEffect, useRef, useState } from "react";
import { RATING_ORDER } from "../constants";
import { useStudySession } from "../hooks/useStudySession";
import type { Flashcard, Rating } from "../types";
import { Button } from "../ui";
import { BasicCard } from "./cards/BasicCard";
import { ClozeCard } from "./cards/ClozeCard";
import { TypeInCard } from "./cards/TypeInCard";
import { RatingBar } from "./RatingBar";
import { SessionSummary } from "./SessionSummary";
import { StudyHeader } from "./StudyHeader";

interface Props {
  initialIds: string[];
  cards: Flashcard[];
  onPersist: (card: Flashcard, rating: Rating) => void;
  onEditCard: (card: Flashcard) => void;
  onExit: () => void;
  onStudyExtra: () => void;
}

/** B3 — Chế độ học tập trung: header · sân khấu thẻ · khu nút hành động/đánh giá */
export function StudyView({ initialIds, cards, onPersist, onEditCard, onExit, onStudyExtra }: Props) {
  const session = useStudySession(initialIds, cards, onPersist);
  const [typed, setTyped] = useState("");
  const { current, revealed } = session;

  const handleRate = (r: Rating) => {
    session.rate(r);
    setTyped("");
  };

  // Phím tắt: Space/Enter = hiện đáp án (hoặc "Tốt" khi đã lật) · 1–4 = đánh giá
  const actions = useRef({ revealed, reveal: session.reveal, rate: handleRate });
  useEffect(() => {
    actions.current = { revealed, reveal: session.reveal, rate: handleRate };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const a = actions.current;
      const isConfirm = e.code === "Space" || e.key === "Enter";
      if (!a.revealed) {
        if (isConfirm) {
          e.preventDefault();
          a.reveal();
        }
        return;
      }
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0) a.rate(RATING_ORDER[idx]);
      else if (isConfirm) {
        e.preventDefault();
        a.rate("good");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (session.finished) {
    return <SessionSummary {...session.summary} onBack={onExit} onExtra={onStudyExtra} />;
  }
  if (!current) return null;

  const face =
    current.type === "basic" ? (
      <BasicCard card={current} revealed={revealed} onReveal={session.reveal} />
    ) : current.type === "cloze" ? (
      <ClozeCard card={current} revealed={revealed} onReveal={session.reveal} />
    ) : (
      <TypeInCard card={current} revealed={revealed} value={typed} onChange={setTyped} onSubmit={session.reveal} />
    );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <StudyHeader progress={session.progress} remaining={session.remaining} onExit={onExit} onEdit={() => onEditCard(current)} />
      <div key={`${current.id}-${session.progress}`} className="flex flex-1 items-center justify-center animate-in fade-in slide-in-from-right-6 duration-500">
        {face}
      </div>
      <div className="flex min-h-[88px] items-start justify-center pb-2">
        {revealed ? (
          <RatingBar card={current} onRate={handleRate} />
        ) : (
          <Button variant="primary" size="lg" className="min-w-56" onClick={session.reveal}>
            {current.type === "typein" ? "Kiểm tra đáp án" : "Hiện đáp án"}
          </Button>
        )}
      </div>
    </div>
  );
}
