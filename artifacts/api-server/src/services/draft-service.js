import {
  supports,
  normalizeProfile,
  communicationMethods,
} from "../domain/support-catalog.js";
export function requirementsFor(profile, observations = [], manual = []) {
  return normalizeProfile(profile).supports.map((s) => ({
    ...s,
    ...(observations.find((o) => o.key === s.key) || {
      status: "unknown",
      evidence: null,
    }),
    ...(manual.find((o) => o.key === s.key) || {}),
    key: s.key,
    importance: s.importance,
    name: supports.find((x) => x.key === s.key).labelVi,
  }));
}
export function createDraft(profile, interview, requirements) {
  const p = normalizeProfile(profile);
  const selected = new Set(p.supports.map((s) => s.key));
  const pending = requirements.filter(
    (r) => selected.has(r.key) && r.status !== "confirmed",
  );
  const lines = pending.map(
    (r) =>
      `- ${supports.find((s) => s.key === r.key).labelVi}: ${r.status === "not_available" ? "Xin trao đổi phương án phù hợp khác." : "Xin xác nhận có thể bố trí hỗ trợ này."}`,
  );
  return {
    subject: "Hỗ trợ giao tiếp cho buổi phỏng vấn",
    body: [
      "Kính gửi bộ phận tuyển dụng,",
      "",
      `Cảm ơn lời mời phỏng vấn${interview.position ? ` vị trí ${interview.position}` : ""}${interview.company ? ` tại ${interview.company}` : ""}.`,
      ...(p.shareCommunicationMethods && p.communicationMethods.length
        ? [
            `Tôi chọn giao tiếp qua: ${p.communicationMethods.map((k) => communicationMethods.find((m) => m.key === k).labelVi).join(", ")}.`,
          ]
        : []),
      ...(lines.length
        ? ["Xin xác nhận các hỗ trợ sau:", ...lines]
        : ["Tôi ghi nhận các hỗ trợ đã nêu. Xin cảm ơn."]),
      ...(p.supports.some((s) => s.key === "vsl_interpreter") &&
      p.interpreterNotes
        ? [`Ghi chú ngôn ngữ ký hiệu: ${p.interpreterNotes}`]
        : []),
      "",
      "Trân trọng,",
    ].join("\n"),
    mode: "template",
    warnings: pending.length
      ? []
      : ["Các hỗ trợ đã xác nhận; có thể bỏ qua thư yêu cầu."],
  };
}
