import { useEffect, useRef, useState } from "react";
import { api, setHrCsrf } from "../api/client.js";
import { Shell } from "../components/Layout.jsx";
import { SharedContent } from "../components/SharedContent.jsx";
export default function HrResponsePage({ catalog }) {
  const [plan, setPlan] = useState(null),
    [answers, setAnswers] = useState({}),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  async function load() {
    const data = await api("/hr/plan", { role: "hr" });
    setHrCsrf(data.csrf);
    setPlan(data);
    setAnswers(
      Object.fromEntries((data.response?.answers || []).map((a) => [a.key, a])),
    );
    setName(data.response?.responderLabel || "");
  }
  useEffect(() => {
    // Opening a second fragment link in the same tab is a same-document navigation.
    // Reload to cancel the previous form/session requests before exchanging the new grant.
    const newLink = () => {
      if (new URLSearchParams(location.hash.slice(1)).has("token"))
        location.reload();
    };
    window.addEventListener("hashchange", newLink);
    const token = new URLSearchParams(location.hash.slice(1)).get("token");
    history.replaceState({}, "", location.pathname);
    (async () => {
      try {
        if (token) {
          const data = await api("/hr/exchange", {
            method: "POST",
            data: { token },
            role: "hr",
          });
          setHrCsrf(data.csrf);
        }
        await load();
      } catch (e) {
        setError(e.message);
      }
    })();
    return () => window.removeEventListener("hashchange", newLink);
  }, []);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/hr/response", {
        method: "POST",
        role: "hr",
        data: {
          expectedResponseRevision: plan.responseRevision,
          responderLabel: name,
          answers: Object.values(answers).filter(
            (a) => a.status && a.status !== "unknown",
          ),
        },
      });
      await load();
      setMessage("Đã lưu phản hồi. Ứng viên cần kiểm tra và duyệt lại.");
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function edit(key, field, value) {
    setMessage("");
    setAnswers((a) => ({
      ...a,
      [key]: {
        key,
        status: "unknown",
        details: "",
        ...(a[key] || {}),
        [field]: value,
      },
    }));
  }
  return (
    <Shell>
      <main className="planning hr-page">
        <h1 tabIndex={-1}>Phản hồi hỗ trợ phỏng vấn</h1>
        <p>Người trả lời tự khai. Liên kết này không xác minh danh tính HR.</p>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {plan && (
          <div className="grid gap-5">
            <SharedContent projection={plan} catalog={catalog} />
            {plan.supports.map((s) => {
              const label =
                catalog.supports.find((x) => x.key === s.key)?.labelVi || s.key;
              const a = answers[s.key] || {};
              return (
                <fieldset key={s.key} disabled={busy}>
                  <legend>
                    {label} ·{" "}
                    {s.importance === "essential" ? "Cần thiết" : "Mong muốn"}
                  </legend>
                  <label>
                    Khả năng bố trí
                    <select
                      aria-label={`HR: ${s.key}`}
                      value={a.status || "unknown"}
                      onChange={(e) => edit(s.key, "status", e.target.value)}
                    >
                      <option value="unknown">Chưa trả lời</option>
                      <option value="confirmed">Xác nhận cung cấp</option>
                      <option value="needs_confirmation">
                        Cần kiểm tra thêm
                      </option>
                      <option value="not_available">Không cung cấp</option>
                    </select>
                  </label>
                  <label>
                    Chi tiết cam kết / lý do
                    <textarea
                      aria-label={`Chi tiết: ${s.key}`}
                      value={a.details || ""}
                      maxLength={2000}
                      onChange={(e) => edit(s.key, "details", e.target.value)}
                    />
                  </label>
                  <label>
                    Phương án thay thế cụ thể (nếu có)
                    <textarea
                      aria-label={`Phương án: ${s.key}`}
                      value={a.alternativeProposal || ""}
                      maxLength={2000}
                      onChange={(e) =>
                        edit(s.key, "alternativeProposal", e.target.value)
                      }
                    />
                  </label>
                </fieldset>
              );
            })}
            <label>
              Tên người trả lời (tự khai)
              <input
                disabled={busy}
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="actions">
              <button disabled={busy} onClick={refresh}>
                Tải lại phản hồi
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  !name.trim() ||
                  Object.values(answers).some(
                    (a) => a.status !== "unknown" && !a.details?.trim(),
                  )
                }
                onClick={submit}
              >
                Gửi phản hồi
              </button>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
