import { useState } from "react";
export default function PreferencesPage({ profile, catalog, onChange, next }) {
  const [pending, setPending] = useState(null);
  const [labelLanguage, setLabelLanguage] = useState("vi");
  const displayedCatalog = {
    communicationMethods: catalog.communicationMethods.map((m) => ({
      ...m,
      labelVi: labelLanguage === "en" ? m.labelEn : m.labelVi,
    })),
    supports: catalog.supports.map((s) => ({
      ...s,
      labelVi: labelLanguage === "en" ? s.labelEn : s.labelVi,
    })),
  };
  function commit(p) {
    const removesEssential = profile.supports.some(
      (s) =>
        s.importance === "essential" &&
        !p.supports.some(
          (n) => n.key === s.key && n.importance === "essential",
        ),
    );
    if (removesEssential) setPending(p);
    else onChange(p);
  }
  function toggleSupport(key, checked) {
    commit({
      ...profile,
      ...(key === "vsl_interpreter" &&
      profile.communicationMethods.includes("vsl")
        ? { interpreterArrangement: checked ? "hr" : "record_only" }
        : {}),
      supports: checked
        ? [...profile.supports, { key, importance: "" }]
        : profile.supports.filter((s) => s.key !== key),
    });
  }
  const valid =
    profile.supports.every((s) => s.importance) &&
    (!profile.communicationMethods.includes("vsl") ||
      profile.interpreterArrangement) &&
    (profile.interpreterArrangement !== "hr" ||
      profile.supports.some((s) => s.key === "vsl_interpreter"));
  return (
    <div className="grid gap-5">
      <p>
        Chọn cách giao tiếp và hỗ trợ bạn cần. Mỗi lựa chọn do bạn quyết định.
      </p>
      <label>
        Ngôn ngữ nhãn hỗ trợ
        <select
          value={labelLanguage}
          onChange={(e) => setLabelLanguage(e.target.value)}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
      <fieldset>
        <legend>Cách giao tiếp</legend>
        {displayedCatalog.communicationMethods.map((m) => (
          <label className="choice" key={m.key}>
            <input
              type="checkbox"
              checked={profile.communicationMethods.includes(m.key)}
              onChange={(e) =>
                commit({
                  ...profile,
                  communicationMethods: e.target.checked
                    ? [...profile.communicationMethods, m.key]
                    : profile.communicationMethods.filter((k) => k !== m.key),
                })
              }
            />
            {m.labelVi}
          </label>
        ))}
      </fieldset>
      {profile.communicationMethods.includes("vsl") && (
        <label>
          Ai bố trí phiên dịch?{" "}
          <select
            aria-label="Ai bố trí phiên dịch?"
            value={profile.interpreterArrangement || ""}
            onChange={(e) => {
              const value = e.target.value;
              commit({
                ...profile,
                interpreterArrangement: value,
                supports:
                  value === "hr" &&
                  !profile.supports.some((s) => s.key === "vsl_interpreter")
                    ? [
                        ...profile.supports,
                        { key: "vsl_interpreter", importance: "" },
                      ]
                    : value !== "hr"
                      ? profile.supports.filter(
                          (s) => s.key !== "vsl_interpreter",
                        )
                      : profile.supports,
              });
            }}
          >
            <option value="">Chọn để làm rõ</option>
            <option value="hr">Đề nghị HR bố trí</option>
            <option value="self">Tôi tự bố trí</option>
            <option value="record_only">Chỉ ghi nhận cách giao tiếp</option>
          </select>
        </label>
      )}
      <fieldset>
        <legend>Hỗ trợ mong muốn</legend>
        {displayedCatalog.supports.map((s) => {
          const selected = profile.supports.find((p) => p.key === s.key);
          return (
            <div className="support-choice" key={s.key}>
              <label className="choice">
                <input
                  type="checkbox"
                  data-testid={`support-${s.key}`}
                  checked={!!selected}
                  onChange={(e) => toggleSupport(s.key, e.target.checked)}
                />
                {s.labelVi}
              </label>
              {selected && (
                <select
                  aria-label={`Mức độ: ${s.labelVi}`}
                  value={selected.importance}
                  onChange={(e) =>
                    commit({
                      ...profile,
                      supports: profile.supports.map((p) =>
                        p.key === s.key
                          ? { ...p, importance: e.target.value }
                          : p,
                      ),
                    })
                  }
                >
                  <option value="">Chọn mức độ</option>
                  <option value="essential">Cần thiết</option>
                  <option value="preferred">Mong muốn</option>
                </select>
              )}
            </div>
          );
        })}
      </fieldset>
      {profile.supports.some((s) => s.key === "vsl_interpreter") && (
        <label>
          Loại ngôn ngữ ký hiệu / ghi chú do bạn xác nhận
          <input
            value={profile.interpreterNotes || ""}
            maxLength={2000}
            onChange={(e) =>
              onChange({ ...profile, interpreterNotes: e.target.value })
            }
          />
        </label>
      )}
      <label className="choice">
        <input
          type="checkbox"
          checked={profile.shareCommunicationMethods}
          onChange={(e) =>
            onChange({
              ...profile,
              shareCommunicationMethods: e.target.checked,
            })
          }
        />
        Cho phép thêm cách giao tiếp vào thư yêu cầu và nội dung chia sẻ
      </label>
      {pending && (
        <div role="alert" className="notice">
          <p>
            Bạn đang bỏ hoặc giảm mức độ một hỗ trợ cần thiết. Xác nhận đây là
            thay đổi nhu cầu của bạn.
          </p>
          <button
            onClick={() => {
              onChange(pending);
              setPending(null);
            }}
          >
            Xác nhận thay đổi nhu cầu
          </button>
          <button onClick={() => setPending(null)}>Giữ nhu cầu cũ</button>
        </div>
      )}
      {!valid && (
        <p role="status">
          Hãy chọn mức độ cho từng hỗ trợ và làm rõ phiên dịch VSL.
        </p>
      )}
      <button className="primary" disabled={!valid || !!pending} onClick={next}>
        Tiếp tục tới thư mời
      </button>
    </div>
  );
}
