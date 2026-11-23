"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import {
  BlockSchema,
  DefaultBlockSchema,
  DefaultInlineContentSchema,
  DefaultStyleSchema,
  InlineContentSchema,
  StyleSchema,
  filenameFromURL,
} from "@blocknote/core";
import {
  type FilePanelProps,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
} from "@blocknote/react";
import type { NoteMediaKind } from "@/types";
import { validateEmbedUrl, validateUploadFile } from "./noteMediaUtils";

export const NoteMediaCallbackContext = createContext<(() => void) | undefined>(
  undefined,
);

function resolveExpectedMediaKind(blockType: string): NoteMediaKind {
  if (
    blockType === "image" ||
    blockType === "video" ||
    blockType === "audio" ||
    blockType === "file"
  ) {
    return blockType;
  }
  return "file";
}

interface NoteUploadTabProps extends FilePanelProps {
  setLoading: (loading: boolean) => void;
}

function NoteUploadTab({ blockId, setLoading }: NoteUploadTabProps) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const onMediaCommitted = useContext(NoteMediaCallbackContext);

  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >();

  const block = editor.getBlock(blockId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      setErrorMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (file === null) {
        return;
      }

      const currentBlock = editor.getBlock(blockId);
      if (!currentBlock) {
        return;
      }

      const expectedKind = resolveExpectedMediaKind(currentBlock.type);
      const validation = validateUploadFile(file, expectedKind);
      if (!validation.valid) {
        setErrorMessage(validation.error);
        return;
      }

      setErrorMessage(null);

      async function upload(targetFile: File) {
        if (editor.uploadFile === undefined) {
          return;
        }

        setLoading(true);
        try {
          let updateData = await editor.uploadFile(targetFile, blockId);
          if (!editor.getBlock(blockId)) {
            return;
          }

          if (typeof updateData === "string") {
            updateData = {
              props: {
                name: targetFile.name,
                url: updateData,
              },
            };
          }

          editor.updateBlock(
            blockId,
            updateData as unknown as Parameters<typeof editor.updateBlock>[1],
          );

          setTimeout(() => {
            onMediaCommitted?.();
          }, 50);
        } catch (err: unknown) {
          const message =
            err instanceof Error && err.message
              ? err.message
              : dict.file_panel.upload.upload_error;
          setErrorMessage(message);
        } finally {
          setLoading(false);
        }
      }

      void upload(file);
    },
    [
      blockId,
      dict.file_panel.upload.upload_error,
      editor,
      onMediaCommitted,
      setLoading,
    ],
  );

  if (!block) {
    return null;
  }

  const spec = editor.schema.blockSpecs[block.type];
  const fileAcceptList = spec?.implementation.meta.fileBlockAccept;
  const accept =
    Array.isArray(fileAcceptList) && fileAcceptList.length > 0
      ? fileAcceptList.join(",")
      : "*/*";

  return (
    <Components.FilePanel.TabPanel className="bn-tab-panel">
      <Components.FilePanel.FileInput
        className="bn-file-input"
        data-test="upload-input"
        accept={accept}
        placeholder={
          dict.file_panel.upload.file_placeholder[block.type] ||
          dict.file_panel.upload.file_placeholder["file"]
        }
        value={null}
        onChange={handleFileChange}
      />
      {errorMessage && (
        <div
          role="alert"
          className="bn-error-text mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600"
        >
          {errorMessage}
        </div>
      )}
    </Components.FilePanel.TabPanel>
  );
}

function ValidatedEmbedTab({ blockId }: FilePanelProps) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const onMediaCommitted = useContext(NoteMediaCallbackContext);

  const editor = useBlockNoteEditor<
    DefaultBlockSchema,
    DefaultInlineContentSchema,
    DefaultStyleSchema
  >();

  const block = editor.getBlock(blockId);

  const [currentURL, setCurrentURL] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleURLChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setCurrentURL(event.currentTarget.value);
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!editor.getBlock(blockId)) {
      return;
    }

    const validation = validateEmbedUrl(currentURL);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setErrorMessage(null);
    editor.updateBlock(blockId, {
      props: {
        name: filenameFromURL(validation.normalizedUrl),
        url: validation.normalizedUrl,
      },
    } as unknown as Parameters<typeof editor.updateBlock>[1]);

    setTimeout(() => {
      onMediaCommitted?.();
    }, 50);
  }, [blockId, currentURL, editor, onMediaCommitted]);

  if (!block) {
    return null;
  }

  return (
    <Components.FilePanel.TabPanel className="bn-tab-panel">
      <Components.Generic.Form.Root
        onSubmit={handleSubmit}
        submitButton={
          <Components.FilePanel.Button
            className="bn-button"
            type="submit"
            data-test="embed-input-button"
          >
            {dict.file_panel.embed.embed_button[block.type] ||
              dict.file_panel.embed.embed_button["file"]}
          </Components.FilePanel.Button>
        }
      >
        <Components.FilePanel.TextInput
          className="bn-text-input"
          placeholder={dict.file_panel.embed.url_placeholder}
          value={currentURL}
          onChange={handleURLChange}
          data-test="embed-input"
        />
      </Components.Generic.Form.Root>

      {errorMessage && (
        <div
          role="alert"
          className="bn-error-text mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600"
        >
          {errorMessage}
        </div>
      )}
    </Components.FilePanel.TabPanel>
  );
}

/**
 * FilePanel tùy chỉnh cho BlockNote: hỗ trợ Upload trực tiếp lên R2 và Nhúng URL có kiểm tra hợp lệ.
 */
export function NoteMediaFilePanel(props: FilePanelProps) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >();

  const [loading, setLoading] = useState<boolean>(false);

  const tabs = [
    ...(editor.uploadFile !== undefined
      ? [
          {
            name: dict.file_panel.upload.title,
            tabPanel: (
              <NoteUploadTab blockId={props.blockId} setLoading={setLoading} />
            ),
          },
        ]
      : []),
    {
      name: dict.file_panel.embed.title,
      tabPanel: <ValidatedEmbedTab blockId={props.blockId} />,
    },
  ];

  const [openTab, setOpenTab] = useState<string>(() => tabs[0].name);

  return (
    <Components.FilePanel.Root
      className="bn-panel"
      defaultOpenTab={openTab}
      openTab={openTab}
      setOpenTab={setOpenTab}
      tabs={tabs}
      loading={loading}
    />
  );
}
