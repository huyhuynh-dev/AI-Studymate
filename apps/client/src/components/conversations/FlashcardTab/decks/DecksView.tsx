"use client";

import { useState } from "react";
import type { Deck, DeckStats } from "../types";
import { DeckCard } from "./DeckCard";
import { DecksToolbar } from "./DecksToolbar";

interface Props {
  decks: Deck[];
  statsByDeck: Record<string, DeckStats>;
  onOpen: (deckId: string) => void;
  onStudy: (deckId: string) => void;
  onCreate: () => void;
  onCreateAi: () => void;
  onEdit: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
}

/** A2 — Thanh công cụ + lưới bộ thẻ chuẩn Apple HIG */
export function DecksView({ decks, statsByDeck, onOpen, onStudy, onCreate, onCreateAi, onEdit, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = decks.filter((d) => d.name.toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-6">
      <DecksToolbar count={decks.length} query={query} onQuery={setQuery} onCreateAi={onCreateAi} onCreate={onCreate} />
      {filtered.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <DeckCard
              key={d.id}
              deck={d}
              stats={statsByDeck[d.id]}
              onOpen={() => onOpen(d.id)}
              onStudy={() => onStudy(d.id)}
              onEdit={() => onEdit(d)}
              onDelete={() => onDelete(d)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/50 dark:bg-white/[0.02] py-14 text-center">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Không tìm thấy bộ thẻ nào khớp “{query}”.
          </p>
        </div>
      )}
    </div>
  );
}
