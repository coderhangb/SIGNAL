import { createAiProvider } from "../artifacts/api-server/src/services/ai-provider.js";
import { readConfig } from "../artifacts/api-server/src/config/env.js";
import { validateModelOutput } from "../artifacts/api-server/src/services/invitation-service.js";
import { invitations } from "../artifacts/api-server/tests/fixtures/invitations.js";
const config = readConfig();
if (config.aiProvider === "none") {
  console.error(
    "BLOCKED: configure AI_PROVIDER, AI_API_KEY and AI_MODEL. Only synthetic fixtures will be sent.",
  );
  process.exit(2);
}
const provider = createAiProvider(config);
let failed = 0;
for (const [id, text] of Object.entries(invitations)) {
  try {
    const result = validateModelOutput(await provider(text), text, 1);
    const falseConfirmed =
      [
        "INV02",
        "INV03",
        "INV07",
        "INV08",
        "INV09",
        "INV10",
        "INV11",
        "INV12",
      ].includes(id) &&
      result.observations.some((o) => o.status === "confirmed");
    if (falseConfirmed) failed++;
    console.log(
      JSON.stringify({
        id,
        mode: result.extractionMode,
        falseConfirmed,
        warnings: result.warnings.length,
      }),
    );
  } catch (e) {
    failed++;
    console.log(JSON.stringify({ id, code: e.code || "INVALID_RESULT" }));
  }
}
process.exitCode = failed ? 1 : 0;
