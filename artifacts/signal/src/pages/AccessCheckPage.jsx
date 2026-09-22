import { useState } from "react";
import { EvidencePanel, SupportStatus } from "../components/SupportStatus.jsx";
export default function AccessCheckPage({
  requirements,
  onManual,
  onRemove,
  next,
  busy,
}) {
  const [editing, setEditing] = useState(null),
    [details, setDetails] = useState(""),
    [status, setStatus] = useState("needs_confirmation");
  const [removing, setRemoving] = useState(null);
  return (
    <div className="grid gap-5">
      {requirements.map((r) => (
        <article className="card-surface rounded-xl p-5" key={r.key}>
          <h3>
            {r.name} ·{" "}
            {r.importance === "essential" ? "Cần thiết" : "Mong muốn"}
          </h3>
          <SupportStatus status={r.status} />
          <p>{r.reason}</p>
          <EvidencePanel item={r} />
          <button
            onClick={() => {
              setEditing(r.key);
              setDetails("");
              setStatus("needs_confirmation");
            }}
          >
            Bổ sung thông tin: {r.name}
          </button>
          <button onClick={() => setRemoving(r)}>
            Bỏ khỏi yêu cầu: {r.name}
          </button>
        </article>
      ))}
      {removing && (
        <div role="alert" className="notice">
          <p>
            Bỏ hỗ trợ {removing.name} là thay đổi nhu cầu, không phải xác nhận
            đã có hỗ trợ. Nếu bỏ phiên dịch, bạn không còn yêu cầu HR bố trí
            phiên dịch và cần kiểm tra lại cách giao tiếp.
          </p>
          <button
            onClick={() => {
              onRemove(removing.key);
              setRemoving(null);
            }}
          >
            Xác nhận bỏ và kiểm tra lại nhu cầu
          </button>
          <button onClick={() => setRemoving(null)}>Giữ hỗ trợ</button>
        </div>
      )}
      {editing && (
        <fieldset>
          <legend>
            Ứng viên ghi nhận — không phải phản hồi qua liên kết HR
          </legend>
          <label>
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="needs_confirmation">Cần xác nhận</option>
              <option value="confirmed">
                Đã xác nhận theo thông tin tôi ghi nhận
              </option>
              <option value="not_available">Không cung cấp</option>
              <option value="unknown">Chưa rõ</option>
            </select>
          </label>
          <label>
            Nội dung và nguồn bạn ghi nhận
            <textarea
              value={details}
              maxLength={2000}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          <button
            disabled={!details.trim()}
            onClick={() => {
              onManual({ key: editing, status, details });
              setEditing(null);
            }}
          >
            Lưu ghi nhận
          </button>
        </fieldset>
      )}
      <p>
        Để bỏ hỗ trợ, quay lại Nhu cầu và xác nhận thay đổi nếu đó là hỗ trợ cần
        thiết.
      </p>
      <button className="primary" disabled={busy} onClick={next}>
        Tạo mẫu thư
      </button>
    </div>
  );
}
