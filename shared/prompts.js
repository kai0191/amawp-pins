// Prompts for the AI copywriter, shared by the Worker and the browser.
export function pinCopyPrompt({ topic, link, headline, board, keywords, tone }) {
  return [
    'You are a Pinterest SEO copywriter. Write copy for ONE Pinterest pin.',
    topic && `Topic: ${topic}`,
    headline && `Pin headline on the image: ${headline}`,
    link && `Destination URL: ${link}`,
    board && `Board: ${board}`,
    keywords && `Keywords to include naturally: ${keywords}`,
    `Tone: ${tone || 'helpful, warm, clear'}`,
    'Rules: title max 90 characters; description 220-450 characters, keyword-rich natural sentences,',
    'no hashtags, no emojis, end with a soft call to action; alt_text max 400 characters describing the image',
    'for screen readers; boards: 3 short board name ideas.',
    'Reply ONLY with minified JSON: {"title":"","description":"","alt_text":"","boards":["","",""]}',
  ].filter(Boolean).join('\n');
}

export function headlinePrompt({ topic, count = 5 }) {
  return `Write ${count} scroll-stopping Pinterest pin headlines (max 60 characters each) about: ${topic}. ` +
    'Mix numbers, how-to and curiosity styles. No emojis, no hashtags. Reply ONLY with a JSON array of strings.';
}

export function listPrompt({ topic, count = 5 }) {
  return `Write ${count} short list items (max 45 characters each) for a Pinterest pin about: ${topic}. ` +
    'Reply ONLY with a JSON array of strings.';
}

export function imagePromptPrompt({ topic }) {
  return `Write one vivid prompt (max 40 words) for an AI image generator to create a beautiful vertical Pinterest photo about: ${topic}. ` +
    'Photographic, natural light, no text in the image. Reply with the prompt only.';
}

export function buildPrompt(task, input = {}) {
  switch (task) {
    case 'pin_copy': return pinCopyPrompt(input);
    case 'headlines': return headlinePrompt(input);
    case 'list_items': return listPrompt(input);
    case 'image_prompt': return imagePromptPrompt(input);
    default: throw new Error('Unknown AI task');
  }
}

/** Pull the first JSON object/array out of a model reply. */
export function parseJsonLoose(text) {
  if (typeof text !== 'string') return text;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (m) { try { return JSON.parse(m[1]); } catch { /* ignore */ } }
  return null;
}

export const POLLINATIONS_TEXT = 'https://text.pollinations.ai';
export const POLLINATIONS_IMAGE = 'https://image.pollinations.ai/prompt/';

export function pollinationsImageUrl(prompt, { width = 1000, height = 1500, seed } = {}) {
  const s = seed ?? Math.floor(Math.random() * 1e9);
  return `${POLLINATIONS_IMAGE}${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${s}`;
}
