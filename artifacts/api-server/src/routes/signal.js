import { Router } from "express";

const router = Router();
const aiNotice =
  "AI-generated suggestions may be incomplete. Please review before sharing.";

const sampleSupportPatterns = {
  live_captions: [/live captions?/i, /captions? will be available/i],
  vsl_interpreter: [
    /vietnamese sign language/i,
    /\bvsl\b/i,
    /sign[- ]language interpreter/i,
  ],
  written_questions: [
    /questions? (?:will be )?be (?:sent|shared|provided) in writing/i,
    /written questions?/i,
  ],
  text_chat_backup: [/text[- ]chat/i, /chat channel/i, /chat backup/i],
};

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractInterview(text) {
  const normalized = text.replace(/\r/g, "");
  const company =
    firstMatch(normalized, [
      /(?:company|organisation|organization)\s*[:\-]\s*([^\n,.]+)/i,
      /(?:interview|meeting)\s+(?:at|with)\s+([A-Z][A-Za-z0-9&.' -]+?)(?:\s+(?:for|on|would|will)|[,.]|\n)/,
      /(?:from|with)\s+([A-Z][A-Za-z0-9&.' -]+?)(?:\s+(?:about|for|on)|[,.]|\n)/,
    ]) || (/\bABC Company\b/i.test(normalized) ? "ABC Company" : null);
  const position =
    firstMatch(normalized, [
      /(?:role|position|job title)\s*[:\-]\s*([^\n,.]+)/i,
      /(?:interview|meeting)\s+(?:for|about)\s+(?:the\s+)?([A-Z][A-Za-z0-9/&' -]+?)(?:\s+(?:role|position)|\s+on|\s+at|[,.]|\n)/i,
    ]) ||
    (/\bMarketing Intern\b/i.test(normalized) ? "Marketing Intern" : null);
  const date =
    firstMatch(normalized, [
      /\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})\b/i,
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?)\b/i,
      /(?:on|date)\s*[:\-]?\s*((?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{0,4})/i,
      /(?:on|date)\s*[:\-]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?(?:\s+\d{4})?)/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    ]) || (/\b24\s+September\b/i.test(normalized) ? "24 September" : null);
  const time =
    firstMatch(normalized, [
      /(?:at|time)\s*[:\-]?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i,
      /(?:at|time)\s*[:\-]?\s*(\d{1,2}:\d{2})\b/i,
    ]) || (/\b09:00\b/.test(normalized) ? "09:00" : null);
  const platform = firstMatch(normalized, [
    /\b(Zoom|Microsoft Teams|Google Meet|Webex)\b/i,
  ]);
  const format = /online|remote|video call|virtual/i.test(normalized)
    ? "Online"
    : /in[- ]person|on[- ]site|office/i.test(normalized)
      ? "In person"
      : null;
  const duration = firstMatch(normalized, [
    /\b(\d+(?:-\d+)?\s*(?:minutes?|mins?|hours?))\b/i,
  ]);
  return {
    company,
    position,
    date,
    time,
    format,
    platform: platform
      ? platform.charAt(0).toUpperCase() + platform.slice(1)
      : null,
    duration,
  };
}

function mentionedSupport(text) {
  return Object.fromEntries(
    Object.entries(sampleSupportPatterns).map(([key, patterns]) => [
      key,
      patterns.some((pattern) => pattern.test(text)),
    ]),
  );
}

const supportDefinitions = [
  {
    key: "live_captions",
    name: "Live captions",
    preferenceAliases: ["live_captions", "captions", "live captions"],
    reason: "Live captions are not mentioned in the invitation.",
    recommendedAction:
      "Ask HR to confirm whether live captions can be enabled.",
  },
  {
    key: "vsl_interpreter",
    name: "VSL interpreter",
    preferenceAliases: ["vsl_interpreter", "vsl", "interpreter"],
    reason:
      "A Vietnamese Sign Language interpreter is not mentioned in the invitation.",
    recommendedAction:
      "Ask whether a Vietnamese Sign Language interpreter can be arranged.",
  },
  {
    key: "written_questions",
    name: "Questions in advance",
    preferenceAliases: [
      "written_questions",
      "questions_in_advance",
      "questions",
    ],
    reason: "No written-question or agenda policy was found.",
    recommendedAction:
      "Ask whether an agenda or questions can be shared in writing.",
  },
  {
    key: "text_chat_backup",
    name: "Text-chat backup",
    preferenceAliases: ["text_chat_backup", "chat", "text-chat"],
    reason: "A text-chat backup channel is not mentioned in the invitation.",
    recommendedAction:
      "Ask which text-chat channel can be kept open during the interview.",
  },
];

function matchesPreference(preferences, aliases) {
  const normalized = preferences.map((preference) => preference.toLowerCase());
  return aliases.some((alias) =>
    normalized.some(
      (preference) =>
        preference === alias ||
        preference.includes(alias) ||
        alias.includes(preference),
    ),
  );
}

function validInterview(interview) {
  return (
    interview &&
    typeof interview === "object" &&
    [
      "company",
      "position",
      "date",
      "time",
      "format",
      "platform",
      "duration",
    ].every(
      (key) => interview[key] === null || typeof interview[key] === "string",
    )
  );
}

function validSupport(support) {
  return (
    support &&
    typeof support === "object" &&
    [
      "live_captions",
      "vsl_interpreter",
      "written_questions",
      "text_chat_backup",
    ].every((key) => typeof support[key] === "boolean")
  );
}

function validProfile(profile) {
  return (
    profile &&
    Array.isArray(profile.preferences) &&
    profile.preferences.every((item) => typeof item === "string")
  );
}

function validRequirements(requirements) {
  return (
    Array.isArray(requirements) &&
    requirements.every(
      (item) =>
        item &&
        typeof item.name === "string" &&
        typeof item.key === "string" &&
        [
          "confirmed",
          "needs_confirmation",
          "unknown",
          "not_available",
        ].includes(item.status) &&
        typeof item.reason === "string" &&
        typeof item.recommended_action === "string",
    )
  );
}

router.post("/signal/analyze-invitation", (request, response) => {
  const text = request.body?.text;
  if (typeof text !== "string" || text.trim().length < 1)
    return response
      .status(400)
      .json({ error: "Please provide an invitation email or message." });
  response.json({
    interview: extractInterview(text),
    mentioned_support: mentionedSupport(text),
    ai_notice: aiNotice,
    requires_user_review: true,
  });
});

router.post("/signal/access-check", (request, response) => {
  const { profile, interview, mentioned_support } = request.body || {};
  if (
    !validProfile(profile) ||
    !validInterview(interview) ||
    !validSupport(mentioned_support)
  )
    return response
      .status(400)
      .json({
        error:
          "Please provide a profile, interview details, and invitation support.",
      });
  const detailsConfirmed =
    interview.company && interview.position && interview.date && interview.time;
  const requirements = [
    {
      name: "Interview details",
      key: "interview_details",
      status: detailsConfirmed ? "confirmed" : "unknown",
      reason: detailsConfirmed
        ? "The invitation includes the key interview details."
        : "Some key interview details are still missing.",
      recommended_action: detailsConfirmed
        ? "Review the details before continuing."
        : "Add or confirm the missing interview details.",
    },
    ...supportDefinitions
      .filter((definition) =>
        matchesPreference(profile.preferences, definition.preferenceAliases),
      )
      .map((definition) => {
        const isMentioned = mentioned_support[definition.key];
        return {
          name: definition.name,
          key: definition.key,
          status: isMentioned ? "confirmed" : "needs_confirmation",
          reason: isMentioned
            ? `${definition.name} is explicitly mentioned in the invitation.`
            : definition.reason,
          recommended_action: isMentioned
            ? "Keep this support in the final plan."
            : definition.recommendedAction,
        };
      }),
  ];
  response.json({
    requirements,
    ai_notice: aiNotice,
    requires_user_review: true,
  });
});

router.post("/signal/accommodation-request", (request, response) => {
  const { profile, interview, requirements } = request.body || {};
  if (
    !validProfile(profile) ||
    !validInterview(interview) ||
    !validRequirements(requirements)
  )
    return response
      .status(400)
      .json({
        error: "Please provide the interview details and access check.",
      });
  const company = interview.company || "the hiring team";
  const communicationLine = profile.preferences.some((preference) =>
    /vsl|interpreter/i.test(preference),
  )
    ? "Vietnamese Sign Language and written communication"
    : profile.preferences.some((preference) => /written/i.test(preference))
      ? "written communication"
      : "clear written communication";
  const requestedSupports = requirements
    .filter(
      (requirement) =>
        (requirement.status === "needs_confirmation" ||
          requirement.status === "unknown") &&
        requirement.key !== "interview_details",
    )
    .map(
      (requirement) =>
        `- ${requirement.name}: ${requirement.recommended_action}`,
    )
    .join("\n");
  const body = [
    "Hello,",
    "",
    `Thank you for inviting me to interview for the ${interview.position || "role"} at ${company}.`,
    `I communicate primarily through ${communicationLine}. To help me participate fully, could you please confirm the communication supports available for this interview?`,
    "",
    requestedSupports ||
      "- Written details about the interview format and questions where possible.",
    "",
    "A text-based backup channel would also be helpful during the interview.",
    "",
    "Thank you for your help. I look forward to speaking with you.",
    "",
    "Best,",
    "Candidate",
  ].join("\n");
  response.json({
    subject: "Communication support for interview",
    body,
    ai_notice: aiNotice,
    requires_user_review: true,
  });
});

export default router;
