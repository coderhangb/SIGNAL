import { SharedContent } from "../components/SharedContent.jsx";
export function projectionFor(state, fields) {
  const result = { supports: state.profile.supports };
  if (state.profile.supports.some((s) => s.key === "vsl_interpreter"))
    result.interpreterNotes = state.profile.interpreterNotes || "";
  for (const key of fields)
    if (key !== "supports")
      result[key] =
        key === "communicationMethods"
          ? state.profile.communicationMethods
          : key === "draft"
            ? {
                subject: state.draft.subject,
                body: state.draft.body,
                mode: "edited_template",
              }
            : state[key];
  return result;
}
export default function ShareReviewPage({
  catalog,
  state,
  fields,
  setFields,
  dispatch,
  share,
  busy,
}) {
  return (
    <div className="grid gap-5">
      <p>
        HR chỉ thấy những trường dưới đây. Liên kết có thể được chuyển tiếp;
        người trả lời chưa được xác minh danh tính.
      </p>
      {["interview", "draft", "communicationMethods", "invitation"].map(
        (key) => (
          <label className="choice" key={key}>
            <input
              type="checkbox"
              checked={fields.includes(key)}
              disabled={
                key === "communicationMethods" &&
                !state.profile.shareCommunicationMethods
              }
              onChange={(e) => {
                setFields(
                  e.target.checked
                    ? [...fields, key]
                    : fields.filter((k) => k !== key),
                );
                dispatch({ type: "CONSENT", value: false });
              }}
            />
            {
              {
                interview: "Chi tiết phỏng vấn",
                draft: "Thư yêu cầu",
                communicationMethods: "Cách giao tiếp",
                invitation: "Toàn bộ thư mời gốc",
              }[key]
            }
          </label>
        ),
      )}
      <h3>Nội dung chính xác sẽ chia sẻ</h3>
      <div data-testid="share-preview">
        <SharedContent
          projection={projectionFor(state, fields)}
          catalog={catalog}
        />
      </div>
      <label className="choice">
        <input
          data-testid="consent"
          type="checkbox"
          checked={state.consent}
          onChange={(e) =>
            dispatch({ type: "CONSENT", value: e.target.checked })
          }
        />
        Tôi đã kiểm tra và đồng ý chia sẻ đúng nội dung này.
      </label>
      <button
        className="primary"
        disabled={!state.consent || busy}
        onClick={share}
      >
        {state.demo ? "Tiếp tục mô phỏng demo" : "Lưu và tạo liên kết HR"}
      </button>
    </div>
  );
}
