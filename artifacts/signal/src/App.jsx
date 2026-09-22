import { useEffect, useReducer, useRef, useState } from "react";
import { Shell } from "./components/Layout.jsx";
import { initialState, planningReducer } from "./state/planning-reducer.js";
import { api, copyText, session } from "./api/client.js";
import { demoSample } from "./fixtures/demo-plan.js";
import PreferencesPage from "./pages/PreferencesPage.jsx";
import InvitationPage from "./pages/InvitationPage.jsx";
import SummaryPage from "./pages/SummaryPage.jsx";
import AccessCheckPage from "./pages/AccessCheckPage.jsx";
import RequestPage from "./pages/RequestPage.jsx";
import ShareReviewPage from "./pages/ShareReviewPage.jsx";
import HrResponsePage from "./pages/HrResponsePage.jsx";
import PlanPage from "./pages/PlanPage.jsx";
const steps = [
  "Nhu cầu",
  "Thư mời",
  "Kiểm tra chi tiết",
  "Hỗ trợ và bằng chứng",
  "Thư yêu cầu",
  "Duyệt chia sẻ",
  "Kế hoạch",
];
export default function App() {
  const [s, dispatch] = useReducer(planningReducer, undefined, initialState);
  const [catalog, setCatalog] = useState(null),
    [initError, setInitError] = useState("");
  const [aiMode, setAiMode] = useState("rules"),
    [aiConsent, setAiConsent] = useState(false),
    [fields, setFields] = useState(["supports"]);
  const [shareResult, setShareResult] = useState(null),
    [copyArea, setCopyArea] = useState(""),
    [copyMessage, setCopyMessage] = useState("");
  const lock = useRef(false),
    controller = useRef(null),
    heading = useRef(null),
    current = useRef(s),
    createKey = useRef(crypto.randomUUID());
  current.current = s;
  useEffect(() => {
    api("/catalog")
      .then(setCatalog)
      .catch((e) => setInitError(e.message));
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [s.step, catalog]);
  useEffect(() => {
    if (s.error) document.getElementById("workflow-error")?.focus();
  }, [s.error]);
  useEffect(() => {
    controller.current?.abort();
    lock.current = false;
    setCopyArea("");
    setCopyMessage("");
    setShareResult(null);
    setAiConsent(false);
  }, [s.inputRevision]);
  useEffect(() => {
    const match = location.pathname.match(/^\/plan\/([^/]+)$/);
    if (match)
      session(true)
        .then(() => api(`/plans/${match[1]}`))
        .then((plan) => dispatch({ type: "RESTORE", plan }))
        .catch((e) => dispatch({ type: "ERROR", message: e.message }));
  }, []);
  async function run(task) {
    if (lock.current) return;
    lock.current = true;
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal,
      inputRevision = current.current.inputRevision,
      id = crypto.randomUUID();
    dispatch({ type: "START", id });
    try {
      const value = await task(signal);
      dispatch({ type: "RESULT", id, inputRevision, value });
    } catch (e) {
      dispatch({ type: "ERROR", id, message: e.message });
    } finally {
      if (!signal.aborted) lock.current = false;
    }
  }
  const previewInput = () => ({
    profile: s.profile,
    analysisId:
      s.mode === "manual"
        ? null
        : s.analysis?.analysisId || s.plan?.snapshot.analysisId,
    reviewedDetails: s.interview,
    manualObservations: s.manualObservations,
  });
  const snapshot = () => ({
    profile: s.profile,
    invitation: s.invitation,
    analysisId: s.analysis?.analysisId || s.plan?.snapshot.analysisId || null,
    mode: s.mode,
    interview: s.interview,
    draft: s.draft,
    manualObservations: s.manualObservations,
  });
  const requirements = (s.access?.requirements || []).map((r) => {
    const m = s.manualObservations.find((o) => o.key === r.key);
    return m
      ? {
          ...r,
          ...m,
          evidence: { quote: m.details, sourceType: "candidate_entered" },
          evidenceHistory: [],
        }
      : r;
  });
  async function copy(value) {
    setCopyArea(value);
    setCopyMessage("");
    try {
      await copyText(value);
      setCopyMessage("Đã sao chép. Nội dung chưa được gửi.");
    } catch (e) {
      setCopyMessage(e.message);
    }
  }
  function reset(sample) {
    controller.current?.abort();
    lock.current = false;
    createKey.current = crypto.randomUUID();
    setShareResult(null);
    setCopyArea("");
    setCopyMessage("");
    setFields(["supports"]);
    setAiMode("rules");
    setAiConsent(false);
    history.replaceState({}, "", "/");
    dispatch({ type: "RESET", sample });
  }
  async function share() {
    if (!s.consent) return;
    if (s.demo) {
      const plan = {
        id: "demo",
        revision: 1,
        snapshot: { interview: s.interview, requirements },
        response: null,
        readiness: { status: "needs_action", missingDetails: [], requirements },
      };
      dispatch({ type: "START", id: "demo" });
      dispatch({
        type: "RESULT",
        id: "demo",
        inputRevision: s.inputRevision,
        value: { step: 6, plan, dirty: false },
      });
      return;
    }
    await run(async (signal) => {
      await session();
      const plan = s.plan
        ? s.dirty
          ? await api(`/plans/${s.plan.id}`, {
              method: "PATCH",
              data: {
                expectedRevision: s.plan.revision,
                changes: snapshot(),
                confirmNeedsChange: true,
              },
              signal,
            })
          : s.plan
        : await api("/plans", {
            method: "POST",
            data: { snapshot: snapshot(), idempotencyKey: createKey.current },
            signal,
          });
      // Preserve saved revision even if subsequent link creation fails, so retry never creates a second plan.
      history.replaceState({}, "", `/plan/${plan.id}`);
      dispatch({ type: "SAVED", plan });
      const shared = await api(`/plans/${plan.id}/share`, {
        method: "POST",
        data: {
          expectedRevision: plan.revision,
          sharedFields: fields,
          consentAccepted: s.consent,
        },
        signal,
      });
      setShareResult(shared);
      return {
        plan: await api(`/plans/${plan.id}`, { signal }),
        step: 6,
        dirty: false,
      };
    });
  }
  function reload() {
    return run(async (signal) => ({
      plan: await api(`/plans/${s.plan.id}`, { signal }),
      dirty: false,
    }));
  }
  function approve(decisions) {
    if (s.demo) {
      dispatch({ type: "START", id: "demo-review" });
      dispatch({
        type: "RESULT",
        id: "demo-review",
        inputRevision: s.inputRevision,
        value: {
          plan: {
            ...s.plan,
            readiness: { ...s.plan.readiness, status: "needs_action" },
          },
        },
      });
      setCopyMessage("Demo: chưa có cam kết HR; kế hoạch vẫn cần xử lý.");
      return;
    }
    return run(async (signal) => ({
      plan: await api(`/plans/${s.plan.id}/approve`, {
        method: "POST",
        signal,
        data: {
          expectedRevision: s.plan.revision,
          responseRevision: s.plan.response?.revision || 0,
          decisions,
          reviewed: true,
        },
      }),
    }));
  }
  async function revoke(grantId) {
    return run(async (signal) => {
      await api(`/plans/${s.plan.id}/revoke-share`, {
        method: "POST",
        signal,
        data: { grantId, expectedRevision: s.plan.revision },
      });
      setShareResult(null);
      return { plan: await api(`/plans/${s.plan.id}`, { signal }) };
    });
  }
  if (!catalog)
    return (
      <Shell>
        <main className="planning">
          <h1>SIGNAL</h1>
          <p role={initError ? "alert" : "status"}>
            {initError || "Đang tải danh mục…"}
          </p>
          {initError && (
            <button onClick={() => location.reload()}>Thử lại</button>
          )}
        </main>
      </Shell>
    );
  if (location.pathname === "/hr") return <HrResponsePage catalog={catalog} />;
  let content;
  if (s.step === 0)
    content = (
      <PreferencesPage
        profile={s.profile}
        catalog={catalog}
        onChange={(value) => dispatch({ type: "PROFILE", value })}
        next={() => dispatch({ type: "STEP", step: 1 })}
      />
    );
  if (s.step === 1)
    content = (
      <InvitationPage
        state={s}
        dispatch={dispatch}
        busy={s.busy}
        aiMode={aiMode}
        setAiMode={setAiMode}
        aiConsent={aiConsent}
        setAiConsent={setAiConsent}
        analyze={() =>
          run(async (signal) => {
            const analysis = await api("/analyze-invitation", {
              method: "POST",
              signal,
              data: {
                text: s.invitation,
                inputRevision: s.inputRevision,
                mode: aiMode,
                aiConsent,
              },
            });
            return {
              analysis,
              interview: analysis.interview,
              mode: analysis.extractionMode,
              step: 2,
              access: null,
              draft: null,
              consent: false,
            };
          })
        }
      />
    );
  if (s.step === 2)
    content = (
      <SummaryPage
        state={s}
        dispatch={dispatch}
        busy={s.busy}
        next={() =>
          run(async (signal) => ({
            access: await api("/access-check", {
              method: "POST",
              signal,
              data: previewInput(),
            }),
            step: 3,
          }))
        }
      />
    );
  if (s.step === 3)
    content = (
      <AccessCheckPage
        requirements={requirements}
        onManual={(value) => dispatch({ type: "MANUAL_OBSERVATION", value })}
        onRemove={(key) => {
          dispatch({
            type: "PROFILE",
            value: {
              ...s.profile,
              supports: s.profile.supports.filter((r) => r.key !== key),
              ...(key === "vsl_interpreter"
                ? { interpreterArrangement: "record_only" }
                : {}),
            },
          });
          dispatch({ type: "STEP", step: 0 });
        }}
        busy={s.busy}
        next={() =>
          run(async (signal) => ({
            draft: await api("/accommodation-request", {
              method: "POST",
              signal,
              data: previewInput(),
            }),
            step: 4,
          }))
        }
      />
    );
  if (s.step === 4 && s.draft)
    content = (
      <RequestPage
        draft={s.draft}
        onChange={(value) => dispatch({ type: "DRAFT", value })}
        copy={copy}
        next={() => dispatch({ type: "STEP", step: 5 })}
      />
    );
  if (s.step === 5 && s.draft)
    content = (
      <ShareReviewPage
        catalog={catalog}
        state={s}
        fields={fields}
        setFields={setFields}
        dispatch={dispatch}
        busy={s.busy}
        share={share}
      />
    );
  if (s.step === 6 && s.plan)
    content = (
      <PlanPage
        plan={s.plan}
        shareResult={shareResult}
        busy={s.busy}
        demo={s.demo}
        refresh={reload}
        approve={approve}
        revoke={revoke}
        remove={() =>
          run(async (signal) => {
            await api(`/plans/${s.plan.id}`, {
              method: "DELETE",
              data: { expectedRevision: s.plan.revision },
              signal,
            });
            reset();
            return {};
          })
        }
        exportCurrent={() =>
          s.demo
            ? copy(
                `DEMO — Kế hoạch cần xử lý\n${requirements.map((r) => `${r.name}: ${r.status}`).join("\n")}\nChưa có phản hồi HR thật.`,
              )
            : run(async (signal) => {
                await copy(
                  await api(`/plans/${s.plan.id}/export`, {
                    signal,
                    text: true,
                  }),
                );
                return {};
              })
        }
      />
    );
  return (
    <Shell>
      <main className="planning">
        <aside>
          <p className="eyebrow">CLEAR COMMUNICATION PLANS</p>
          <h1 className="display">Từ thư mời đến kế hoạch rõ ràng.</h1>
          <nav aria-label="Các bước lập kế hoạch">
            {steps.map((label, i) => (
              <button
                key={label}
                disabled={s.busy || i > s.step}
                aria-current={i === s.step ? "step" : undefined}
                onClick={() => dispatch({ type: "STEP", step: i })}
              >
                {i + 1}. {label}
              </button>
            ))}
          </nav>
          <div className="actions">
            <button disabled={s.busy} onClick={() => reset(demoSample)}>
              Thử mẫu demo
            </button>
            <button disabled={s.busy} onClick={() => reset()}>
              Bắt đầu chế độ thật
            </button>
          </div>
        </aside>
        <section
          className="min-w-0"
          aria-describedby={s.error ? "workflow-error" : undefined}
        >
          <h2 ref={heading} tabIndex={-1}>
            {steps[s.step]}
          </h2>
          {s.demo && (
            <p className="notice" role="note">
              DEMO — dữ liệu mẫu; không tạo liên kết hoặc phản hồi HR thật.
            </p>
          )}
          {s.busy && <p role="status">Đang xử lý…</p>}
          {s.error && (
            <p
              id="workflow-error"
              tabIndex={-1}
              role="alert"
              className="notice"
            >
              {s.error}
            </p>
          )}
          {content}
          {copyMessage && <p role="status">{copyMessage}</p>}
          {copyArea && (
            <label>
              Nội dung để sao chép thủ công
              <textarea
                readOnly
                rows={8}
                value={copyArea}
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
        </section>
      </main>
    </Shell>
  );
}
