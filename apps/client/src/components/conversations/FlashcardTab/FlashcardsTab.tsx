"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useFocusMode } from "@/components/layout";
import { useCitationNavigation } from "@/contexts/CitationNavigationContext";
import { useWorkspaceContextStore } from "@/contexts/WorkspaceContextProvider";
import { AiGeneratorModal, type AiTarget } from "./ai/AiGeneratorModal";
import { DeckFormModal } from "./decks/DeckFormModal";
import { DecksEmptyState } from "./decks/DecksEmptyState";
import { DecksView } from "./decks/DecksView";
import { DeckDetailView } from "./detail/DeckDetailView";
import { CardEditorModal } from "./editor/CardEditorModal";
import { useDecks } from "@/hooks/useDecks";
import { useFlashcards } from "@/hooks/useFlashcards";
import { flashcardApi } from "@/services/flashcard.api";
import { StudyView } from "./study/StudyView";
import type { AiConfig, AiDocument, CardDraft, Deck, DeckStats, Flashcard } from "./types";
import { ConfirmDialog, cx } from "./ui";

export interface FlashcardsTabProps {
  conversationId?: string;
  /** ID bộ thẻ cần mở trực tiếp (ví dụ khi nhấn Badge từ RightSidebar AI Chat) */
  initialDeckId?: string;
  /** Nonce kích hoạt mở lại bộ thẻ khi nhấn nhiều lần */
  openNonce?: number;
  /** Callback báo cáo ID bộ thẻ đang mở chi tiết (hoặc null khi ở danh sách) */
  onActiveDeckChange?: (deckId: string | null) => void;
  documents?: AiDocument[];
  onUploadDocument?: () => void;
  /** Phiên học đã có tài liệu nguồn chưa (quyết định nút AI ở Empty State) */
  hasDocuments?: boolean;
  className?: string;
}

type View =
  | { name: "decks" }
  | { name: "detail"; deckId: string }
  | { name: "study"; deckId: string; mode: "due" | "extra"; nonce: number };

