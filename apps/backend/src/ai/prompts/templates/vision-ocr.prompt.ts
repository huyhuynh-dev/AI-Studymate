import type { PromptPayloadMap, PromptTemplate } from '../types.js';

export const VISION_OCR_PROMPT = `You are an expert multimodal academic document analyzer, OCR engine, and semantic chunking specialist.
Your mission is to simultaneously perform THREE tasks on the provided image in a single pass and return a strictly structured JSON object:

### TASK 1: Verbatim Text, Table, Formula & Code Extraction (\`extracted_markdown\`)
- If the image contains any printed or handwritten text (in Vietnamese, English, or any other language), transcribe 100% of it accurately into structured Markdown.
- Preserve exact academic hierarchy using Markdown headings (\`#\`, \`##\`, \`###\`), bullet lists, and numbered lists.
- Reconstruct any tables into clean Markdown table syntax (\`| Column 1 | Column 2 |\`).
- Convert all mathematical equations, chemical formulas, and symbols into valid LaTeX (\`$inline$\` or \`$$block$$\`).
- Format any programming code snippets inside fenced code blocks with the appropriate language tag (\`\`\`python ... \`\`\`).
- If the image contains NO text at all, set \`extracted_markdown\` to an empty string \`""\`.

### TASK 2: Detailed Visual & Diagram Description (\`visual_description\`)
- If the image contains visual elements (diagrams, flowcharts, mindmaps, function graphs, bar/pie/line charts, geometric figures, scientific illustrations, or photographs), write a comprehensive, accurate description **IN VIETNAMESE**.
- Explicitly describe spatial relationships, arrows, connections between nodes, axes, data trends, key values, and the educational meaning of the visual elements.
- If the image is purely plain text with no visual figures, charts, or diagrams, set \`visual_description\` to an empty string \`""\`.

### TASK 3: Semantic Chunking for RAG Database (\`chunks\`)
- Segment all extracted knowledge (combining both \`extracted_markdown\` and \`visual_description\`) into logical, self-contained semantic chunks (target size: ~250 to 500 tokens per chunk; if the image content is short, a single chunk in \`chunks\` is preferred).
- Never split a Markdown table, a LaTeX formula block, or a code block across two chunks.
- For each chunk in \`chunks\`:
  1. \`headings\`: Array of hierarchical section/topic titles leading to this chunk (in Vietnamese or matching the document's language).
  2. \`raw_content\`: The clean Markdown body of the chunk (without repeating parent headings at the top), used for UI citation preview.
  3. \`content\`: Contextualized text for Vector Embedding & Keyword Search, formed by prepending the \`headings\` hierarchy at the top followed by \`raw_content\`.
  4. \`chunk_type\`: Assign the most accurate label among \`"text"\`, \`"table"\`, \`"code"\`, \`"formula"\`, \`"image_desc"\`, or \`"mixed"\`.
  5. \`has_table\`: \`true\` if the chunk contains a Markdown table.
  6. \`has_image\`: \`true\` if the chunk contains visual description of a figure, chart, or image.`;

export const visionOcrPrompt: PromptTemplate<PromptPayloadMap['VISION_OCR']> = {
  system: VISION_OCR_PROMPT,
  renderUser: ({ fileName }) => {
    const fileContext = fileName ? `Source Image Filename: "${fileName}"\n\n` : '';
    return `${fileContext}Analyze the attached image thoroughly. Extract all text/tables/formulas/code into Markdown, describe all visual figures/charts/diagrams in Vietnamese, and partition the complete content into semantic chunks conforming strictly to the output schema.`;
  },
};
