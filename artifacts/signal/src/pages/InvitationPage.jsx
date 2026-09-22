export default function InvitationPage({
  state,
  dispatch,
  analyze,
  busy,
  aiMode,
  setAiMode,
  aiConsent,
  setAiConsent,
}) {
  return (
    <div className="grid gap-5">
      <label>
        Nội dung thư mời
        <textarea
          data-testid="invitation"
          aria-describedby={state.error ? "workflow-error" : undefined}
          rows={10}
          value={state.invitation}
          maxLength={20000}
          onChange={(e) =>
            dispatch({ type: "INVITATION", value: e.target.value })
          }
        />
      </label>
      <label>
        Chế độ phân tích
        <select
          value={aiMode}
          onChange={(e) => {
            setAiMode(e.target.value);
            setAiConsent(false);
          }}
        >
          <option value="rules">Rule-based — quy tắc tại server</option>
          <option value="ai">AI-assisted — gửi tới nhà cung cấp AI</option>
        </select>
      </label>
      {aiMode === "ai" && (
        <label className="choice">
          <input
            type="checkbox"
            checked={aiConsent}
            onChange={(e) => setAiConsent(e.target.checked)}
          />
          Tôi đồng ý gửi nội dung thư này tới nhà cung cấp AI được cấu hình. Đây
          không phải đồng ý chia sẻ với HR.
        </label>
      )}
      <div className="actions">
        <button
          className="primary"
          disabled={
            busy || !state.invitation.trim() || (aiMode === "ai" && !aiConsent)
          }
          onClick={analyze}
        >
          Phân tích / Thử lại
        </button>
        <button disabled={busy} onClick={() => dispatch({ type: "MANUAL" })}>
          Nhập tay
        </button>
      </div>
    </div>
  );
}
