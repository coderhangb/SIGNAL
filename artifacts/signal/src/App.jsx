import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  FileText,
  HelpCircle,
  Keyboard,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const STEPS = [
  { title: "Your preferences", kicker: "01", detail: "Tell us what helps" },
  { title: "The invitation", kicker: "02", detail: "Add the details" },
  { title: "Review the summary", kicker: "03", detail: "Make it yours" },
  { title: "Check access", kicker: "04", detail: "Spot the gaps" },
  { title: "Write your request", kicker: "05", detail: "Edit before sending" },
  { title: "Your plan", kicker: "06", detail: "Ready when you are" },
];

const PREFERENCE_OPTIONS = [
  { key: "Vietnamese Sign Language", title: "Vietnamese Sign Language", description: "Use Vietnamese Sign Language as part of the conversation." },
  { key: "written text", title: "Written text", description: "Use written communication to clarify or respond." },
  { key: "live captions", title: "Live captions", description: "Read what is being said in real time." },
  { key: "interpreter", title: "Interpreter", description: "Have an interpreter present for the interview." },
  { key: "questions in advance", title: "Questions in advance", description: "Receive prompts before or during the call in writing." },
  { key: "text chat backup", title: "Text-chat backup", description: "Have a written channel if audio or video drops." },
];

const DEMO_INVITATION = `Hi Avery,

We would love to meet you for a 45-minute interview for the Marketing Intern role at ABC Company.

24 September at 09:00 via Zoom. The interview will be online. Please let us know if you need anything else.

Warmly,
Mina`;

const DEMO_INTERVIEW = {
  company: "ABC Company",
  position: "Marketing Intern",
  date: "24 September",
  time: "09:00",
  format: "Online",
  platform: "Zoom",
  duration: "45 minutes",
};

const DEMO_SUPPORT = {
  live_captions: false,
  vsl_interpreter: false,
  written_questions: false,
  text_chat_backup: false,
};

const DEMO_ANALYSIS = {
  interview: DEMO_INTERVIEW,
  mentioned_support: DEMO_SUPPORT,
  ai_notice: "This is a first pass from the invitation text. Check the details and change anything that does not feel right.",
  requires_user_review: true,
};

const DEMO_ACCESS = {
  requirements: [
    { name: "Live captions", key: "live_captions", status: "needs_confirmation", reason: "Live captions are not mentioned in the invitation.", recommended_action: "Ask HR to confirm whether live captions can be enabled." },
    { name: "VSL interpreter", key: "vsl_interpreter", status: "needs_confirmation", reason: "A Vietnamese Sign Language interpreter is not mentioned in the invitation.", recommended_action: "Ask whether an interpreter can be arranged." },
    { name: "Questions in advance", key: "written_questions", status: "unknown", reason: "No written-question policy was found.", recommended_action: "Ask whether an agenda or questions can be shared in writing." },
    { name: "Text chat backup", key: "text_chat_backup", status: "needs_confirmation", reason: "A written backup channel was not named.", recommended_action: "Request chat as a backup if captions or audio are interrupted." },
  ],
  ai_notice: "Access notes are suggestions, not a judgment about what you need. Keep only what is useful to you.",
  requires_user_review: true,
};

const DEMO_REQUEST = {
  subject: "Communication support for interview",
  body: `Hello,

Thank you for inviting me to interview for the Marketing Intern role at ABC Company.

I communicate primarily through Vietnamese Sign Language and written communication. Could you please confirm whether live captions or sign-language interpretation will be available? I would also appreciate receiving the interview format and questions in written form where possible. A text-chat channel would be helpful as a backup during the interview.

Thank you for your help.

Best,
Candidate`,
  ai_notice: "This draft is editable and is not legal advice. Send only what feels accurate and comfortable.",
  requires_user_review: true,
};

