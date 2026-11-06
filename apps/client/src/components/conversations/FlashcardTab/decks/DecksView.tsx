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

/** A2 — Thanh công cụ + lưới bộ thẻ (3 cột lớn · 2 cột vừa · 1 cột điện thoại) */
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
        <p className="py-16 text-center text-sm text-[#777587]">Không tìm thấy bộ thẻ nào khớp “{query}”.</p>
      )}
    </div>
  );
}
