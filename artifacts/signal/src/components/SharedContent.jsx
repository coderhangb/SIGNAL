const interviewLabels = {
  company: "Công ty",
  position: "Vị trí",
  date: "Ngày",
  time: "Giờ",
  timezone: "Múi giờ",
  format: "Hình thức",
  platform: "Nền tảng",
  locationOrLink: "Địa điểm / liên kết",
  durationMinutes: "Thời lượng (phút)",
};
export function InterviewDetails({ interview }) {
  return (
    <dl className="interview-details">
      {Object.entries(interviewLabels).map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{interview[key] ?? "Chưa rõ"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function SharedContent({ projection, catalog }) {
  return (
    <div className="grid gap-5">
      <section>
        <h3>Hỗ trợ được chia sẻ</h3>
        <ul>
          {projection.supports.map((s) => (
            <li key={s.key}>
              {catalog.supports.find((x) => x.key === s.key)?.labelVi || s.key}{" "}
              — {s.importance === "essential" ? "Cần thiết" : "Mong muốn"}
            </li>
          ))}
        </ul>
      </section>
      {projection.interpreterNotes && (
        <p>Ghi chú phiên dịch: {projection.interpreterNotes}</p>
      )}
      {projection.interview && (
        <section>
          <h3>Chi tiết phỏng vấn</h3>
          <InterviewDetails interview={projection.interview} />
        </section>
      )}
      {projection.draft && (
        <section>
          <h3>Thư yêu cầu</h3>
          <p>{projection.draft.subject}</p>
          <pre>{projection.draft.body}</pre>
        </section>
      )}
      {projection.communicationMethods && (
        <p>
          Cách giao tiếp:{" "}
          {projection.communicationMethods
            .map(
              (k) =>
                catalog.communicationMethods.find((m) => m.key === k)
                  ?.labelVi || k,
            )
            .join(", ") || "Chưa chọn"}
        </p>
      )}
      {projection.invitation !== undefined && (
        <section>
          <h3>Thư mời gốc</h3>
          <pre>{projection.invitation || "Không có nội dung"}</pre>
        </section>
      )}
    </div>
  );
}
