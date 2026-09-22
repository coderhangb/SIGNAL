export function computeReadiness(plan) {
  const { snapshot, response, approval, revision } = plan;
  const requiredDetails = [
    "date",
    "time",
    "timezone",
    "format",
    "locationOrLink",
  ];
  const valid = { ...snapshot.interview };
  const date = valid.date;
  valid.date =
    /^\d{4}-\d{2}-\d{2}$/.test(date || "") &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  valid.time = /^([01]\d|2[0-3]):[0-5]\d$/.test(valid.time || "");
  valid.format =
    /^(online|in person|hybrid|trực tuyến|trực tiếp|kết hợp)$/i.test(
      valid.format || "",
    );
  try {
    if (!valid.timezone) throw new Error();
    new Intl.DateTimeFormat("en", { timeZone: valid.timezone });
  } catch {
    valid.timezone = false;
  }
  const missingDetails = requiredDetails.filter((k) => !valid[k]);
  const current =
    approval &&
    approval.planRevision === revision &&
    approval.responseRevision === (response?.revision ?? 0);
  const decisions = current ? approval.decisions : {};
  const requirements = snapshot.requirements.map((r) => {
    const answer = response?.answers.find((a) => a.key === r.key);
    const effective = answer
      ? {
          ...r,
          ...answer,
          sourceType: "hr_response",
          timestamp: response.createdAt,
        }
      : { ...r, sourceType: r.evidence?.sourceType ?? null };
    const acceptedAlternative =
      !!answer?.alternativeProposal &&
      decisions.acceptedAlternatives?.[r.key] === answer.alternativeProposal;
    return {
      ...effective,
      acceptedAlternative,
      resolved: effective.status === "confirmed" || acceptedAlternative,
    };
  });
  const essential = requirements.filter(
    (r) => r.importance === "essential" && !r.resolved,
  );
  const preferred = requirements.filter(
    (r) => r.importance === "preferred" && !r.resolved,
  );
  const acknowledged = preferred.every((r) =>
    decisions.acknowledgedPreferred?.includes(r.key),
  );
  return {
    status:
      missingDetails.length || essential.length
        ? "needs_action"
        : current && approval.reviewed && acknowledged
          ? "ready"
          : "awaiting_candidate_review",
    missingDetails,
    requirements,
    outstanding: requirements.filter((r) => !r.resolved).map((r) => r.key),
  };
}
export function exportPlan(plan) {
  const ready = computeReadiness(plan);
  return [
    "SIGNAL — Kế hoạch giao tiếp",
    `Trạng thái: ${ready.status}`,
    `Revision: ${plan.revision}; HR response: ${plan.response?.revision ?? 0}`,
    ...Object.entries(plan.snapshot.interview).map(
      ([k, v]) => `${k}: ${v ?? "Chưa rõ"}`,
    ),
    "",
    ...ready.requirements.map(
      (r) =>
        `${r.name} (${r.importance}): ${r.status}\nNguồn: ${r.sourceType ?? "Chưa có thông tin"}${r.timestamp ? `; ${r.timestamp}` : ""}\n${r.evidence?.quote ?? r.details ?? ""}${r.alternativeProposal ? `\nPhương án: ${r.alternativeProposal}; ${r.acceptedAlternative ? "Ứng viên chấp nhận" : "Chưa chấp nhận"}` : ""}`,
    ),
    "",
    `Thông tin thiếu: ${ready.missingDetails.join(", ") || "Không"}`,
    `Hỗ trợ chưa đáp ứng: ${ready.outstanding.join(", ") || "Không"}`,
    ready.status !== "ready"
      ? "Bước tiếp: làm rõ các mục còn thiếu và duyệt lại revision hiện tại."
      : "Ứng viên đã duyệt revision hiện tại.",
    "Phản hồi qua liên kết HR không xác minh danh tính người trả lời.",
  ].join("\n");
}
