CREATE INDEX document_chunks_content_pgroonga_idx
ON document_chunks
USING pgroonga (content);