const EMPLOYER_SUPPORT_OPTIONS = [
  { key: "live_captions", label: "Live captions", detail: "Captions enabled in the meeting." },
  { key: "written_questions", label: "Written questions", detail: "Questions shared in writing." },
  { key: "text_chat_backup", label: "Text-chat backup", detail: "A chat channel stays open." },
  { key: "vsl_interpreter", label: "VSL interpreter", detail: "Vietnamese Sign Language interpretation." },
];

const DEMO_EMPLOYER_SUPPORT = {
  live_captions: true,
  written_questions: true,
  text_chat_backup: true,
  vsl_interpreter: false,
};

async function postJson(path, data) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The service is unavailable.");
  return result;
}

function Field({ label, value, onChange, hint, testId }) {
  return (
    <label className="grid gap-2">
      <span className="font-semibold text-[1rem]">{label}</span>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      <input data-testid={testId} className="focus-ring min-h-12 rounded-xl border border-input bg-background px-4 text-[18px] focus:border-primary" value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Notice({ children, tone = "teal" }) {
  const colors = {
    teal: "border-primary/30 bg-primary/8 text-foreground",
    amber: "border-accent/50 bg-accent/12 text-foreground",
    red: "border-destructive/35 bg-destructive/8 text-foreground",
  };
  return <div className={`rounded-xl border px-4 py-3 text-[.94rem] ${colors[tone]}`} role={tone === "red" ? "alert" : "note"}>{children}</div>;
}

function PrimaryButton({ children, onClick, disabled, testId, type = "button", variant = "primary" }) {
  return (
    <button data-testid={testId} type={type} onClick={onClick} disabled={disabled} className={`focus-ring inline-flex min-h-13 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${variant === "primary" ? "bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/.2)]" : "border border-border bg-background text-foreground hover:bg-secondary"}`}>
      {children}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div className="signal-shell signal-grid">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8">
          <a data-testid="link-signal-home" href="/" className="focus-ring flex items-center gap-3 rounded-lg">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><span className="h-4 w-4 rounded-full border-[3px] border-current" /></span>
            <span><span className="display block text-xl font-bold leading-none">SIGNAL</span><span className="hidden text-xs font-semibold tracking-[.14em] text-muted-foreground sm:block">CLEAR COMMUNICATION PLANS</span></span>
          </a>
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /><span className="hidden sm:inline">No login. No diagnosis. Your choices.</span><span className="sm:hidden">Private by design</span></div>
        </div>
      </header>
      {children}
    </div>
  );
}

function ProgressRail({ step, setStep }) {
  return (
    <aside className="lg:sticky lg:top-8 lg:h-fit" aria-label="Interview planning steps">
      <div className="mb-6 flex items-end justify-between lg:block">
        <div><p className="eyebrow text-primary">Your signal path</p><h1 className="display mt-2 max-w-sm text-3xl font-bold leading-[1.05] sm:text-4xl">From invitation to clarity.</h1></div>
        <p className="text-right text-sm text-muted-foreground lg:mt-6 lg:text-left"><span className="font-bold text-foreground">{String(step + 1).padStart(2, "0")}</span> / 06</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2">
        {STEPS.map((item, index) => {
          const active = index === step;
          const completed = index < step;
          return <button key={item.kicker} data-testid={`button-step-${index + 1}`} onClick={() => index <= step && setStep(index)} disabled={index > step} className={`focus-ring group flex min-w-[150px] items-center gap-3 rounded-xl px-3 py-3 text-left transition-opacity lg:w-full ${active ? "bg-primary text-primary-foreground" : completed ? "bg-card-surface text-foreground hover:bg-secondary" : "text-muted-foreground opacity-55"}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${active ? "bg-accent text-accent-foreground" : completed ? "bg-primary text-primary-foreground" : "border border-current"}`}>{completed ? <Check className="h-4 w-4" aria-hidden="true" /> : item.kicker}</span>
            <span className="leading-tight"><span className="block text-sm font-bold">{item.title}</span><span className={`block text-xs ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{item.detail}</span></span>
          </button>;
        })}
      </div>
      <div className="mt-7 hidden rounded-xl border border-border bg-card/65 p-4 text-sm text-muted-foreground lg:block"><div className="mb-2 flex items-center gap-2 font-bold text-foreground"><Keyboard className="h-4 w-4 text-primary" aria-hidden="true" />Built for your pace</div>Use Tab to move through each control. Nothing is sent without your review.</div>
    </aside>
  );
}

function LoadingPanel({ label }) {
  return <div className="step-appear card-surface grid gap-4 rounded-2xl p-6 sm:p-8" aria-live="polite" data-testid="status-loading"><div className="flex items-center gap-3 text-primary"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /><span className="font-semibold">{label}</span></div><div className="h-4 w-4/5 animate-pulse rounded bg-muted" /><div className="h-4 w-3/5 animate-pulse rounded bg-muted" /><div className="h-4 w-2/5 animate-pulse rounded bg-muted" /></div>;
}

function App() {
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState(["Vietnamese Sign Language", "written text", "live captions", "questions in advance", "text chat backup"]);
  const [invitation, setInvitation] = useState(DEMO_INVITATION);
  const [analysis, setAnalysis] = useState(DEMO_ANALYSIS);
  const [access, setAccess] = useState(DEMO_ACCESS);
  const [request, setRequest] = useState(DEMO_REQUEST);
  const [confirmed, setConfirmed] = useState(false);
  const [employerSupport, setEmployerSupport] = useState(DEMO_EMPLOYER_SUPPORT);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const profile = useMemo(() => ({ preferences }), [preferences]);

  const togglePreference = (key) => setPreferences((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const runAnalysis = async () => {
    setBusy(true); setError("");
    try { setAnalysis(await postJson("/api/signal/analyze-invitation", { text: invitation.trim() })); setStep(2); }
    catch { setError("We could not reach the analysis service. Your demo summary is still here to edit."); setStep(2); }
    finally { setBusy(false); }
  };
  const runAccessCheck = async () => {
    setBusy(true); setError("");
    try { setAccess(await postJson("/api/signal/access-check", { profile, interview: analysis.interview, mentioned_support: analysis.mentioned_support })); setStep(3); }
    catch { setError("The access check is unavailable right now. We kept a starting checklist for you to review."); setStep(3); }
    finally { setBusy(false); }
  };
  const runRequest = async () => {
    setBusy(true); setError("");
    try { setRequest(await postJson("/api/signal/accommodation-request", { profile, interview: analysis.interview, requirements: access.requirements })); setStep(4); }
    catch { setError("The draft service is unavailable right now. We kept an editable starting draft for you."); setStep(4); }
    finally { setBusy(false); }
  };
  const copyRequest = async () => {
    await navigator.clipboard?.writeText(`${request.subject}\n\n${request.body}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };
  const restart = () => {
    setStep(0); setConfirmed(false); setCopied(false); setError(""); setPreferences(["live captions", "written text", "questions in advance"]); setEmployerSupport(DEMO_EMPLOYER_SUPPORT); setInvitation(DEMO_INVITATION); setAnalysis(DEMO_ANALYSIS); setAccess(DEMO_ACCESS); setRequest(DEMO_REQUEST);
  };
  const updateInterview = (key, value) => setAnalysis((current) => ({ ...current, interview: { ...current.interview, [key]: value } }));
  const updateRequirement = (index) => setAccess((current) => ({ ...current, requirements: current.requirements.map((item, itemIndex) => itemIndex === index ? { ...item, status: item.status === "confirmed" ? "needs_confirmation" : "confirmed" } : item) }));

  const StepHeading = ({ eyebrow, title, children }) => <div className="mb-7"><p className="eyebrow text-primary">{eyebrow}</p><h2 className="display mt-2 text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h2>{children && <p className="mt-4 max-w-2xl text-muted-foreground">{children}</p>}</div>;
  const bottomNav = (next, nextLabel, previous = true, disabled = false) => <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">{previous ? <button data-testid="button-go-back" onClick={() => setStep(Math.max(0, step - 1))} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</button> : <span />}{<PrimaryButton testId="button-primary-action" onClick={next} disabled={disabled || busy}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />} {busy ? "Working…" : nextLabel}</PrimaryButton>}</div>;

  let content;
  if (step === 0) content = <div className="step-appear"><StepHeading eyebrow="Start with you" title="What helps you communicate clearly?">Choose as many as you like. These are communication preferences, not a diagnosis, and you can change them at any time.</StepHeading><div className="grid gap-3">{PREFERENCE_OPTIONS.map((option) => { const selected = preferences.includes(option.key); return <label key={option.key} className={`focus-within:ring-4 focus-within:ring-accent/35 flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-opacity sm:p-5 ${selected ? "border-primary bg-primary/8" : "border-border bg-card hover:bg-secondary/60"}`}><input data-testid={`checkbox-preference-${option.key.replaceAll(" ", "-")}`} type="checkbox" checked={selected} onChange={() => togglePreference(option.key)} className="mt-1 h-5 w-5 accent-[hsl(var(--primary))]" /><span><span className="block font-bold">{option.title}</span><span className="mt-1 block text-[.95rem] text-muted-foreground">{option.description}</span></span></label>; })}</div>{preferences.length === 0 && <Notice tone="amber"><span className="font-semibold">No preferences selected.</span> Choose at least one to build a useful access plan.</Notice>}<div className="mt-6 flex items-start gap-3 text-sm text-muted-foreground"><HelpCircle className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><p>You stay in control. SIGNAL only uses these choices to compare against the invitation.</p></div>{bottomNav(() => setStep(1), "Continue to invitation", false, preferences.length === 0)}</div>;
  else if (step === 1) content = <div className="step-appear"><StepHeading eyebrow="Bring the context" title="Paste the invitation.">SIGNAL will look for practical details such as time, format, platform, and communication support. Remove anything you do not want to share.</StepHeading><div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><FileText className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="font-bold">Start with a sample invitation</p><p className="text-sm text-muted-foreground">Use the prepared example to see the full flow quickly.</p></div></div><button data-testid="button-use-sample" onClick={() => setInvitation(DEMO_INVITATION)} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-primary px-4 text-sm font-bold text-primary hover:bg-primary/8">Use sample email</button></div><label className="grid gap-2"><span className="font-semibold">Invitation text</span><span className="text-sm text-muted-foreground">A full invitation gives you a better first draft.</span><textarea data-testid="textarea-invitation" value={invitation} onChange={(event) => setInvitation(event.target.value)} rows={11} className="focus-ring min-h-56 resize-y rounded-2xl border border-input bg-card px-4 py-4 leading-relaxed" /></label><div className="mt-4 flex items-start gap-3 text-sm text-muted-foreground"><FileText className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><p>Only the text you submit is used for this analysis. This prototype does not ask for medical or legal information.</p></div>{error && <div className="mt-4"><Notice tone="red">{error}</Notice></div>}{busy ? <div className="mt-7"><LoadingPanel label="Reading the practical details…" /></div> : bottomNav(runAnalysis, "Analyze invitation", true, !invitation.trim())}</div>;
  else if (step === 2) content = <div className="step-appear"><StepHeading eyebrow="A first pass" title="Make the summary yours.">We found these details. Edit any field before we compare the invitation with your preferences.</StepHeading><div className="card-surface rounded-2xl p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/25 text-accent-foreground"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="font-bold">Interview details</h3><p className="text-sm text-muted-foreground">Editable, always.</p></div></div><div className="grid gap-5 sm:grid-cols-2">{["company", "position", "date", "time", "format", "platform", "duration"].map((key) => <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={analysis.interview[key]} onChange={(value) => updateInterview(key, value)} testId={`input-${key}`} />)}</div></div><div className="mt-4"><Notice><span className="font-semibold">AI note:</span> {analysis.ai_notice}</Notice></div>{error && <div className="mt-4"><Notice tone="amber">{error}</Notice></div>}{busy ? <div className="mt-7"><LoadingPanel label="Comparing your preferences with the invitation…" /></div> : bottomNav(runAccessCheck, "Check communication access")}</div>;
  else if (step === 3) content = <div className="step-appear"><StepHeading eyebrow="See the gap" title="What is covered, and what is not yet clear?">Review the signals below. Select a row to mark it confirmed or needing confirmation. You decide what belongs in your plan.</StepHeading><div className="grid gap-3">{access.requirements.map((item, index) => { const confirmedStatus = item.status === "confirmed"; const statusLabel = item.status === "needs_confirmation" ? "Needs confirmation" : item.status === "not_available" ? "Not available" : item.status === "unknown" ? "Unknown" : "Confirmed"; const statusClass = item.status === "confirmed" ? "bg-primary/12 text-primary" : item.status === "not_available" ? "bg-destructive/12 text-destructive" : item.status === "unknown" ? "bg-secondary text-muted-foreground" : "bg-accent/25 text-foreground"; return <button data-testid={`button-requirement-${item.key}`} key={`${item.key}-${index}`} onClick={() => updateRequirement(index)} className="focus-ring card-surface grid w-full gap-4 rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5 sm:grid-cols-[auto_1fr_auto] sm:items-start"><span className={`grid h-11 w-11 place-items-center rounded-xl ${statusClass}`}>{confirmedStatus ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <HelpCircle className="h-6 w-6" aria-hidden="true" />}</span><span><span className="block font-bold">{item.name}</span><span className="mt-1 block text-[.95rem] text-muted-foreground">{item.reason}</span><span className="mt-3 block text-sm font-semibold text-foreground">{item.recommended_action}</span></span><span className={`rounded-full px-3 py-1 text-sm font-bold ${statusClass}`}>{statusLabel}</span></button>; })}</div><div className="mt-4"><Notice><span className="font-semibold">AI note:</span> {access.ai_notice}</Notice></div>{error && <div className="mt-4"><Notice tone="amber">{error}</Notice></div>}{busy ? <div className="mt-7"><LoadingPanel label="Writing a starting request…" /></div> : bottomNav(runRequest, "Draft my request")}</div>;
  else if (step === 4) content = <div className="step-appear"><StepHeading eyebrow="Put it in your words" title="Edit the request before you send it.">This is a starting point, not a script. Keep, change, or remove anything. SIGNAL will not send it for you.</StepHeading><div className="card-surface grid gap-5 rounded-2xl p-5 sm:p-7"><Field label="Subject" value={request.subject} onChange={(value) => setRequest((current) => ({ ...current, subject: value }))} testId="input-request-subject" /><label className="grid gap-2"><span className="font-semibold">Message</span><textarea data-testid="textarea-request-body" value={request.body} onChange={(event) => setRequest((current) => ({ ...current, body: event.target.value }))} rows={12} className="focus-ring min-h-72 resize-y rounded-xl border border-input bg-background px-4 py-4 leading-relaxed" /></label></div><div className="mt-4"><Notice><span className="font-semibold">AI note:</span> {request.ai_notice}</Notice></div>{error && <div className="mt-4"><Notice tone="amber">{error}</Notice></div>}<div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><button data-testid="button-go-back" onClick={() => setStep(3)} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</button><div className="flex flex-col gap-3 sm:flex-row"><PrimaryButton testId="button-copy-request" onClick={copyRequest} variant="quiet">{copied ? <Check className="h-5 w-5" /> : <Clipboard className="h-5 w-5" />}{copied ? "Copied" : "Copy draft"}</PrimaryButton><PrimaryButton testId="button-confirm-request" onClick={() => { setConfirmed(false); setStep(5); }} disabled={!request.subject.trim() || !request.body.trim()}><Send className="h-5 w-5" />Request ready to send</PrimaryButton></div></div></div>;
  else content = <div className="step-appear"><StepHeading eyebrow={confirmed ? "Final communication plan" : "Employer confirmation"} title={confirmed ? "Your plan is clear." : "Confirm what HR can provide."}>{confirmed ? "You have a communication plan ready to copy, share, or keep as a reference before your interview." : "This mock confirmation shows how the plan changes when an employer confirms or cannot provide a support."}</StepHeading><div className="card-surface rounded-2xl p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/25 text-accent-foreground"><ShieldCheck className="h-5 w-5" /></span><div><h3 className="font-bold">Employer confirmation</h3><p className="text-sm text-muted-foreground">Toggle each support to simulate HR’s reply.</p></div></div><div className="grid gap-3">{EMPLOYER_SUPPORT_OPTIONS.map((option) => { const available = employerSupport[option.key]; return <button key={option.key} data-testid={`toggle-employer-${option.key}`} aria-pressed={available} onClick={() => setEmployerSupport((current) => ({ ...current, [option.key]: !current[option.key] }))} className="focus-ring flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-4 text-left hover:bg-secondary"><span><span className="block font-bold">{option.label}</span><span className="block text-sm text-muted-foreground">{option.detail}</span></span><span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${available ? "bg-primary/12 text-primary" : "bg-destructive/12 text-destructive"}`}>{available ? "Confirmed" : "Not available"}</span></button>; })}</div>{!confirmed && <div className="mt-6 flex justify-end"><PrimaryButton testId="button-confirm-employer" onClick={() => setConfirmed(true)}><CheckCircle2 className="h-5 w-5" />Confirm support</PrimaryButton></div>}</div>{confirmed && <div className="mt-5 card-surface overflow-hidden rounded-2xl"><div className="border-b border-border bg-primary px-5 py-5 text-primary-foreground sm:px-7"><div className="flex items-center gap-3"><CheckCircle2 className="h-7 w-7" /><div><p className="text-sm font-semibold text-primary-foreground/75">Ready to use</p><h3 className="text-xl font-bold">Interview communication plan</h3></div></div></div><div className="grid gap-0 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="p-5"><p className="eyebrow text-muted-foreground">Live captions</p><p className="mt-2 font-bold">{employerSupport.live_captions ? "Confirmed" : "Not available"}</p><p className="text-sm text-muted-foreground">Check before the call</p></div><div className="p-5"><p className="eyebrow text-muted-foreground">Written questions</p><p className="mt-2 font-bold">{employerSupport.written_questions ? "Confirmed" : "Not available"}</p><p className="text-sm text-muted-foreground">Ask for chat prompts</p></div><div className="p-5"><p className="eyebrow text-muted-foreground">Text-chat backup</p><p className="mt-2 font-bold">{employerSupport.text_chat_backup ? "Confirmed" : "Not available"}</p><p className="text-sm text-muted-foreground">Keep chat open</p></div></div><div className="border-t border-border px-5 py-5 sm:px-7"><p className="font-bold">Before the interview</p><ul className="mt-3 grid gap-2 text-muted-foreground"><li>Join 10 minutes early.</li><li>Check captions and your chosen communication channel.</li><li>Keep chat open as a backup if support changes.</li><li>VSL interpreter: {employerSupport.vsl_interpreter ? "Confirmed" : "Not available"}.</li></ul></div></div>}{confirmed && <div className="mt-5 flex flex-col gap-3 sm:flex-row"><PrimaryButton testId="button-copy-confirmed-request" onClick={copyRequest}>{copied ? <Check className="h-5 w-5" /> : <Clipboard className="h-5 w-5" />}{copied ? "Copied" : "Copy request"}</PrimaryButton><PrimaryButton testId="button-start-over" onClick={restart} variant="quiet"><RefreshCw className="h-5 w-5" />Start another plan</PrimaryButton></div>}</div>;

  return <Shell><main className="mx-auto grid max-w-[1440px] gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[280px_minmax(0,720px)] lg:gap-20 lg:py-16"><ProgressRail step={step} setStep={setStep} /><section aria-live="polite" data-testid="signal-step-content">{content}</section></main><footer className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-border/70 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><span className="font-semibold text-foreground">SIGNAL is a preparation tool, not a medical or legal service.</span><span>Built for clarity, on your terms.</span></footer></Shell>;
}

export default App;