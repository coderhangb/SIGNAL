export const blankInterview = () => ({
  company: null,
  position: null,
  date: null,
  time: null,
  timezone: null,
  format: null,
  platform: null,
  locationOrLink: null,
  durationMinutes: null,
});
export function initialState() {
  return {
    step: 0,
    inputRevision: 0,
    profile: {
      communicationMethods: [],
      supports: [],
      shareCommunicationMethods: false,
    },
    invitation: "",
    interview: blankInterview(),
    analysis: null,
    access: null,
    draft: null,
    manualObservations: [],
    consent: false,
    plan: null,
    dirty: false,
    demo: false,
    requestId: null,
    busy: false,
    error: "",
    mode: "rules",
  };
}
const invalidated = {
  access: null,
  draft: null,
  consent: false,
  requestId: null,
  busy: false,
  error: "",
};
export function planningReducer(s, a) {
  switch (a.type) {
    case "RESET":
      return { ...initialState(), ...(a.sample || {}) };
    case "STEP":
      return { ...s, step: a.step, error: "" };
    case "PROFILE":
      return {
        ...s,
        ...invalidated,
        profile: a.value,
        inputRevision: s.inputRevision + 1,
        dirty: true,
        manualObservations: s.manualObservations.filter((o) =>
          a.value.supports.some((x) => x.key === o.key),
        ),
        plan: s.plan ? { ...s.plan, approval: null } : null,
      };
    case "INVITATION":
      return {
        ...s,
        ...invalidated,
        invitation: a.value,
        analysis: null,
        interview: blankInterview(),
        manualObservations: [],
        inputRevision: s.inputRevision + 1,
        dirty: true,
        plan: s.plan ? { ...s.plan, approval: null } : null,
      };
    case "DETAIL":
      return {
        ...s,
        ...invalidated,
        interview: { ...s.interview, [a.key]: a.value || null },
        inputRevision: s.inputRevision + 1,
        dirty: true,
        plan: s.plan ? { ...s.plan, approval: null } : null,
      };
    case "DRAFT":
      return {
        ...s,
        busy: false,
        requestId: null,
        error: "",
        draft: a.value,
        consent: false,
        dirty: true,
        inputRevision: s.inputRevision + 1,
        plan: s.plan ? { ...s.plan, approval: null } : null,
      };
    case "MANUAL_OBSERVATION":
      return {
        ...s,
        busy: false,
        requestId: null,
        error: "",
        draft: null,
        consent: false,
        dirty: true,
        inputRevision: s.inputRevision + 1,
        plan: s.plan ? { ...s.plan, approval: null } : null,
        manualObservations: [
          ...s.manualObservations.filter((o) => o.key !== a.value.key),
          a.value,
        ],
      };
    case "CONSENT":
      return { ...s, consent: a.value };
    case "SAVED":
      return { ...s, plan: a.plan, dirty: false };
    case "START":
      return { ...s, busy: true, requestId: a.id, error: "" };
    case "ERROR":
      return a.id && a.id !== s.requestId
        ? s
        : { ...s, busy: false, requestId: null, error: a.message };
    case "RESULT":
      if (s.requestId !== a.id || s.inputRevision !== a.inputRevision) return s;
      return { ...s, ...a.value, busy: false, requestId: null, error: "" };
    case "MANUAL":
      return {
        ...s,
        ...invalidated,
        analysis: null,
        mode: "manual",
        step: 2,
        dirty: true,
      };
    case "RESTORE":
      return {
        ...initialState(),
        ...a.plan.snapshot,
        plan: a.plan,
        step: 6,
        dirty: false,
        access: { requirements: a.plan.snapshot.requirements },
        consent: false,
      };
    default:
      return s;
  }
}
