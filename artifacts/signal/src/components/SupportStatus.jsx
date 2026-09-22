export const statusLabels = {
  confirmed: "Đã xác nhận",
  needs_confirmation: "Cần xác nhận",
  unknown: "Chưa có thông tin",
  not_available: "Không cung cấp",
};
export function SupportStatus({ status }) {
  return (
    <strong className={`status status-${status}`}>
      {statusLabels[status] || status}
    </strong>
  );
}
export function EvidencePanel({ item }) {
  const entries = item.evidenceHistory?.length
    ? item.evidenceHistory
    : item.evidence
      ? [item.evidence]
      : [];
  return (
    <details>
      <summary>Xem bằng chứng</summary>
      {entries.length ? (
        entries.map((e, i) => (
          <blockquote key={i}>
            <p>{e.quote}</p>
            <small>
              {e.sourceType === "candidate_entered"
                ? "Ứng viên ghi nhận"
                : "Theo thư mời"}
              {e.timestamp ? ` · ${e.timestamp}` : ""}
            </small>
          </blockquote>
        ))
      ) : (
        <p>Chưa có bằng chứng. Cần hỏi HR.</p>
      )}
    </details>
  );
}
