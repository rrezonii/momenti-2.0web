/** Removes the standard attribution footer injected by syndicated RSS feeds. */
export function removeAppearedFirstFooter(html: string) {
  const content = html.trim();
  const lowerContent = content.toLowerCase();
  const phraseIndex = lowerContent.lastIndexOf("appeared first on");
  if (phraseIndex < 0) return content;

  // Remove only the syndicated sentence, never the containing article
  // paragraph (which can include the whole article body in some feeds).
  const paragraphStart = lowerContent.lastIndexOf("<p", phraseIndex);
  const markerIndex = lowerContent.lastIndexOf("the post", phraseIndex);
  const footerStart = markerIndex >= paragraphStart ? markerIndex : phraseIndex;
  const paragraphOpenEnd = paragraphStart >= 0 ? content.indexOf(">", paragraphStart) : -1;
  const paragraphEnd = paragraphStart >= 0 ? lowerContent.indexOf("</p>", phraseIndex) : -1;

  if (paragraphOpenEnd >= 0 && paragraphEnd >= 0) {
    const precedingParagraphText = content
      .slice(paragraphOpenEnd + 1, footerStart)
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
      .trim();

    if (!precedingParagraphText) {
      return `${content.slice(0, paragraphStart)}${content.slice(paragraphEnd + 4)}`.trim();
    }

    return `${content.slice(0, footerStart)}</p>${content.slice(paragraphEnd + 4)}`.trim();
  }

  // Plain-text feed fallback: only trim back to a line/sentence boundary.
  const lineStart = Math.max(content.lastIndexOf("\n", footerStart), content.lastIndexOf("<br", footerStart));
  const removeFrom = lineStart >= 0 ? lineStart : footerStart;
  return content.slice(0, removeFrom).trim();
}
