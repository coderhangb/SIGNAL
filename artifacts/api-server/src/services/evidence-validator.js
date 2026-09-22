export function validateEvidence(source, quote, sourceRevision = 1) {
  if (typeof quote !== "string" || !quote.trim()) return null;
  const start = source.indexOf(quote);
  if (start < 0) return null;
  return {
    quote,
    start,
    end: start + quote.length,
    sourceType: "invitation",
    sourceId: `invitation_revision_${sourceRevision}`,
    sourceRevision,
  };
}
