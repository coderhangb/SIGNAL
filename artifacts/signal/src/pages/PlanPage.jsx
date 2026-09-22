import { useEffect, useState } from "react";
import { SupportStatus } from "../components/SupportStatus.jsx";
import { InterviewDetails } from "../components/SharedContent.jsx";
export default function PlanPage({
  plan,
  shareResult,
  approve,
  refresh,
  exportCurrent,
  revoke,
  remove,
  busy,
  demo,
}) {
  const [accepted, setAccepted] = useState({}),
    [acknowledged, setAcknowledged] = useState([]),
    [reviewed, setReviewed] = useState(false),
    [deleteReview, setDeleteReview] = useState(false);
  useEffect(() => {
    setAccepted({});
    setAcknowledged([]);
    setReviewed(false);
  }, [plan.revision, plan.response?.revision]);
  const readiness = plan.readiness;
  return (
    <div className="grid gap-5">
      {shareResult && (
        <div className="notice">
          <p>
            Đã tạo liên kết, chưa gửi cho HR. Hết hạn:{" "}
            {new Date(shareResult.expiresAt).toLocaleString()}
          </p>
          <label>
            Liên kết HR
            <input
              readOnly
              value={shareResult.shareUrl}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <a href={shareResult.shareUrl} target="_blank" rel="noreferrer">
            Mở trang HR
          </a>
          <button onClick={() => revoke(shareResult.grantId)} disabled={busy}>
            Thu hồi liên kết
          </button>
        </div>
      )}
      {!demo && (
        <button onClick={refresh} disabled={busy}>
          Tải phản hồi mới nhất
        </button>
      )}
      <p data-testid="readiness">
        Trạng thái: <strong>{readiness.status}</strong> · Revision{" "}
        {plan.revision} · Phản hồi {plan.response?.revision || 0}
      </p>
      <InterviewDetails interview={plan.snapshot.interview} />
      {readiness.status !== "ready" && (
        <p>
          Bước tiếp theo: làm rõ các chi tiết/hỗ trợ còn thiếu với HR, quyết
          định có chấp nhận phương án cụ thể hay không, rồi duyệt lại kế hoạch
          hiện tại.
        </p>
      )}
      {readiness.missingDetails.length > 0 && (
        <p>
          Chi tiết còn thiếu/chưa hợp lệ: {readiness.missingDetails.join(", ")}
        </p>
      )}
      {readiness.requirements.map((r) => (
        <article className="card-surface rounded-xl p-5" key={r.key}>
          <h3>{r.name}</h3>
          <SupportStatus status={r.status} />
          <p>
            Nguồn:{" "}
            {r.sourceType === "hr_response"
              ? `Phản hồi qua liên kết HR · ${plan.response.responderLabel} (tự khai) · ${r.timestamp}`
              : r.sourceType === "candidate_entered"
                ? "Ứng viên ghi nhận"
                : r.evidence
                  ? "Theo thư mời"
                  : "Chưa có thông tin"}
          </p>
          <p>{r.details || r.evidence?.quote || "Hãy hỏi HR làm rõ."}</p>
          {r.alternativeProposal && (
            <label className="choice">
              <input
                type="checkbox"
                checked={accepted[r.key] === r.alternativeProposal}
                onChange={(e) =>
                  setAccepted((v) => {
                    const next = { ...v };
                    if (e.target.checked) next[r.key] = r.alternativeProposal;
                    else delete next[r.key];
                    return next;
                  })
                }
              />
              Tôi chấp nhận phương án này: {r.alternativeProposal}
            </label>
          )}
          {r.importance === "preferred" && r.status !== "confirmed" && (
            <label className="choice">
              <input
                type="checkbox"
                checked={acknowledged.includes(r.key)}
                onChange={(e) =>
                  setAcknowledged((v) =>
                    e.target.checked
                      ? [...v, r.key]
                      : v.filter((k) => k !== r.key),
                  )
                }
              />
              Tôi biết hỗ trợ mong muốn này chưa được đáp ứng và vẫn muốn tiếp
              tục.
            </label>
          )}
          {r.acceptedAlternative && (
            <p>Đã chấp nhận phương án trong lần duyệt hiện tại.</p>
          )}
        </article>
      ))}
      <label className="choice">
        <input
          data-testid="review-plan"
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        Tôi đã kiểm tra ngày, giờ, múi giờ, hình thức, địa điểm/liên kết và các
        hỗ trợ của revision này.
      </label>
      <div className="actions">
        <button
          className="primary"
          disabled={!reviewed || busy}
          onClick={() =>
            approve({
              acceptedAlternatives: accepted,
              acknowledgedPreferred: acknowledged,
            })
          }
        >
          Duyệt kế hoạch hiện tại
        </button>
        <button onClick={exportCurrent} disabled={busy}>
          Sao chép kế hoạch
        </button>
      </div>
      {!demo && (
        <>
          <details>
            <summary>Liên kết đã tạo và quản lý dữ liệu</summary>
            {plan.grants
              ?.filter((g) => !g.revoked_at)
              .map((g) => (
                <button key={g.id} disabled={busy} onClick={() => revoke(g.id)}>
                  Thu hồi link revision {g.snapshot_revision}
                </button>
              ))}
            <label className="choice">
              <input
                type="checkbox"
                checked={deleteReview}
                onChange={(e) => setDeleteReview(e.target.checked)}
              />
              Xóa vĩnh viễn kế hoạch và mọi liên kết/phản hồi liên quan
            </label>
            <button disabled={!deleteReview || busy} onClick={remove}>
              Xóa kế hoạch
            </button>
          </details>
          <p>Mất cookie phiên thì không khôi phục được bằng ID công khai.</p>
        </>
      )}
    </div>
  );
}
