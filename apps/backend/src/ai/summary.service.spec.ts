import { SummaryService } from './summary.service.js';

describe('SummaryService', () => {
  it('normalizes JSON and markdown responses through the preserved parser', () => {
    const service = new SummaryService({} as never);
    const parsed = (service as never as {
      parseSummaryJson: (text: string) => {
        title: string;
        blocks: Array<{ id: string; type: string }>;
      };
    }).parseSummaryJson('# Tiêu đề\n\n- Ý chính');

    expect(parsed.title).toBe('Tiêu đề');
    expect(parsed.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'heading' }),
        expect.objectContaining({ type: 'bulletListItem' }),
      ]),
    );
    expect(parsed.blocks.every((block) => block.id)).toBe(true);
  });
});
