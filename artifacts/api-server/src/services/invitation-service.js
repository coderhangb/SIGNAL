import { createHash, randomUUID } from "node:crypto";
import { supports } from "../domain/support-catalog.js";
import { resolveObservations } from "../domain/status-policy.js";
import { validateEvidence } from "./evidence-validator.js";
import { check, object, statuses, string } from "../domain/validation.js";
export const interviewKeys = [
  "company",
  "position",
  "date",
  "time",
  "timezone",
  "format",
  "platform",
  "locationOrLink",
  "durationMinutes",
];
export const emptyInterview = () =>
  Object.fromEntries(interviewKeys.map((k) => [k, null]));
export function validateInterview(value) {
  object(value, interviewKeys);
  for (const k of interviewKeys) {
    if (value[k] == null) continue;
    if (k === "durationMinutes")
      check(
        Number.isInteger(value[k]) && value[k] > 0 && value[k] <= 1440,
        "Invalid duration.",
      );
    else string(value[k], 2000);
  }
  return { ...emptyInterview(), ...value };
}
const patterns = {
  live_captions: /captions?|phụ đề/i,
  vsl_interpreter: /interpreter|interpretation|phiên dịch/i,
  written_responses:
    /written (?:responses?|answers?)|(?:respond|answer).*?(?:writing|text)|trả lời bằng chữ/i,
  written_questions_during:
    /(?:questions?.*(?:writing|written|during)|câu hỏi.*(?:trong buổi|bằng chữ))/i,
  questions_in_advance:
    /(?:questions?.*(?:advance|before)|(?:sent|shared).*in advance|câu hỏi.*gửi trước)/i,
  agenda_in_advance: /agenda|chương trình|lịch trình/i,
  text_chat_backup:
    /(?:text.?chat|chat backup|backup.*chat|chat.*(?:channel|available|enabled)|kênh chat)/i,
  extra_clarification_time: /extra.*time|clarification time|thêm thời gian/i,
  clear_turn_taking:
    /turn.taking|one (?:person|speaker) at a time|lần lượt phát biểu/i,
};
// Intentionally conservative rules. Unrecognized language remains reviewable, never a promise.
export function classifyClause(key, quote, fullText = quote) {
  if (!patterns[key]?.test(quote)) return "unknown";
  if (
    /forwarded|original message|previous interview|another interview|last interview|phỏng vấn trước|thư chuyển tiếp/i.test(
      fullText,
    )
  )
    return "needs_confirmation";
  if (
    /\?|\b(asked|whether|request|hope|wish|should|prefer)\b|mong muốn|đề nghị|yêu cầu/i.test(
      quote,
    )
  )
    return "needs_confirmation";
  if (/ignore.*instructions|mark.*confirmed|bỏ qua.*hướng dẫn/i.test(quote))
    return "needs_confirmation";
  if (
    /\b(if|may|might|could|perhaps|subject to|depending|not yet|check|unless)\b|chưa|có thể|nếu/i.test(
      quote,
    )
  )
    return "needs_confirmation";
  if (/\b(?:not|cannot|can't|unavailable|won't|unable|no)\b|không/i.test(quote))
    return "not_available";
  if (
    key === "vsl_interpreter" &&
    !/\bvsl\b|vietnamese sign language|ngôn ngữ ký hiệu việt nam/i.test(quote)
  )
    return "needs_confirmation";
  if (key === "written_questions_during" && !/during|trong buổi/i.test(quote))
    return "needs_confirmation";
  if (key === "agenda_in_advance" && !/advance|before|trước/i.test(quote))
    return "needs_confirmation";
  return /\bwill\b|\bwe (?:provide|offer|enable|allow)\b|\b(?:is|are) (?:available|enabled|provided)\b|\bcan (?:respond|answer)\b|sẽ|được cung cấp/i.test(
    quote,
  )
    ? "confirmed"
    : "needs_confirmation";
}
export function extractRules(text, inputRevision = 1) {
  const interview = emptyInterview();
  const labels = {
    company: "Company|Organisation|Organization|Công ty",
    position: "Position|Role|Vị trí",
    date: "Interview date|Date|Ngày",
    time: "Time|Giờ",
    timezone: "Timezone|Múi giờ",
    format: "Format|Hình thức",
    platform: "Platform|Nền tảng",
    locationOrLink: "Location|Link|Địa điểm",
    durationMinutes: "Duration|Thời lượng",
  };
  const rawValues = {};
  for (const [k, label] of Object.entries(labels)) {
    const match = text.match(
      new RegExp(`(?:^|[;\\n])\\s*(?:${label})\\s*:\\s*([^;\\n]+)`, "i"),
    );
    if (!match) continue;
    let raw = match[1].trim().replace(/\.(?:\s.*)?$/, "");
    // URLs and company names can contain periods; only sentence-delimited metadata is truncated.
    if (k === "locationOrLink") raw = match[1].trim();
    rawValues[k] = raw;
    if (k === "date")
      interview[k] = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    else if (k === "durationMinutes")
      interview[k] = /^\d+\s*(?:minutes?|mins?|phút)?$/i.test(raw)
        ? parseInt(raw, 10)
        : null;
    else interview[k] = raw || null;
  }
  if (!interview.platform)
    interview.platform =
      text.match(/\b(Zoom|Microsoft Teams|Google Meet|Webex)\b/i)?.[1] ?? null;
  if (!interview.format && /\bonline\b|trực tuyến/i.test(text))
    interview.format = "Online";
  const clauses = [...text.matchAll(/[^.!?;\n]+(?:[.!?;]|$)/g)]
    .flatMap((m) => m[0].split(/\bbut\b|\bhowever\b|nhưng/iu))
    .map((x) => x.trim())
    .filter(Boolean);
  const observations = supports.map((s) => {
    const items = clauses
      .filter((c) => patterns[s.key].test(c))
      .map((quote) => ({
        status: classifyClause(s.key, quote, text),
        evidence: validateEvidence(text, quote, inputRevision),
      }));
    const resolved = resolveObservations(items);
    return {
      key: s.key,
      ...resolved,
      reason:
        resolved.status === "unknown"
          ? "Không thấy thông tin trong thư."
          : resolved.status === "needs_confirmation"
            ? "Cần làm rõ cam kết hoặc ngữ cảnh."
            : "Theo nội dung thư mời.",
      nextAction:
        resolved.status === "confirmed"
          ? "Kiểm tra bằng chứng."
          : "Hỏi HR làm rõ hoặc trao đổi phương án.",
      extractionMode: "rules",
    };
  });
  return {
    interview,
    rawValues,
    observations,
    extractionMode: "rules",
    warnings:
      rawValues.date && !interview.date
        ? ["Ngày chưa rõ; hãy nhập ngày ISO YYYY-MM-DD sau khi xác minh."]
        : [],
  };
}
export function validateModelOutput(value, text, inputRevision) {
  object(value, ["interview", "observations"]);
  const interview = validateInterview(value.interview);
  check(Array.isArray(value.observations), "Invalid observations.");
  const warnings = [];
  for (const [key, detail] of Object.entries(interview)) {
    if (detail === null) continue;
    const grounded =
      key === "durationMinutes"
        ? new RegExp(
            `\\b${detail}\\s*[- ]?\\s*(?:minutes?|mins?|phút)`,
            "i",
          ).test(text)
        : text.toLocaleLowerCase().includes(String(detail).toLocaleLowerCase());
    if (!grounded || (key === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(detail))) {
      interview[key] = null;
      warnings.push(
        `Thông tin ${key} chưa có căn cứ rõ trong thư; hãy nhập tay sau khi xác minh.`,
      );
    }
  }
  const seen = new Set();
  for (const o of value.observations) {
    object(o, ["key", "status", "quote"]);
    check(
      supports.some((s) => s.key === o.key) &&
        statuses.includes(o.status) &&
        !seen.has(o.key),
      "Invalid observation key or status.",
    );
    check(o.quote === null || typeof o.quote === "string", "Invalid quote.");
    seen.add(o.key);
  }
  const observations = supports.map((s) => {
    const o = value.observations.find((o) => o.key === s.key);
    const evidence = validateEvidence(text, o?.quote, inputRevision);
    const rules = extractRules(text, inputRevision).observations.find(
      (x) => x.key === s.key,
    );
    let status = o?.status ?? "unknown";
    // A valid quote alone is insufficient: require independently recognized local context.
    if (status !== "unknown" && (!evidence || rules.status === "unknown")) {
      status = "unknown";
      warnings.push(`Evidence rejected: ${s.key}`);
    } else if (
      status !== "unknown" &&
      (rules.status !== status ||
        classifyClause(s.key, evidence.quote, text) !== status)
    ) {
      status = "needs_confirmation";
      warnings.push(`Review context: ${s.key}`);
    }
    return {
      key: s.key,
      status,
      evidence: evidence || null,
      evidenceHistory: rules.evidenceHistory,
      reason: "AI-assisted; cần kiểm tra bằng chứng và ngữ cảnh.",
      nextAction: "Kiểm tra hoặc hỏi HR.",
      extractionMode: "ai",
    };
  });
  return { interview, observations, warnings, extractionMode: "ai" };
}
export const inputHash = (text) =>
  createHash("sha256").update(text).digest("hex");
export function analysisEnvelope(result, text, inputRevision) {
  return {
    ...result,
    analysisId: randomUUID(),
    inputHash: inputHash(text),
    inputRevision,
  };
}
