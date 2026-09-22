import { test, expect } from "@playwright/test";
const details = {
  date: "2026-10-08",
  time: "09:00",
  timezone: "Asia/Ho_Chi_Minh",
  format: "Online",
  locationOrLink: "https://example.com/meeting",
};
async function candidate(page, interpreter = false) {
  let creates = 0,
    shares = 0;
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const url = new URL(request.url());
    if (url.pathname === "/api/v2/plans") creates++;
    if (/\/plans\/[^/]+\/share$/.test(url.pathname)) shares++;
  });
  await page.goto("/");
  for (const [key, label] of interpreter
    ? [["vsl_interpreter", "Phiên dịch ngôn ngữ ký hiệu Việt Nam"]]
    : [
        ["live_captions", "Phụ đề trực tiếp"],
        ["text_chat_backup", "Kênh chat dự phòng"],
      ]) {
    await page.getByTestId(`support-${key}`).check();
    await page.getByLabel(`Mức độ: ${label}`).selectOption("essential");
  }
  await page.getByRole("button", { name: "Tiếp tục tới thư mời" }).click();
  await page
    .getByTestId("invitation")
    .fill(
      interpreter
        ? "We cannot arrange an interpreter, but we will enable live captions."
        : "We invite you to an online interview on Zoom.",
    );
  await page.getByRole("button", { name: "Phân tích / Thử lại" }).click();
  for (const [key, value] of Object.entries(details))
    await page.getByTestId(`detail-${key}`).fill(value);
  await page
    .getByRole("button", { name: "Kiểm tra hỗ trợ", exact: true })
    .click();
  await page.getByRole("button", { name: "Tạo mẫu thư" }).click();
  await page.getByRole("button", { name: "Duyệt nội dung chia sẻ" }).click();
  await expect(
    page.getByRole("button", { name: "Lưu và tạo liên kết HR" }),
  ).toBeDisabled();
  await page.getByTestId("consent").check();
  await page.getByRole("button", { name: "Lưu và tạo liên kết HR" }).dblclick();
  await expect(page.getByLabel("Liên kết HR")).toBeVisible();
  expect(creates).toBe(1);
  expect(shares).toBe(1);
  return page.getByLabel("Liên kết HR").inputValue();
}
async function reply(hr, link, answers) {
  await hr.goto(link);
  await expect(hr).toHaveURL(/\/hr$/);
  for (const [key, status, detail, alternative] of answers) {
    await hr.getByLabel(`HR: ${key}`, { exact: true }).selectOption(status);
    await hr.getByLabel(`Chi tiết: ${key}`, { exact: true }).fill(detail);
    if (alternative)
      await hr
        .getByLabel(`Phương án: ${key}`, { exact: true })
        .fill(alternative);
  }
  await hr.getByLabel("Tên người trả lời (tự khai)").fill("HR test");
  await hr.getByRole("button", { name: "Gửi phản hồi", exact: true }).click();
  await expect(hr.getByRole("status")).toContainText("Đã lưu");
}
test("E01 E04 F10 F11 F14 S07 S10 two contexts, approval/export, HR changes invalidate", async ({
  page,
  browser,
}) => {
  const link = await candidate(page);
  const context = await browser.newContext();
  const hr = await context.newPage();
  await reply(hr, link, [
    ["live_captions", "confirmed", "We will enable captions."],
    ["text_chat_backup", "confirmed", "Chat stays open."],
  ]);
  await page.getByRole("button", { name: "Tải phản hồi mới nhất" }).click();
  await expect(page.getByTestId("readiness")).toContainText(
    "awaiting_candidate_review",
  );
  await page.getByTestId("review-plan").check();
  await page.getByRole("button", { name: "Duyệt kế hoạch hiện tại" }).click();
  await expect(page.getByTestId("readiness")).toContainText("ready");
  await page.getByRole("button", { name: "Sao chép kế hoạch" }).click();
  await expect(page.getByLabel("Nội dung để sao chép thủ công")).toContainText(
    "Kế hoạch giao tiếp",
  );
  await page.reload();
  await expect(page.getByTestId("readiness")).toContainText("ready");
  await hr
    .getByLabel("HR: live_captions", { exact: true })
    .selectOption("not_available");
  await hr
    .getByLabel("Chi tiết: live_captions", { exact: true })
    .fill("<script>window.injected=true</script>");
  await hr.getByRole("button", { name: "Gửi phản hồi", exact: true }).click();
  await expect(hr.getByRole("status")).toContainText("Đã lưu");
  await page.getByRole("button", { name: "Tải phản hồi mới nhất" }).click();
  await expect(page.getByTestId("readiness")).toContainText("needs_action");
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(
    page.getByText("<script>window.injected=true</script>", { exact: true }),
  ).toBeVisible();
  await context.close();
});
test("E02 E03 essential interpreter only resolved by accepted specific alternative", async ({
  page,
  browser,
}) => {
  const link = await candidate(page, true);
  const context = await browser.newContext();
  const hr = await context.newPage();
  await reply(hr, link, [
    [
      "vsl_interpreter",
      "not_available",
      "No interpreter.",
      "Live captions throughout the interview, with a caption accuracy check before starting.",
    ],
  ]);
  await page.getByRole("button", { name: "Tải phản hồi mới nhất" }).click();
  await page.getByTestId("review-plan").check();
  await page.getByRole("button", { name: "Duyệt kế hoạch hiện tại" }).click();
  await expect(page.getByTestId("readiness")).toContainText("needs_action");
  await page
    .getByLabel("Tôi chấp nhận phương án này:", { exact: false })
    .check();
  await page.getByRole("button", { name: "Duyệt kế hoạch hiện tại" }).click();
  await expect(page.getByTestId("readiness")).toContainText("ready");
  await context.close();
});
test("E06 F04 F05 F07 edits require new consent and revoke previous link", async ({
  page,
  browser,
}) => {
  const link = await candidate(page);
  await page.getByRole("button", { name: "1. Nhu cầu", exact: true }).click();
  await page.getByTestId("support-written_responses").check();
  await page.getByLabel("Mức độ: Trả lời bằng chữ").selectOption("preferred");
  await page.getByRole("button", { name: "Tiếp tục tới thư mời" }).click();
  await page.getByRole("button", { name: "Phân tích / Thử lại" }).click();
  for (const [key, value] of Object.entries(details))
    await page.getByTestId(`detail-${key}`).fill(value);
  await page
    .getByRole("button", { name: "3. Kiểm tra chi tiết", exact: true })
    .click();
  await page.getByTestId("detail-company").fill("New company");
  await page
    .getByRole("button", { name: "Kiểm tra hỗ trợ", exact: true })
    .click();
  await page.getByRole("button", { name: "Tạo mẫu thư" }).click();
  await expect(page.getByTestId("draft")).toContainText("New company");
  await page.getByRole("button", { name: "Duyệt nội dung chia sẻ" }).click();
  await expect(page.getByTestId("consent")).not.toBeChecked();
  await page.getByTestId("consent").check();
  await page.getByRole("button", { name: "Lưu và tạo liên kết HR" }).click();
  await expect(page.getByLabel("Liên kết HR")).toBeVisible();
  const context = await browser.newContext();
  const hr = await context.newPage();
  await hr.goto(link);
  await expect(hr.getByRole("alert")).toContainText("thu hồi");
  await hr.goto(await page.getByLabel("Liên kết HR").inputValue());
  await expect(
    hr.getByLabel("HR: written_responses", { exact: true }),
  ).toBeVisible();
  await context.close();
});
test("E05 F02 F09 AI unavailable allows manual current data and clipboard fallback", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByTestId("support-live_captions").check();
  await page.getByLabel("Mức độ: Phụ đề trực tiếp").selectOption("essential");
  await page.getByRole("button", { name: "Tiếp tục tới thư mời" }).click();
  await page.getByTestId("invitation").fill("New invitation, not a sample.");
  await page.getByLabel("Chế độ phân tích").selectOption("ai");
  await page
    .getByLabel("Tôi đồng ý gửi nội dung thư này", { exact: false })
    .check();
  await page.getByRole("button", { name: "Phân tích / Thử lại" }).click();
  await expect(page.getByRole("alert")).toContainText("AI");
  await expect(page.getByTestId("invitation")).toHaveValue(
    "New invitation, not a sample.",
  );
  await page.getByRole("button", { name: "Nhập tay", exact: true }).click();
  await page.getByTestId("detail-company").fill("Manual Company");
  for (const [key, value] of Object.entries(details))
    await page.getByTestId(`detail-${key}`).fill(value);
  await page
    .getByRole("button", { name: "Kiểm tra hỗ trợ", exact: true })
    .click();
  await page.getByRole("button", { name: "Tạo mẫu thư" }).click();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Sao chép thư", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Chưa sao chép");
  await expect(page.getByLabel("Nội dung để sao chép thủ công")).toContainText(
    "Manual Company",
  );
  await page.getByRole("button", { name: "Duyệt nội dung chia sẻ" }).click();
  await page.getByTestId("consent").check();
  await page.getByRole("button", { name: "Lưu và tạo liên kết HR" }).click();
  await expect(page.getByLabel("Liên kết HR")).toBeVisible();
  const context = await browser.newContext();
  const hr = await context.newPage();
  await reply(hr, await page.getByLabel("Liên kết HR").inputValue(), [
    ["live_captions", "confirmed", "Captions will be enabled."],
  ]);
  await page.getByRole("button", { name: "Tải phản hồi mới nhất" }).click();
  await page.getByTestId("review-plan").check();
  await page.getByRole("button", { name: "Duyệt kế hoạch hiện tại" }).click();
  await expect(page.getByTestId("readiness")).toContainText("ready");
  await context.close();
});
test("E07 F01 F12 X03 X04 X05 demo isolation and narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("support-live_captions")).not.toBeChecked();
  await page.getByRole("button", { name: "Thử mẫu demo" }).click();
  await expect(page.getByRole("note")).toContainText("DEMO");
  await page.getByRole("button", { name: "Tiếp tục tới thư mời" }).click();
  await page.getByRole("button", { name: "Phân tích / Thử lại" }).click();
  await page
    .getByRole("button", { name: "Kiểm tra hỗ trợ", exact: true })
    .click();
  await expect(
    page.getByText("Chưa có thông tin", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tạo mẫu thư" }).click();
  await page.getByRole("button", { name: "Duyệt nội dung chia sẻ" }).click();
  await page.getByTestId("consent").check();
  await page.getByRole("button", { name: "Tiếp tục mô phỏng demo" }).click();
  await expect(page.getByTestId("readiness")).toContainText("needs_action");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/demo-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Bắt đầu chế độ thật" }).click();
  await expect(page.getByTestId("support-live_captions")).not.toBeChecked();
  await expect(page.getByRole("note")).toHaveCount(0);
});

async function keyboardFocus(page, locator) {
  for (let i = 0; i < 100; i++) {
    if (await locator.evaluate((e) => e === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Control unreachable with Tab");
}
async function keyboardActivate(page, locator, key = "Enter") {
  await keyboardFocus(page, locator);
  await page.keyboard.press(key);
}
test("X01 keyboard-only candidate and HR review; X02 heading focus; U04 language-stable selection", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Nhu cầu", exact: true }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    page.getByTestId("support-live_captions"),
    "Space",
  );
  await keyboardFocus(page, page.getByLabel("Mức độ: Phụ đề trực tiếp"));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await keyboardFocus(page, page.getByLabel("Ngôn ngữ nhãn hỗ trợ"));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("support-live_captions")).toBeChecked();
  await expect(page.getByLabel("Mức độ: Live captions")).toHaveValue(
    "essential",
  );
  await keyboardFocus(page, page.getByLabel("Ngôn ngữ nhãn hỗ trợ"));
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Tiếp tục tới thư mời" }),
  );
  await keyboardFocus(page, page.getByTestId("invitation"));
  await page.keyboard.insertText(
    "We invite you to an online interview on Zoom.",
  );
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Phân tích / Thử lại" }),
  );
  for (const [key, value] of Object.entries(details)) {
    await expect(page.getByTestId(`detail-${key}`)).toBeVisible();
    await keyboardFocus(page, page.getByTestId(`detail-${key}`));
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText(value);
  }
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Kiểm tra hỗ trợ", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Hỗ trợ và bằng chứng", exact: true }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Tạo mẫu thư" }),
  );
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Duyệt nội dung chia sẻ" }),
  );
  await keyboardActivate(page, page.getByTestId("consent"), "Space");
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Lưu và tạo liên kết HR" }),
  );
  await expect(page.getByLabel("Liên kết HR")).toBeVisible();
  const context = await browser.newContext();
  const hr = await context.newPage();
  await hr.goto(await page.getByLabel("Liên kết HR").inputValue());
  await expect(
    hr.getByLabel("HR: live_captions", { exact: true }),
  ).toBeVisible();
  await keyboardFocus(hr, hr.getByLabel("HR: live_captions", { exact: true }));
  await hr.keyboard.press("ArrowDown");
  await hr.keyboard.press("Enter");
  await keyboardFocus(
    hr,
    hr.getByLabel("Chi tiết: live_captions", { exact: true }),
  );
  await hr.keyboard.insertText("We will enable captions.");
  await keyboardFocus(hr, hr.getByLabel("Tên người trả lời (tự khai)"));
  await hr.keyboard.insertText("Keyboard HR");
  await keyboardActivate(
    hr,
    hr.getByRole("button", { name: "Gửi phản hồi", exact: true }),
  );
  await expect(hr.getByRole("status")).toContainText("Đã lưu");
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Tải phản hồi mới nhất" }),
  );
  await keyboardActivate(page, page.getByTestId("review-plan"), "Space");
  await keyboardActivate(
    page,
    page.getByRole("button", { name: "Duyệt kế hoạch hiện tại" }),
  );
  await expect(page.getByTestId("readiness")).toContainText("ready");
  await context.close();
});
test("F03 late analysis never replaces edited invitation; F06 evidence is not a toggle", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("support-live_captions").check();
  await page.getByLabel("Mức độ: Phụ đề trực tiếp").selectOption("essential");
  await page.getByRole("button", { name: "Tiếp tục tới thư mời" }).click();
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/api/v2/analyze-invitation", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response }).catch((error) => {
      if (!/already handled|closed/.test(error.message)) throw error;
    });
  });
  await page
    .getByTestId("invitation")
    .fill("Company: Old company; We will enable captions.");
  await page.getByRole("button", { name: "Phân tích / Thử lại" }).click();
  await page
    .getByTestId("invitation")
    .fill("Company: New company; No support information.");
  release();
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Phân tích / Thử lại" }).click();
  await expect(page.getByTestId("detail-company")).toHaveValue("New company");
  await page
    .getByRole("button", { name: "Kiểm tra hỗ trợ", exact: true })
    .click();
  await page.getByText("Xem bằng chứng", { exact: true }).click();
  await expect(
    page.getByText("Chưa có thông tin", { exact: true }),
  ).toBeVisible();
});

