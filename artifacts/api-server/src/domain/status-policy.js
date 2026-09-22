export function classifySupportObservation({
  assertion,
  conditional,
  evidenceValidated,
}) {
  if (assertion === "absent") return { status: "unknown" };
  if (!evidenceValidated) return { status: "needs_confirmation" };
  if (conditional || assertion === "conflicting")
    return { status: "needs_confirmation" };
  return {
    status:
      assertion === "affirmed"
        ? "confirmed"
        : assertion === "denied"
          ? "not_available"
          : "needs_confirmation",
  };
}
export function resolveObservations(items) {
  const known = items.filter((x) => x.status !== "unknown");
  if (!known.length)
    return { status: "unknown", evidence: null, evidenceHistory: [] };
  const states = new Set(known.map((x) => x.status));
  return {
    ...known[0],
    status: states.size > 1 ? "needs_confirmation" : known[0].status,
    evidenceHistory: known.map((x) => x.evidence).filter(Boolean),
  };
}
