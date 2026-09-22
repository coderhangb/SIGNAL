let candidateCsrf = "",
  hrCsrf = "";
export function setHrCsrf(value) {
  hrCsrf = value;
}
export async function api(
  path,
  { method = "GET", data, signal, text = false, role = "candidate" } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 35000);
  try {
    const res = await fetch(`/api/v2${path}`, {
      method,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": role === "hr" ? hrCsrf : candidateCsrf,
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    if (!res.ok) {
      const result = await res.json().catch(() => null);
      throw new Error(
        result?.error?.message ||
          `Dịch vụ chưa sẵn sàng (${res.status}). Thử lại hoặc nhập tay.`,
      );
    }
    if (res.status === 204) return null;
    return text ? await res.text() : await res.json();
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(
        "Yêu cầu bị hủy hoặc hết thời gian chờ. Bạn có thể thử lại.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export async function session(restore = false) {
  const result = await api(
    "/session",
    restore ? {} : { method: "POST", data: {} },
  );
  candidateCsrf = result.csrf;
}
export async function copyText(text) {
  if (!navigator.clipboard?.writeText)
    throw new Error(
      "Chưa sao chép. Chọn văn bản bên dưới và sao chép thủ công.",
    );
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error(
      "Chưa sao chép. Chọn văn bản bên dưới và sao chép thủ công.",
    );
  }
}
