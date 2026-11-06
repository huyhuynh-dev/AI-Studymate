"use client";

import { useMemo, useState } from "react";
import type { Deck, DeckStats, Flashcard } from "../types";
import { CardListEmpty } from "./CardListEmpty";
import { CardListToolbar, type StatusFilter, type TypeFilter } from "./CardListToolbar";
import { CardRow } from "./CardRow";
import { DeckOverviewBanner } from "./DeckOverviewBanner";
import { SubNav } from "./SubNav";

interface Props {
  deck: Deck;
  cards: Flashcard[];
  stats: DeckStats;
  onBack: () => void;
  onEditDeck: () => void;
  onStudy: () => void;
  onAddCard: () => void;
  onAi: () => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (card: Flashcard) => void;
}

/** A4 — Chi tiết bộ thẻ: SubNav → Overview → Danh sách thẻ */
export function DeckDetailView({ deck, cards, stats, onBack, onEditDeck, onStudy, onAddCard, onAi, onEditCard, onDeleteCard }: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (type === "all" || c.type === type) &&
        (status === "all" || c.status === status || (status === "learning" && c.status === "relearning")) &&
        (!q || c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q))
    );
  }, [cards, query, type, status]);

  return (
    <div className="flex flex-col gap-5">
      <SubNav deckName={deck.name} onBack={onBack} />
      <DeckOverviewBanner deck={deck} stats={stats} onEdit={onEditDeck} onStudy={onStudy} onAddCard={onAddCard} onAi={onAi} />
      {cards.length === 0 ? (
        <CardListEmpty onCreate={onAddCard} onAi={onAi} />
      ) : (
        <section className="flex flex-col gap-3">
          <CardListToolbar query={query} onQuery={setQuery} type={type} onType={setType} status={status} onStatus={setStatus} />
          {filtered.length ? (
            <div className="flex flex-col gap-2">
              {filtered.map((c) => (
                <CardRow key={c.id} card={c} onEdit={() => onEditCard(c)} onDelete={() => onDeleteCard(c)} />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-[#777587]">Không có thẻ nào phù hợp với bộ lọc.</p>
          )}
        </section>
      )}
    </div>
  );
}
