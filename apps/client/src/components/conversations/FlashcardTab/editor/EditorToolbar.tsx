"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Fragment } from "react";
import type { FormatId } from "../richtext/schema";
import { ToolbarButton } from "../ui/ToolbarButton";
import { FORMAT_REGISTRY, formatShortcut, type FormatDef } from "./formats";

const GROUP_ORDER: FormatDef["group"][] = ["inline", "list", "special"];
type ToolState = Record<string, { active: boolean; enabled: boolean }>;

/** Thanh công cụ tự sinh từ FORMAT_REGISTRY: chỉ cần truyền danh sách `formats` */
export function EditorToolbar({ editor, formats }: { editor: Editor; formats: FormatId[] }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }): ToolState =>
      ed ? Object.fromEntries(formats.map((id) => [id, { active: FORMAT_REGISTRY[id].isActive(ed), enabled: FORMAT_REGISTRY[id].canRun(ed) }])) : {},
  });

  const groups = GROUP_ORDER.map((g) => formats.map((id) => FORMAT_REGISTRY[id]).filter((d) => d.group === g)).filter((g) => g.length);

  return (
    <div role="toolbar" aria-label="Định dạng văn bản" className="flex flex-wrap items-center gap-0.5 p-1.5">
      {groups.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/[0.1]" />}
          {group.map((def) => {
            const s = state[def.id];
            const Icon = def.icon;
            return (
              <ToolbarButton
                key={def.id}
                label={def.label}
                title={def.shortcut ? `${def.label} (${formatShortcut(def.shortcut)})` : def.label}
                active={s?.active}
                disabled={!s?.enabled}
                onClick={() => def.run(editor)}
                className={def.showLabel ? "px-2.5" : undefined}
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
                {def.showLabel && <span className="text-xs font-semibold">{def.label}</span>}
              </ToolbarButton>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
