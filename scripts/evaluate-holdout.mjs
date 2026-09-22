import { readFile } from "node:fs/promises";
import { extractRules } from "../artifacts/api-server/src/services/invitation-service.js";
const filename = process.argv[2];
if (!filename) {
  console.error(
    "BLOCKED: provide a separate holdout JSON with annotationMethod=human and at least 20 EN/VI synthetic invitations. See tests/HOLDOUT.md.",
  );
  process.exit(2);
}
const dataset = JSON.parse(await readFile(filename, "utf8"));
if (
  dataset.annotationMethod !== "human" ||
  !Array.isArray(dataset.records) ||
  dataset.records.length < 20
)
  throw new Error(
    "A human-annotated holdout of at least 20 records is required.",
  );
const metrics = {
  records: dataset.records.length,
  falseConfirmed: 0,
  missingSelectedSupports: 0,
  statusCorrect: 0,
  statusTotal: 0,
  detailCorrect: 0,
  detailTotal: 0,
};
for (const row of dataset.records) {
  if (
    !["en", "vi"].includes(row.locale) ||
    typeof row.text !== "string" ||
    !Array.isArray(row.selectedSupports) ||
    !row.expectedStatuses ||
    !row.expectedInterview
  )
    throw new Error("Invalid holdout record.");
  const result = extractRules(row.text);
  for (const key of row.selectedSupports)
    if (!result.observations.some((o) => o.key === key))
      metrics.missingSelectedSupports++;
  for (const [key, expected] of Object.entries(row.expectedStatuses)) {
    const actual = result.observations.find((o) => o.key === key)?.status;
    if (
      !["unknown", "needs_confirmation", "not_available", "confirmed"].includes(
        expected,
      )
    )
      throw new Error("Invalid human label.");
    metrics.statusTotal++;
    if (actual === expected) metrics.statusCorrect++;
    if (actual === "confirmed" && expected !== "confirmed")
      metrics.falseConfirmed++;
  }
  for (const [key, expected] of Object.entries(row.expectedInterview)) {
    metrics.detailTotal++;
    if (result.interview[key] === expected) metrics.detailCorrect++;
  }
}
console.log(JSON.stringify(metrics, null, 2));
process.exitCode =
  metrics.falseConfirmed || metrics.missingSelectedSupports ? 1 : 0;
