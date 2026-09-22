export default function RequestPage({ draft, onChange, copy, next }) {
  return (
    <div className="grid gap-5">
      <p>Mẫu thư có thể sửa. Sao chép không có nghĩa đã gửi.</p>
      <label>
        Tiêu đề
        <input
          value={draft.subject}
          maxLength={300}
          onChange={(e) => onChange({ ...draft, subject: e.target.value })}
        />
      </label>
      <label>
        Nội dung
        <textarea
          data-testid="draft"
          rows={12}
          value={draft.body}
          maxLength={10000}
          onChange={(e) => onChange({ ...draft, body: e.target.value })}
        />
      </label>
      <div className="actions">
        <button onClick={() => copy(`${draft.subject}\n\n${draft.body}`)}>
          Sao chép thư
        </button>
        <button
          className="primary"
          disabled={!draft.subject.trim() || !draft.body.trim()}
          onClick={next}
        >
          Duyệt nội dung chia sẻ
        </button>
      </div>
    </div>
  );
}