export default function FlashcardsTab({
  conversationId,
  initialDeckId,
  openNonce,
  onActiveDeckChange,
  documents,
  onUploadDocument,
  hasDocuments = true,
  className,
}: FlashcardsTabProps) {
  const { decks, isLoading: isDecksLoading, createDeck, updateDeck, deleteDeck, refreshDecks } = useDecks(conversationId);
  const [view, setView] = useState<View>({ name: "decks" });
  const [pendingDeckId, setPendingDeckId] = useState<string | null>(null);
  const [handledRequestKey, setHandledRequestKey] = useState<string | null>(null);

  const currentRequestKey = initialDeckId
    ? `${initialDeckId}:${openNonce ?? ""}`
    : null;
  if (currentRequestKey && currentRequestKey !== handledRequestKey && initialDeckId) {
    setHandledRequestKey(currentRequestKey);
    setPendingDeckId(initialDeckId);
    setView({ name: "detail", deckId: initialDeckId });
  }
  const [deckForm, setDeckForm] = useState<{ open: boolean; deck: Deck | null }>({ open: false, deck: null });
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);
  const [cardEditor, setCardEditor] = useState<{ open: boolean; card: Flashcard | null; deckId: string }>({ open: false, card: null, deckId: "" });
  const [cardToDelete, setCardToDelete] = useState<Flashcard | null>(null);
  const [ai, setAi] = useState<AiTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeDeckId = view.name !== "decks" ? view.deckId : undefined;
  const {
    cards: deckCards,
    createCard,
    updateCard,
    deleteCard,
    reviewCard,
    refreshCards,
  } = useFlashcards(activeDeckId);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

  const statsByDeck = useMemo(() => {
    const map: Record<string, DeckStats> = {};
    for (const d of decks) {
      if (d.stats) {
        map[d.id] = d.stats;
      } else {
        map[d.id] = {
          total: 0,
          new: 0,
          learning: 0,
          review: 0,
          dueToday: 0,
        };
      }
    }
    return map;
  }, [decks]);

  const { setFocusMode } = useFocusMode();
  const { sidePanelTarget } = useCitationNavigation();
  const workspaceStore = useWorkspaceContextStore();
  const activeDeck = view.name !== "decks" ? decks.find((d) => d.id === view.deckId) : undefined;
  const activeDeckStats = activeDeck
    ? statsByDeck[activeDeck.id] || activeDeck.stats
    : undefined;

  // Đồng bộ trạng thái Tab Flashcard vào Context Engine Store
  useEffect(() => {
    if (!workspaceStore) return;
    workspaceStore.setTabSlice("flashcard", {
      viewMode: view.name,
      totalDecksCount: decks.length,
      activeDeck: activeDeck
        ? {
            deckId: activeDeck.id,
            deckName: activeDeck.name,
            totalCards: activeDeckStats?.total ?? deckCards.length,
            dueToday: activeDeckStats?.dueToday ?? 0,
          }
        : null,
      studyState:
        view.name === "study"
          ? {
              mode: view.mode,
              progress: 0,
              remaining: deckCards.length,
              isCardRevealed: false,
            }
          : null,
    });
  }, [
    workspaceStore,
    view,
    decks.length,
    activeDeck,
    activeDeckStats?.total,
    activeDeckStats?.dueToday,
    deckCards.length,
  ]);

  useEffect(() => {
    return () => {
      workspaceStore?.clearTabSlice("flashcard");
    };
  }, [workspaceStore]);

  // Báo cáo ID bộ thẻ đang mở để lưu trạng thái xuyên thiết bị (tránh ghi đè lúc đang tải initialDeckId)
  useEffect(() => {
    if (isDecksLoading || pendingDeckId) return;
    if (view.name === "detail" || view.name === "study") {
      if (activeDeck) {
        onActiveDeckChange?.(activeDeck.id);
      } else {
        onActiveDeckChange?.(null);
      }
    } else {
      onActiveDeckChange?.(null);
    }
  }, [view, activeDeck, isDecksLoading, pendingDeckId, onActiveDeckChange]);

  // Đồng bộ Focus Mode: Tự động ẩn thanh tab & header khi vào Chế độ học (study)
  useEffect(() => {
    const isStudying = view.name === "study";
    setFocusMode(isStudying);
    return () => {
      setFocusMode(false);
    };
  }, [view.name, setFocusMode]);

  // Nhấn Escape để thoát Chế độ học (bỏ qua nếu đang mở trình xem nguồn PDF ở RightSidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sidePanelTarget && view.name === "study" && activeDeck) {
        setFocusMode(false);
        refreshDecks();
        setView({ name: "detail", deckId: activeDeck.id });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view.name, activeDeck, sidePanelTarget, setFocusMode, refreshDecks]);

  // Tự động làm mới danh sách và mở trực tiếp chi tiết bộ thẻ khi điều hướng từ Badge trong AI Chat
  useEffect(() => {
    const storedId =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("studymate:open-deck-id")
        : null;
    const targetId = initialDeckId || storedId;
    if (!targetId) return;

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("studymate:open-deck-id");
    }

    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setPendingDeckId(targetId);
        setView({ name: "detail", deckId: targetId });
        return refreshDecks();
      })
      .then((updatedDecks) => {
        if (cancelled) return;
        if (Array.isArray(updatedDecks) && !updatedDecks.some((d) => d.id === targetId)) {
          setView({ name: "decks" });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPendingDeckId((prev) => (prev === targetId ? null : prev));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialDeckId, openNonce, refreshDecks]);

  /* ---------- handlers ---------- */
  const openAi = (target: AiTarget) => (hasDocuments ? setAi(target) : onUploadDocument?.());
  const startStudy = (deckId: string, mode: "due" | "extra") => setView({ name: "study", deckId, mode, nonce: Date.now() });
  const smartStudy = (deckId: string) => {
    const deckStats = statsByDeck[deckId];
    const mode = deckStats && deckStats.dueToday > 0 ? "due" : "extra";
    startStudy(deckId, mode);
  };

  const submitDeck = async (v: { name: string; description: string }) => {
    if (deckForm.deck) {
      await updateDeck(deckForm.deck.id, v);
    } else {
      await createDeck(v);
    }
    refreshDecks();
  };

  const saveCard = async (draft: CardDraft) => {
    if (cardEditor.card) {
      await updateCard(cardEditor.card.id, draft);
    } else {
      await createCard(draft);
    }
    refreshDecks();
  };

  const generateAi = async (cfg: AiConfig) => {
    if (!ai) return;
    if (!conversationId) {
      throw new Error("Không tìm thấy thông tin phiên học.");
    }

    const payload = {
      conversationId,
      target:
        ai.kind === "new"
          ? ({ kind: "new" } as const)
          : ({ kind: "deck", deckId: ai.deckId } as const),
      documentIds: cfg.documentIds ?? "all",
      count: cfg.count,
      types: cfg.types,
      instructions: cfg.instructions,
      deckName: cfg.deckName?.trim() || undefined,
    };

    const res = await flashcardApi.generateWithAi(payload);

    if (ai.kind === "new") {
      await refreshDecks();
      notify(`Đã tạo bộ thẻ với ${res.stats.saved} thẻ ghi nhớ`);
      setView({ name: "detail", deckId: res.deckId });
    } else {
      await Promise.all([refreshCards(), refreshDecks()]);
      notify(`Đã thêm ${res.stats.saved} thẻ vào bộ thẻ`);
    }
  };

  const confirmDeleteDeck = async () => {
    if (!deckToDelete) return;
    await deleteDeck(deckToDelete.id);
    if (view.name !== "decks" && view.deckId === deckToDelete.id) setView({ name: "decks" });
    setDeckToDelete(null);
    refreshDecks();
  };

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;
    await deleteCard(cardToDelete.id);
    setCardToDelete(null);
    refreshDecks();
  };

  /* ---------- màn hình hiện tại ---------- */
  let content;
  if (view.name === "study" && activeDeck) {
    const dueCards = deckCards.filter((c) => c.dueInDays <= 0);
    const studyCards = view.mode === "due" && dueCards.length > 0 ? dueCards : deckCards;
    const ids = studyCards.map((c) => c.id);

    content = (
      <StudyView
        key={`${view.deckId}-${view.mode}-${view.nonce}`}
        initialIds={ids}
        cards={deckCards}
        onPersist={async (c, rating, timeTakenMs) => {
          await reviewCard(c.id, rating, timeTakenMs);
          refreshDecks();
        }}
        onEditCard={(card) => setCardEditor({ open: true, card, deckId: card.deckId })}
        onExit={() => {
          setFocusMode(false);
          refreshDecks();
          setView({ name: "detail", deckId: activeDeck.id });
        }}
        onStudyExtra={() => startStudy(activeDeck.id, "extra")}
      />
    );
  } else if (view.name === "detail" && activeDeck) {
    const fallbackStats: DeckStats = {
      total: deckCards.length,
      new: deckCards.filter((c) => c.status === "new").length,
      learning: deckCards.filter((c) => c.status === "learning" || c.status === "relearning").length,
      review: deckCards.filter((c) => c.status === "review").length,
      dueToday: deckCards.filter((c) => c.dueInDays <= 0).length,
    };

    content = (
      <DeckDetailView
        deck={activeDeck}
        cards={deckCards}
        stats={statsByDeck[activeDeck.id] || activeDeck.stats || fallbackStats}
        onBack={() => {
          refreshDecks();
          setView({ name: "decks" });
        }}
        onEditDeck={() => setDeckForm({ open: true, deck: activeDeck })}
        onStudy={() => smartStudy(activeDeck.id)}
        onAddCard={() => setCardEditor({ open: true, card: null, deckId: activeDeck.id })}
        onAi={() => openAi({ kind: "deck", deckId: activeDeck.id, deckName: activeDeck.name })}
        onEditCard={(card) => setCardEditor({ open: true, card, deckId: card.deckId })}
        onDeleteCard={setCardToDelete}
      />
    );
  } else if (
    isDecksLoading ||
    (view.name === "detail" && !activeDeck && pendingDeckId === view.deckId)
  ) {
    content = (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
          <div className="h-7 w-36 rounded-xl bg-neutral-200/70 dark:bg-white/[0.06]" />
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded-full bg-neutral-200/70 dark:bg-white/[0.06]" />
            <div className="h-9 w-36 rounded-full bg-neutral-200/70 dark:bg-white/[0.06]" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-52 flex-col gap-4 rounded-[22px] border border-black/[0.06] dark:border-white/[0.08] bg-white/60 dark:bg-[#161922]/60 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-[12px] bg-neutral-200/70 dark:bg-white/[0.06]" />
                <div className="h-5 w-2/3 rounded-lg bg-neutral-200/70 dark:bg-white/[0.06]" />
              </div>
              <div className="h-4 w-full rounded-lg bg-neutral-200/50 dark:bg-white/[0.04]" />
              <div className="mt-auto h-1.5 w-full rounded-full bg-neutral-200/70 dark:bg-white/[0.06]" />
              <div className="flex justify-between pt-2">
                <div className="h-4 w-14 rounded-lg bg-neutral-200/70 dark:bg-white/[0.06]" />
                <div className="h-8 w-24 rounded-full bg-neutral-200/70 dark:bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (decks.length === 0) {
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
        decks={decks}
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
      <div className="flex min-h-0 flex-1 flex-col">
        <div key={view.name} className="flex flex-1 flex-col animate-in fade-in duration-200">
          {content}
        </div>
      </div>

      <DeckFormModal open={deckForm.open} deck={deckForm.deck} onClose={() => setDeckForm({ open: false, deck: null })} onSubmit={submitDeck} />
      <CardEditorModal open={cardEditor.open} card={cardEditor.card} onClose={() => setCardEditor((s) => ({ ...s, open: false }))} onSave={saveCard} />
      <AiGeneratorModal target={ai} documents={documents} onClose={() => setAi(null)} onGenerate={generateAi} />

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
        onConfirm={confirmDeleteCard}
        onClose={() => setCardToDelete(null)}
      />

      {toast && (
        <div
          role="status"
          className="apple-liquid-glass pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[110] mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-neutral-900 dark:text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
          {toast}
        </div>
      )}
    </div>
  );
}
