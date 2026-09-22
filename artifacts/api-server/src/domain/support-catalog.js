import { check, object, string } from "./validation.js";
export const communicationMethods = [
  {
    key: "vsl",
    labelVi: "Ngôn ngữ ký hiệu Việt Nam",
    labelEn: "Vietnamese Sign Language",
  },
  { key: "text", labelVi: "Giao tiếp bằng chữ", labelEn: "Text" },
  { key: "speech", labelVi: "Lời nói", labelEn: "Speech" },
  { key: "mixed", labelVi: "Kết hợp", labelEn: "Mixed" },
];
export const supports = [
  ["live_captions", "Phụ đề trực tiếp", "Live captions"],
  [
    "vsl_interpreter",
    "Phiên dịch ngôn ngữ ký hiệu Việt Nam",
    "VSL interpreter",
  ],
  ["written_responses", "Trả lời bằng chữ", "Written responses"],
  [
    "written_questions_during",
    "Câu hỏi bằng chữ trong buổi phỏng vấn",
    "Written questions during the interview",
  ],
  ["questions_in_advance", "Câu hỏi gửi trước", "Questions in advance"],
  ["agenda_in_advance", "Nội dung chương trình gửi trước", "Agenda in advance"],
  ["text_chat_backup", "Kênh chat dự phòng", "Text-chat backup"],
  [
    "extra_clarification_time",
    "Thêm thời gian làm rõ",
    "Extra clarification time",
  ],
  ["clear_turn_taking", "Lần lượt phát biểu rõ ràng", "Clear turn taking"],
].map(([key, labelVi, labelEn]) => ({
  key,
  labelVi,
  labelEn,
  description: `${labelVi} / ${labelEn}`,
}));
export const catalog = { contractVersion: 2, communicationMethods, supports };
export function normalizeProfile(input) {
  object(input, [
    "communicationMethods",
    "supports",
    "shareCommunicationMethods",
    "interpreterArrangement",
    "interpreterNotes",
  ]);
  check(
    Array.isArray(input.communicationMethods) &&
      input.communicationMethods.every((k) =>
        communicationMethods.some((m) => m.key === k),
      ),
    "Invalid communication method.",
  );
  check(
    Array.isArray(input.supports) && input.supports.length <= 30,
    "Invalid supports.",
  );
  check(
    typeof input.shareCommunicationMethods === "boolean",
    "Specify method sharing.",
  );
  if (input.communicationMethods.includes("vsl"))
    check(
      ["hr", "self", "record_only"].includes(input.interpreterArrangement),
      "Hãy làm rõ ai bố trí phiên dịch VSL.",
    );
  if (input.interpreterArrangement != null)
    check(
      ["hr", "self", "record_only"].includes(input.interpreterArrangement),
      "Invalid interpreter arrangement.",
    );
  if (input.interpreterNotes != null)
    string(input.interpreterNotes, 2000, false);
  const unique = new Map();
  for (const s of input.supports) {
    object(s, ["key", "importance"]);
    check(
      supports.some((x) => x.key === s.key),
      "Unknown support key.",
    );
    check(
      ["essential", "preferred"].includes(s.importance),
      "Choose importance.",
    );
    // Duplicate normalization must never silently downgrade an essential requirement.
    unique.set(s.key, {
      ...s,
      importance:
        unique.get(s.key)?.importance === "essential"
          ? "essential"
          : s.importance,
    });
  }
  if (input.interpreterArrangement === "hr")
    check(
      unique.has("vsl_interpreter"),
      "Choose interpreter importance before continuing.",
    );
  if (
    input.communicationMethods.includes("vsl") &&
    ["self", "record_only"].includes(input.interpreterArrangement)
  )
    check(
      !unique.has("vsl_interpreter"),
      "Hãy làm rõ: tự bố trí phiên dịch hay yêu cầu HR bố trí.",
    );
  return {
    ...input,
    communicationMethods: [...new Set(input.communicationMethods)],
    supports: [...unique.values()],
  };
}
