import { writeFile } from "node:fs/promises";
const str = { type: "string" },
  int = { type: "integer", minimum: 0 },
  bool = { type: "boolean" };
const obj = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const array = (items) => ({ type: "array", items });
const schemas = {
  Error: obj({
    error: obj({ code: str, message: str, retryable: bool, requestId: str }),
  }),
  Support: obj({
    key: {
      type: "string",
      enum: [
        "live_captions",
        "vsl_interpreter",
        "written_responses",
        "written_questions_during",
        "questions_in_advance",
        "agenda_in_advance",
        "text_chat_backup",
        "extra_clarification_time",
        "clear_turn_taking",
      ],
    },
    importance: { enum: ["essential", "preferred"] },
  }),
  Profile: obj(
    {
      communicationMethods: array({ enum: ["vsl", "text", "speech", "mixed"] }),
      supports: array(ref("Support")),
      shareCommunicationMethods: bool,
      interpreterArrangement: { enum: ["hr", "self", "record_only"] },
      interpreterNotes: { type: "string", maxLength: 2000 },
    },
    ["communicationMethods", "supports", "shareCommunicationMethods"],
  ),
  Interview: obj(
    Object.fromEntries(
      [
        "company",
        "position",
        "date",
        "time",
        "timezone",
        "format",
        "platform",
        "locationOrLink",
        "durationMinutes",
      ].map((k) => [
        k,
        { type: [k === "durationMinutes" ? "integer" : "string", "null"] },
      ]),
    ),
  ),
  ManualObservation: obj({
    key: str,
    status: {
      enum: ["confirmed", "needs_confirmation", "unknown", "not_available"],
    },
    details: { type: "string", maxLength: 2000 },
  }),
  Draft: obj(
    {
      subject: { type: "string", maxLength: 300 },
      body: { type: "string", maxLength: 10000 },
      mode: str,
      warnings: array(str),
    },
    ["subject", "body"],
  ),
  Snapshot: obj(
    {
      profile: ref("Profile"),
      invitation: { type: "string", maxLength: 20000 },
      analysisId: { type: ["string", "null"] },
      mode: { enum: ["rules", "ai", "manual"] },
      interview: ref("Interview"),
      draft: ref("Draft"),
      manualObservations: array(ref("ManualObservation")),
    },
    ["profile", "invitation", "mode", "interview", "draft"],
  ),
  AnalyzeInput: obj(
    {
      text: { type: "string", minLength: 1, maxLength: 20000 },
      locale: str,
      inputRevision: int,
      mode: { enum: ["rules", "ai"] },
      aiConsent: bool,
    },
    ["text", "inputRevision"],
  ),
  PreviewInput: obj(
    {
      profile: ref("Profile"),
      analysisId: { type: ["string", "null"] },
      reviewedDetails: ref("Interview"),
      manualObservations: array(ref("ManualObservation")),
    },
    ["profile", "reviewedDetails"],
  ),
  HrAnswer: obj(
    {
      key: str,
      status: { enum: ["confirmed", "needs_confirmation", "not_available"] },
      details: { type: "string", minLength: 1, maxLength: 2000 },
      alternativeProposal: { type: "string", maxLength: 2000 },
    },
    ["key", "status", "details"],
  ),
  Decisions: obj({
    acceptedAlternatives: { type: "object", additionalProperties: str },
    acknowledgedPreferred: array(str),
  }),
};
const paths = {};
function route(
  path,
  method,
  summary,
  input,
  security = "none",
  code = 200,
  output = { type: "object" },
) {
  const value = {
    summary,
    operationId: (method + "_" + path).replace(/[^a-zA-Z0-9_]/g, "_"),
    responses: {
      [code]: {
        description: "Success",
        ...(code === 204
          ? {}
          : { content: { "application/json": { schema: output } } }),
      },
      default: {
        description: "Safe error; 400,401,403,404,409,410,413,422,429,503,504",
        content: { "application/json": { schema: ref("Error") } },
      },
    },
  };
  if (input)
    value.requestBody = {
      required: true,
      content: { "application/json": { schema: input } },
    };
  if (path.includes("{id}"))
    value.parameters = [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ];
  if (security !== "none") {
    value.security = [{ [security]: [] }];
    if (!["get", "head"].includes(method))
      value.parameters = [
        ...(value.parameters || []),
        { in: "header", name: "X-CSRF-Token", required: true, schema: str },
      ];
  }
  if (!["get", "head"].includes(method))
    value.parameters = [
      ...(value.parameters || []),
      {
        in: "header",
        name: "Origin",
        required: true,
        schema: str,
        description: "Must exactly match APP_ORIGIN.",
      },
    ];
  paths[path] ??= {};
  paths[path][method] = value;
}
route("/healthz", "get", "Health and configured persistence status");
route("/v2/catalog", "get", "Stable bilingual catalog");
route(
  "/v2/session",
  "post",
  "Create/reuse anonymous candidate cookie",
  obj({}),
);
route(
  "/v2/session",
  "get",
  "Restore existing candidate CSRF",
  null,
  "candidateCookie",
);
route(
  "/v2/analyze-invitation",
  "post",
  "Analyze with explicit rules/AI mode; AI requires separate consent",
  ref("AnalyzeInput"),
);
route(
  "/v2/access-check",
  "post",
  "Preview selected requirements from server extraction ticket",
  ref("PreviewInput"),
);
route(
  "/v2/accommodation-request",
  "post",
  "Editable selected-only template, never sent",
  ref("PreviewInput"),
);
route(
  "/v2/plans",
  "post",
  "Persist server-verified snapshot; reject client ownership/evidence claims",
  obj({ snapshot: ref("Snapshot"), idempotencyKey: str }),
  "candidateCookie",
  201,
);
route(
  "/v2/plans/{id}",
  "get",
  "Owner-only current snapshot and responses",
  null,
  "candidateCookie",
);
route(
  "/v2/plans/{id}",
  "patch",
  "Atomic new revision, revoke all old grants, invalidate approval",
  obj(
    {
      expectedRevision: int,
      changes: ref("Snapshot"),
      confirmNeedsChange: bool,
    },
    ["expectedRevision", "changes"],
  ),
  "candidateCookie",
);
route(
  "/v2/plans/{id}",
  "delete",
  "Delete owned plan and cascade all dependent private data",
  obj({ expectedRevision: int }),
  "candidateCookie",
  204,
);
route(
  "/v2/plans/{id}/share",
  "post",
  "Persist consented immutable projection; return fragment bearer link",
  obj({
    expectedRevision: int,
    sharedFields: array({
      enum: [
        "supports",
        "interview",
        "draft",
        "communicationMethods",
        "invitation",
      ],
    }),
    consentAccepted: { const: true },
  }),
  "candidateCookie",
  201,
);
route(
  "/v2/plans/{id}/revoke-share",
  "post",
  "Invalidate grant and all scoped HR sessions",
  obj({ expectedRevision: int, grantId: str }),
  "candidateCookie",
);
route(
  "/v2/plans/{id}/approve",
  "post",
  "Candidate review; server computes readiness",
  obj({
    expectedRevision: int,
    responseRevision: int,
    reviewed: { const: true },
    decisions: ref("Decisions"),
  }),
  "candidateCookie",
);
route(
  "/v2/plans/{id}/export",
  "get",
  "Current plan including source, outstanding items and alternatives",
  null,
  "candidateCookie",
);
paths["/v2/plans/{id}/export"].get.responses[200].content = {
  "text/plain": { schema: str },
};
route(
  "/v2/hr/exchange",
  "post",
  "Exchange fragment token for HttpOnly scoped HR cookie",
  obj({ token: str }),
);
route(
  "/v2/hr/plan",
  "get",
  "Only explicitly shared projection; no unshared invitation/profile",
  null,
  "hrCookie",
);
route(
  "/v2/hr/response",
  "post",
  "Atomic response history; invalidate prior candidate approval",
  obj({
    expectedResponseRevision: int,
    answers: array(ref("HrAnswer")),
    responderLabel: { type: "string", minLength: 1, maxLength: 200 },
  }),
  "hrCookie",
);
await writeFile(
  "lib/api-spec/openapi.yaml",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "Api",
        version: "2.0.0",
        description:
          "SIGNAL v2. Legacy /signal routes retired. PostgreSQL is required for persistent sessions/plans/sharing. All mutations require APP_ORIGIN; cookie-authenticated mutations also require CSRF. Generated lib clients are not runtime dependencies.",
      },
      servers: [{ url: "/api" }],
      paths,
      components: {
        securitySchemes: {
          candidateCookie: { type: "apiKey", in: "cookie", name: "candidate" },
          hrCookie: { type: "apiKey", in: "cookie", name: "hr" },
        },
        schemas,
      },
    },
    null,
    2,
  ) + "\n",
);
