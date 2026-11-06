"use client";

import { useMemo, useState } from "react";
import { AiGeneratorModal, type AiTarget } from "./ai/AiGeneratorModal";
import { buildAiCards } from "./data/demoData";
import { DeckFormModal } from "./decks/DeckFormModal";
import { DecksEmptyState } from "./decks/DecksEmptyState";
import { DecksView } from "./decks/DecksView";
import { DeckDetailView } from "./detail/DeckDetailView";
import { CardEditorModal } from "./editor/CardEditorModal";
import { useFlashcardStore } from "./hooks/useFlashcardStore";
import { StudyView } from "./study/StudyView";
import type { AiConfig, CardDraft, Deck, Flashcard } from "./types";
import { AmbientGlow, ConfirmDialog, cx } from "./ui";
import { getDeckStats } from "./utils/srs";

export interface FlashcardsTabProps {
  onUploadDocument?: () => void;
  /** Phiên học đã có tài liệu nguồn chưa (quyết định nút AI ở Empty State) */
  hasDocuments?: boolean;
  className?: string;
}

type View =
  | { name: "decks" }
  | { name: "detail"; deckId: string }
  | { name: "study"; deckId: string; mode: "due" | "extra"; nonce: number };

export default function FlashcardsTab({ onUploadDocument, hasDocuments = true, className }: FlashcardsTabProps) {
  const store = useFlashcardStore();
  const [view, setView] = useState<View>({ name: "decks" });
  const [deckForm, setDeckForm] = useState<{ open: boolean; deck: Deck | null }>({ open: false, deck: null });
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);
  const [cardEditor, setCardEditor] = useState<{ open: boolean; card: Flashcard | null; deckId: string }>({ open: false, card: null, deckId: "" });
  const [cardToDelete, setCardToDelete] = useState<Flashcard | null>(null);
  const [ai, setAi] = useState<AiTarget | null>(null);

  const statsByDeck = useMemo(
    () => Object.fromEntries(store.decks.map((d) => [d.id, getDeckStats(store.cards.filter((c) => c.deckId === d.id))])),
    [store.decks, store.cards]
  );

  const activeDeck = view.name !== "decks" ? store.decks.find((d) => d.id === view.deckId) : undefined;
  const deckCards = activeDeck ? store.cards.filter((c) => c.deckId === activeDeck.id) : [];

  /* ---------- handlers ---------- */
  const openAi = (target: AiTarget) => (hasDocuments ? setAi(target) : onUploadDocument?.());
  const startStudy = (deckId: string, mode: "due" | "extra") => setView({ name: "study", deckId, mode, nonce: Date.now() });
  const smartStudy = (deckId: string) => startStudy(deckId, statsByDeck[deckId]?.dueToday > 0 ? "due" : "extra");

  const submitDeck = (v: { name: string; description: string }) => {
    if (deckForm.deck) store.updateDeck(deckForm.deck.id, v);
    else store.createDeck(v);
  };

  const saveCard = (draft: CardDraft) => {
    if (cardEditor.card) store.updateCard(cardEditor.card.id, draft);
    else store.addCard(cardEditor.deckId, draft);
  };

  const generateAi = (cfg: AiConfig) => {
    if (!ai) return;
    const drafts = buildAiCards(cfg);
    if (ai.kind === "new") {
      const deck = store.createDeck({ name: cfg.deckName?.trim() || "Bộ thẻ AI", description: "Được tạo tự động từ tài liệu của bạn." });
      store.addCards(deck.id, drafts);
      setView({ name: "detail", deckId: deck.id });
    } else store.addCards(ai.deckId, drafts);
  };

  const confirmDeleteDeck = () => {
    if (!deckToDelete) return;
    store.deleteDeck(deckToDelete.id);
    if (view.name !== "decks" && view.deckId === deckToDelete.id) setView({ name: "decks" });
    setDeckToDelete(null);
  };

  /* ---------- màn hình hiện tại ---------- */
  let content;
  if (view.name === "study" && activeDeck) {
    const ids = (view.mode === "due" ? deckCards.filter((c) => c.dueInDays <= 0) : deckCards).map((c) => c.id);
    content = (
      <StudyView
        key={`${view.deckId}-${view.mode}-${view.nonce}`}
        initialIds={ids}
        cards={store.cards}
        onPersist={(c) => store.updateCard(c.id, c)}
        onEditCard={(card) => setCardEditor({ open: true, card, deckId: card.deckId })}
        onExit={() => setView({ name: "detail", deckId: activeDeck.id })}
        onStudyExtra={() => startStudy(activeDeck.id, "extra")}
      />
    );
  } else if (view.name === "detail" && activeDeck) {
    content = (
      <DeckDetailView
        deck={activeDeck}
        cards={deckCards}
        stats={statsByDeck[activeDeck.id]}
        onBack={() => setView({ name: "decks" })}
        onEditDeck={() => setDeckForm({ open: true, deck: activeDeck })}
        onStudy={() => smartStudy(activeDeck.id)}
        onAddCard={() => setCardEditor({ open: true, card: null, deckId: activeDeck.id })}
        onAi={() => openAi({ kind: "deck", deckId: activeDeck.id, deckName: activeDeck.name })}
        onEditCard={(card) => setCardEditor({ open: true, card, deckId: card.deckId })}
        onDeleteCard={setCardToDelete}
      />
    );
  } else if (store.decks.length === 0) {
    content = (
      <DecksEmptyState
        hasDocuments={hasDocuments}
        onCreateManual={() => setDeckForm({ open: true, deck: null })}
        onCreateAi={() => openAi({ kind: "new" })}
        onUploadDocument={onUploadDocument}
      />
    );
  } else {
    content = (
      <DecksView
        decks={store.decks}
        statsByDeck={statsByDeck}
        onOpen={(deckId) => setView({ name: "detail", deckId })}
        onStudy={smartStudy}
        onCreate={() => setDeckForm({ open: true, deck: null })}
        onCreateAi={() => openAi({ kind: "new" })}
        onEdit={(deck) => setDeckForm({ open: true, deck })}
        onDelete={setDeckToDelete}
      />
    );
  }

  return (
    <div className={cx("relative isolate flex min-h-0 w-full flex-1 flex-col", className)}>
      <AmbientGlow />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
        <div key={view.name} className="flex flex-1 flex-col animate-in fade-in slide-in-from-bottom-1 duration-300">
          {content}
        </div>
      </div>

      <DeckFormModal open={deckForm.open} deck={deckForm.deck} onClose={() => setDeckForm({ open: false, deck: null })} onSubmit={submitDeck} />
      <CardEditorModal open={cardEditor.open} card={cardEditor.card} onClose={() => setCardEditor((s) => ({ ...s, open: false }))} onSave={saveCard} />
      <AiGeneratorModal target={ai} onClose={() => setAi(null)} onGenerate={generateAi} />

      <ConfirmDialog
        open={!!deckToDelete}
        title="Xóa bộ thẻ này?"
        description="Toàn bộ thẻ ghi nhớ và tiến độ học tập bên trong sẽ bị xóa vĩnh viễn và không thể khôi phục."
        confirmLabel="Xóa vĩnh viễn"
        onConfirm={confirmDeleteDeck}
        onClose={() => setDeckToDelete(null)}
      />
      <ConfirmDialog
        open={!!cardToDelete}
        title="Xóa thẻ này?"
        description="Thẻ và tiến độ học của nó sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa thẻ"
        onConfirm={() => {
          if (cardToDelete) store.deleteCard(cardToDelete.id);
          setCardToDelete(null);
        }}
        onClose={() => setCardToDelete(null)}
      />
    </div>
  );
}
