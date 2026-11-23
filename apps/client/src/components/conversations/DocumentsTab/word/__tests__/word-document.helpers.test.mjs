import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCX_MIME_TYPE,
  LEGACY_DOC_MIME_TYPE,
  ODT_MIME_TYPE,
  buildCitationSearchQueries,
  buildSuperDocUser,
  getGoogleDocsSourceUrl,
  isDocxDocument,
  isGoogleDocsImported,
  isLegacyWordOrOdtDocument,
  stripExtensionForExport,
  validateGoogleDocsUrlClient,
} from '../word-document.helpers.ts';

describe('word-document.helpers', () => {
  it('nhận diện chính xác tệp DOCX, DOC/ODT và nguồn Google Docs', () => {
    assert.equal(
      isDocxDocument({ mime_type: DOCX_MIME_TYPE, file_name: 'bao-cao.docx' }),
      true,
    );
    assert.equal(
      isDocxDocument({ mime_type: 'application/octet-stream', file_name: 'FINAL.DOCX' }),
      true,
    );
    assert.equal(
      isDocxDocument({ mime_type: LEGACY_DOC_MIME_TYPE, file_name: 'cu.doc' }),
      false,
    );

    assert.equal(
      isLegacyWordOrOdtDocument({ mime_type: LEGACY_DOC_MIME_TYPE, file_name: 'cu.doc' }),
      true,
    );
    assert.equal(
      isLegacyWordOrOdtDocument({ mime_type: ODT_MIME_TYPE, file_name: 'notes.odt' }),
      true,
    );
    assert.equal(
      isLegacyWordOrOdtDocument({ mime_type: DOCX_MIME_TYPE, file_name: 'new.docx' }),
      false,
    );

    const gdocItem = {
      doc_metadata: {
        source_type: 'google_docs',
        source_url: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit',
      },
    };
    assert.equal(isGoogleDocsImported(gdocItem), true);
    assert.equal(
      getGoogleDocsSourceUrl(gdocItem),
      'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit',
    );
    assert.equal(isGoogleDocsImported({ doc_metadata: {} }), false);
  });

  it('kiểm tra hợp lệ liên kết Google Docs ở phía client', () => {
    assert.equal(
      validateGoogleDocsUrlClient(
        'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit?usp=sharing',
      ).valid,
      true,
    );
    assert.equal(
      validateGoogleDocsUrlClient('http://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQr/edit')
        .valid,
      false,
    );
    assert.equal(
      validateGoogleDocsUrlClient(
        'https://docs.google.com/document/d/e/2PACX-1vLongTokenHere/pub',
      ).valid,
      false,
    );
  });

  it('tạo truy vấn định vị trích dẫn SuperDoc từ quoteExact/rawContent và headings', () => {
    const queries = buildCitationSearchQueries({
      quoteExact: '## Định lý Newton\n**Gia tốc** tỷ lệ thuận với hợp lực tác dụng lên vật.',
      rawContent: 'Nội dung dự phòng',
      headings: ['Chương 2', 'Động lực học Newton'],
    });

    assert.equal(queries.length >= 2, true);
    assert.equal(
      queries.some((q) => q.includes('Gia tốc tỷ lệ thuận với hợp lực')),
      true,
    );
    assert.equal(queries[queries.length - 1], 'Động lực học Newton');
  });

  it('xây dựng hồ sơ người dùng SuperDoc và tách đuôi file khi export', () => {
    assert.deepEqual(
      buildSuperDocUser({
        id: 'u-1',
        name: 'Minh Anh',
        email: 'minhanh@example.com',
      }),
      { id: 'u-1', name: 'Minh Anh', email: 'minhanh@example.com' },
    );
    assert.deepEqual(buildSuperDocUser(null), {
      id: 'studymate-user',
      name: 'Học viên StudyMate',
      email: 'student@studymate.local',
    });

    assert.equal(stripExtensionForExport('De cuong on thi.DOCX'), 'De cuong on thi');
    assert.equal(stripExtensionForExport('notes'), 'notes');
  });
});