test("F15 expired candidate UI does not restore by public ID", async ({
  page,
  context,
}) => {
  await candidate(page);
  const saved = page.url();
  await context.clearCookies();
  await page.goto(saved);
  await expect(page.getByRole("alert")).toContainText("Phiên đã hết hạn");
  await expect(page.getByTestId("readiness")).toHaveCount(0);
});
test("U01 U02 explicit VSL arrangement and confirmed removal; F07 draft change revokes consent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Ngôn ngữ ký hiệu Việt Nam", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Tiếp tục tới thư mời" }),
  ).toBeDisabled();
  await page.getByLabel("Ai bố trí phiên dịch?").selectOption("hr");
  await expect(page.getByTestId("support-vsl_interpreter")).toBeChecked();
  await page
    .getByLabel("Mức độ: Phiên dịch ngôn ngữ ký hiệu Việt Nam")
    .selectOption("essential");
  await page.getByLabel("Ai bố trí phiên dịch?").selectOption("self");
  await expect(page.getByRole("alert")).toContainText("thay đổi nhu cầu");
  await page
    .getByRole("button", { name: "Xác nhận thay đổi nhu cầu", exact: true })
    .click();
  await expect(page.getByTestId("support-vsl_interpreter")).not.toBeChecked();
  await page.getByTestId("support-written_responses").check();
  await page.getByLabel("Mức độ: Trả lời bằng chữ").selectOption("essential");
  await page.getByRole("button", { name: "Tiếp tục tới thư mời" }).click();
  await page.getByTestId("invitation").fill("We invite you to an interview.");
  await page.getByRole("button", { name: "Phân tích / Thử lại" }).click();
  await page
    .getByRole("button", { name: "Kiểm tra hỗ trợ", exact: true })
    .click();
  await page.getByRole("button", { name: "Tạo mẫu thư" }).click();
  await page.getByRole("button", { name: "Duyệt nội dung chia sẻ" }).click();
  await page.getByTestId("consent").check();
  await page
    .getByRole("button", { name: "5. Thư yêu cầu", exact: true })
    .click();
  await page.getByTestId("draft").fill("Edited draft.");
  await page.getByRole("button", { name: "Duyệt nội dung chia sẻ" }).click();
  await expect(page.getByTestId("consent")).not.toBeChecked();
});

