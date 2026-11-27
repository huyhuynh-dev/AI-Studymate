import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpsertWorkspaceStateResult } from './domain/workspace-state.types.js';
import type {
  AtomicUpsertInput,
  ChildEntityRefs,
  StoredWorkspaceStateRecord,
  VerifiedChildEntityRefs,
  WorkspaceStateRepositoryPort,
} from './workspace-state.repository.port.js';

interface AtomicUpsertRow {
  location_applied: boolean | null;
  layout_applied: boolean | null;
}

@Injectable()
export class PrismaWorkspaceStateRepository
  implements WorkspaceStateRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
  ): Promise<StoredWorkspaceStateRecord | null> {
    const row = await this.prisma.userWorkspaceState.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        schema_version: true,
        location_json: true,
        location_source_id: true,
        location_seq: true,
        layout_json: true,
        layout_source_id: true,
        layout_seq: true,
      },
    });

    if (!row) return null;

    return {
      userId: row.user_id,
      schemaVersion: row.schema_version,
      locationJson: row.location_json,
      locationSourceId: row.location_source_id,
      locationSeq: row.location_seq,
      layoutJson: row.layout_json,
      layoutSourceId: row.layout_source_id,
      layoutSeq: row.layout_seq,
    };
  }

  /**
   * Ghi nguyên tử theo từng nhóm (`location` và `layout`) trong một câu lệnh SQL duy nhất.
   * An toàn khi:
   * - Hai request đầu tiên của user mới chạy đồng thời (ON CONFLICT DO UPDATE).
   * - Retry trùng hoặc request đến ngược thứ tự từ cùng một sourceId.
   */
  async upsertGroupsAtomic(
    input: AtomicUpsertInput,
  ): Promise<UpsertWorkspaceStateResult> {
    const hasLocation = input.location !== undefined;
    const hasLayout = input.layout !== undefined;
    const locationJsonStr = hasLocation ? JSON.stringify(input.location) : null;
    const layoutJsonStr = hasLayout ? JSON.stringify(input.layout) : null;

    const rows = await this.prisma.$queryRaw<AtomicUpsertRow[]>`
      WITH prev AS (
        SELECT
          user_id,
          location_source_id,
          location_seq,
          layout_source_id,
          layout_seq
        FROM user_workspace_states
        WHERE user_id = ${input.userId}::uuid
      ),
      upserted AS (
        INSERT INTO user_workspace_states (
          user_id,
          schema_version,
          location_json,
          location_source_id,
          location_seq,
          location_updated_at,
          layout_json,
          layout_source_id,
          layout_seq,
          layout_updated_at,
          created_at,
          updated_at
        )
        VALUES (
          ${input.userId}::uuid,
          ${input.schemaVersion}::int,
          CASE WHEN ${hasLocation}::boolean THEN ${locationJsonStr}::jsonb ELSE NULL END,
          CASE WHEN ${hasLocation}::boolean THEN ${input.sourceId}::varchar(64) ELSE NULL END,
          CASE WHEN ${hasLocation}::boolean THEN ${input.seq}::int ELSE 0 END,
          CASE WHEN ${hasLocation}::boolean THEN NOW() ELSE NULL END,
          CASE WHEN ${hasLayout}::boolean THEN ${layoutJsonStr}::jsonb ELSE NULL END,
          CASE WHEN ${hasLayout}::boolean THEN ${input.sourceId}::varchar(64) ELSE NULL END,
          CASE WHEN ${hasLayout}::boolean THEN ${input.seq}::int ELSE 0 END,
          CASE WHEN ${hasLayout}::boolean THEN NOW() ELSE NULL END,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          schema_version = EXCLUDED.schema_version,
          location_json = CASE
            WHEN ${hasLocation}::boolean AND NOT (
              user_workspace_states.location_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.location_seq >= ${input.seq}::int
            )
            THEN ${locationJsonStr}::jsonb
            ELSE user_workspace_states.location_json
          END,
          location_source_id = CASE
            WHEN ${hasLocation}::boolean AND NOT (
              user_workspace_states.location_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.location_seq >= ${input.seq}::int
            )
            THEN ${input.sourceId}::varchar(64)
            ELSE user_workspace_states.location_source_id
          END,
          location_seq = CASE
            WHEN ${hasLocation}::boolean AND NOT (
              user_workspace_states.location_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.location_seq >= ${input.seq}::int
            )
            THEN ${input.seq}::int
            ELSE user_workspace_states.location_seq
          END,
          location_updated_at = CASE
            WHEN ${hasLocation}::boolean AND NOT (
              user_workspace_states.location_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.location_seq >= ${input.seq}::int
            )
            THEN NOW()
            ELSE user_workspace_states.location_updated_at
          END,
          layout_json = CASE
            WHEN ${hasLayout}::boolean AND NOT (
              user_workspace_states.layout_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.layout_seq >= ${input.seq}::int
            )
            THEN ${layoutJsonStr}::jsonb
            ELSE user_workspace_states.layout_json
          END,
          layout_source_id = CASE
            WHEN ${hasLayout}::boolean AND NOT (
              user_workspace_states.layout_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.layout_seq >= ${input.seq}::int
            )
            THEN ${input.sourceId}::varchar(64)
            ELSE user_workspace_states.layout_source_id
          END,
          layout_seq = CASE
            WHEN ${hasLayout}::boolean AND NOT (
              user_workspace_states.layout_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.layout_seq >= ${input.seq}::int
            )
            THEN ${input.seq}::int
            ELSE user_workspace_states.layout_seq
          END,
          layout_updated_at = CASE
            WHEN ${hasLayout}::boolean AND NOT (
              user_workspace_states.layout_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
              AND user_workspace_states.layout_seq >= ${input.seq}::int
            )
            THEN NOW()
            ELSE user_workspace_states.layout_updated_at
          END,
          updated_at = NOW()
        RETURNING user_id
      )
      SELECT
        CASE
          WHEN NOT ${hasLocation}::boolean THEN NULL
          WHEN p.user_id IS NULL THEN TRUE
          WHEN NOT (
            p.location_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
            AND p.location_seq >= ${input.seq}::int
          ) THEN TRUE
          ELSE FALSE
        END AS location_applied,
        CASE
          WHEN NOT ${hasLayout}::boolean THEN NULL
          WHEN p.user_id IS NULL THEN TRUE
          WHEN NOT (
            p.layout_source_id IS NOT DISTINCT FROM ${input.sourceId}::varchar(64)
            AND p.layout_seq >= ${input.seq}::int
          ) THEN TRUE
          ELSE FALSE
        END AS layout_applied
      FROM upserted u
      LEFT JOIN prev p ON p.user_id = u.user_id
    `;

    const row = rows[0];
    return {
      ...(hasLocation
        ? { locationApplied: Boolean(row?.location_applied) }
        : {}),
      ...(hasLayout ? { layoutApplied: Boolean(row?.layout_applied) } : {}),
    };
  }

  async verifyOwnedSubject(
    userId: string,
    subjectId: string,
  ): Promise<boolean> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, user_id: userId },
      select: { id: true },
    });
    return subject !== null;
  }

  async findOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ readonly id: string; readonly subjectId: string } | null> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, user_id: userId },
      select: { id: true, subject_id: true },
    });
    if (!conv) return null;
    return { id: conv.id, subjectId: conv.subject_id };
  }

  async verifyConversationChildren(
    conversationId: string,
    refs: ChildEntityRefs,
  ): Promise<VerifiedChildEntityRefs> {
    const [doc, summary, deck, quiz, chatSession] = await Promise.all([
      refs.docId
        ? this.prisma.document.findFirst({
            where: { id: refs.docId, conversation_id: conversationId },
            select: { id: true },
          })
        : Promise.resolve(null),
      refs.summaryId
        ? this.prisma.summary.findFirst({
            where: { id: refs.summaryId, conversation_id: conversationId },
            select: { id: true },
          })
        : Promise.resolve(null),
      refs.deckId
        ? this.prisma.flashcardDeck.findFirst({
            where: { id: refs.deckId, conversation_id: conversationId },
            select: { id: true },
          })
        : Promise.resolve(null),
      refs.quizId
        ? this.prisma.quiz.findFirst({
            where: { id: refs.quizId, conversation_id: conversationId },
            select: { id: true },
          })
        : Promise.resolve(null),
      refs.chatSessionId
        ? this.prisma.chatSession.findFirst({
            where: { id: refs.chatSessionId, conversation_id: conversationId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      docValid: doc !== null,
      summaryValid: summary !== null,
      deckValid: deck !== null,
      quizValid: quiz !== null,
      chatSessionValid: chatSession !== null,
    };
  }
}
