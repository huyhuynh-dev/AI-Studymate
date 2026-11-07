# Thay đổi trong page.tsx

```diff
-import FlashcardsTab from "@/components/conversations/FlashcardsTab";
+import FlashcardsTab from "@/components/conversations/FlashcardTab";
```

```diff
           {activeTab === "flashcard" && (
             <FlashcardsTab
               onUploadDocument={handleGoToDocuments}
+              hasDocuments={documents.length > 0}
               className="w-full flex-1"
             />
           )}
```
