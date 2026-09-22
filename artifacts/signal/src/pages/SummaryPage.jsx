const fields = {
  company: "Công ty",
  position: "Vị trí",
  date: "Ngày (YYYY-MM-DD)",
  time: "Giờ (HH:mm)",
  timezone: "Múi giờ (vd Asia/Ho_Chi_Minh)",
  format: "Hình thức (Online / In person)",
  platform: "Nền tảng",
  locationOrLink: "Địa điểm hoặc liên kết",
  durationMinutes: "Thời lượng (phút)",
};
export default function SummaryPage({ state, dispatch, next, busy }) {
  return (
    <div className="grid gap-5">
      <p>
        Chế độ:{" "}
        {
          {
            rules: "Rule-based",
            ai: "AI-assisted",
            manual: "Nhập tay / Manual",
          }[state.mode]
        }
        . Trường trống được giữ là chưa rõ. Không tự suy ra năm hoặc múi giờ.
      </p>
      {state.analysis?.warnings?.map((w) => (
        <p role="note" key={w}>
          {w}
        </p>
      ))}
      <div className="detail-grid">
        {Object.entries(fields).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              data-testid={`detail-${key}`}
              type={key === "durationMinutes" ? "number" : "text"}
              value={state.interview[key] ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "DETAIL",
                  key,
                  value:
                    key === "durationMinutes" && e.target.value
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
            />
            {state.analysis?.rawValues?.[key] && (
              <small>Trong thư: {state.analysis.rawValues[key]}</small>
            )}
          </label>
        ))}
      </div>
      <button className="primary" disabled={busy} onClick={next}>
        Kiểm tra hỗ trợ
      </button>
    </div>
  );
}
