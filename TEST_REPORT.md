# TEST_REPORT — SIGNAL

Báo cáo kiểm thử từ lượt triển khai trước, ngày 2026-09-23 (không chạy lại trong lượt tài liệu). Windows, Node.js 22.19.0, npm workspaces, Chromium Playwright. Working copy không có .git: không có commit để gán; dùng `evidence/source-changes.json` (SHA-256) xác định nội dung bàn giao. Không đo coverage và không tuyên bố 100% coverage.

## Kết quả báo cáo trước — không chạy lại trong lượt tài liệu

| Lệnh | Kết quả thực | Bằng chứng |
|---|---|---|
| `npm ci --no-audit --no-fund --cache ../../work/npm-cache` | PASS, clean install với lockfile esbuild WASM; 540 package | evidence/clean-install.log |
| `npm run build` | PASS backend và frontend | evidence/build.log |
| `npm run build --workspace=@workspace/signal` sau sửa UI cuối | PASS | evidence/frontend-build-final.log |
| `npm run lint` | PASS, không lỗi/warning lint | evidence/lint.log |
| `npm run check:syntax` | PASS, syntax JS và JSX; không phải TypeScript typecheck | evidence/syntax.log |
| `node --test artifacts/api-server/tests/unit/*.test.js artifacts/signal/tests/*.test.js artifacts/api-server/tests/integration/*.test.js` | PASS 41/41 (32 unit/provider/state + 9 HTTP/SQL integration); 0 skip | evidence/node-tests.log |
| `node --test artifacts/signal/tests/*.test.js` sau chỉnh reducer cuối | PASS 3/3, là chạy lại, không cộng thêm vào 41 | evidence/state-tests-final.log |
| `npm run test:runtime` | PASS 4/4: proxy thật, production routes, process restart + dữ liệu đĩa, frontend bundle | evidence/runtime-tests.log |
| `npm run test:e2e` | PASS 9/9, hai browser contexts khi cần; 33.6 giây | evidence/e2e.log; HTML lịch sử không kèm ZIP; log còn tại evidence/e2e.log |
| `node scripts/run-e2e.mjs --grep E02` | PASS 1/1 (8.5 giây); chạy lại E02/E03 với phương án captions đúng fixture plan, không cộng số test | evidence/e2e-alternative-final.log |
| `npm run test:ai-live` | BLOCKED, exit 2: chưa cấu hình AI_PROVIDER/AI_API_KEY/AI_MODEL | evidence/ai-live.log |
| `node scripts/evaluate-holdout.mjs` | BLOCKED, exit 2: chưa có holdout >=20 EN/VI do người gán nhãn | evidence/holdout.log |

Tổng các test tự động độc lập đã PASS: **54 = 41 + 4 + 9**. Nhiều ID plan nằm trong cùng một testcase; không gọi 97 ID là 97 test độc lập. Test bổ sung E02/E03 chỉ thay fixture phương án và chạy lại kịch bản hiện có.

## Phạm vi bằng chứng

- Domain: từng INV01–INV12; negation, conditional, conflict, ASL/VSL, forwarded context, quote không có thật, ngày/múi giờ chưa rõ, model bịa thông tin; selected-only draft; preferred acknowledgement và essential alternative/approval.
- HTTP/SQL: Express thật, migrations và transaction SQL trên PGlite. Ownership, idempotency, stale revision, rollback event failure/approval, HR scope, revoked/expired grants, cookie dev/prod, Origin/CSRF, server validation, rate limit và DB unavailable đều được kiểm tra. Fake provider chỉ dùng ở test contract/timeout/retry.
- Runtime: Vite 5173 proxy tới API 3000; /hr và /plan/:id phục vụ SPA còn /api trả JSON/404 đúng; dừng/chạy lại backend thật với PGlite lưu trên đĩa phục hồi session/snapshot/grant/HR response/approval. Đây không phải native PostgreSQL restart.
- Browser: hai phiên, HR xác nhận và cập nhật sau approval, alternative cần chấp nhận rõ, edit nhu cầu/draft/detail vô hiệu consent và link cũ, AI lỗi nhập tay với dữ liệu mới, clipboard không có API, demo 320px/reduced motion, keyboard cả hai vai, late response, expired candidate session, VSL clarification, language-stable keys. Kiểm tra script note được render text. Screenshot/trace lỗi lịch sử đã loại khỏi ZIP; không hiện diện trong bản giải nén này.

## FAIL đã phát hiện và sửa

1. Baseline INV02 bị confirmed, VSL/written responses bị bỏ qua: sửa catalog/evidence/status; fixture regression PASS.
2. Native esbuild không duyệt được thư mục dưới sandbox: khóa alias esbuild-wasm, tạo lại lockfile; clean install và cả hai build PASS.
3. Heading chưa nhận focus khi catalog về sau render đầu: sửa dependency focus; keyboard browser PASS.
4. Mở /hr#token mới trong cùng tab không reset/exchange: thêm xử lý hash navigation, reset form/request; E06 với nhu cầu mới và link mới PASS, link cũ bị từ chối.
5. Hủy request khi sửa nội dung có thể giữ busy/error cũ: reducer xóa trạng thái request; state regression PASS.
6. Playwright managed webServer trên Windows không dọn server: dùng runner IPC shutdown; lần chạy cuối hoàn tất, không còn tiến trình task chạy nền.

Không có FAIL chưa xử lý trong các suite đã chạy. Điều đó không loại bỏ các giới hạn dưới đây.

## BLOCKED / chưa chạy

- Native PostgreSQL: Docker engine không có; embedded-postgres wrapper bị os.userInfo dưới sandbox, initdb trực tiếp thất bại restricted-token errors 87/3. Production adapter pg đã viết, nhưng multi-client lock/concurrency và restart native DB chưa được chứng minh. PGlite harness serialize transaction; không dùng nó làm bằng chứng đầy đủ cho native concurrency.
- AI live: thiếu provider/model/key. Chưa có lời gọi mô hình thật; không có metric model accuracy. Rules/manual không cần API key và đã test.
- Human holdout và pilot với người dùng: chưa có dataset độc lập/participants. Script/hướng dẫn đã có, không tự tạo nhãn rồi coi là human evaluation.
- X02: semantics/heading focus/labels/alert đã kiểm tra tự động; chưa chạy screen reader thật. X03: viewport 320 CSS px đã PASS, browser zoom 200% chưa chạy. Cả hai giữ PARTIAL.
- Không có script TypeScript typecheck áp dụng cho runtime JavaScript. Generated TS libraries ngoài workspaces chưa build/typecheck và không được đưa vào phạm vi runtime ngầm.
- Chưa kiểm thử hosting công khai, reverse proxy HTTPS hay nhà cung cấp AI bên ngoài. Không deploy hoặc push theo yêu cầu.

## Tiếp tục/chạy lại

Xem README.md cho npm ci, .env, API/frontend và PostgreSQL migration. Đặt TEST_DATABASE_URL chỉ tới DB riêng tên signal_test để chạy native integration/E2E; không dùng dữ liệu thật. `tests/HOLDOUT.md` mô tả đầu vào eval. IMPLEMENTATION_STATUS.md ánh xạ từng ID và các bước còn bị chặn. Bản zip loại node_modules/dist/test-results/test-data và secret .env; cần npm ci/build trên máy chạy.

Kiểm tra bàn giao: git status thư mục gốc vẫn chỉ `?? CODE_PLAN.md`. Hai runner cuối trả exit 0 và shutdown server qua IPC. Truy vấn CommandLine tiến trình bằng Get-CimInstance bị Access denied ở sandbox; không suy ra inventory tiến trình toàn máy từ lệnh này.

## Kiểm tra trong lượt cập nhật README/GitHub

- Đúng thư mục người dùng chỉ định: `C:\Users\Admin\Documents\Codex\2026-09-23\h-y-tr-c-ti-p\outputs\SIGNAL-completed\SIGNAL`; 68/68 hash thay đổi bàn giao khớp trước khi sửa docs. Đã đọc CODE_PLAN, package scripts, config/env, Vite config, migration/test harness và các sửa cuối. Không sửa logic/config local.
- Node 22.19.0, npm 10.9.3, Git 2.49.0.windows.1. git rev-parse/status/remote đều báo chưa là repository; chưa có branch/remote/index/history để audit. Không git init, stage, commit, push ở dự án.
- Người dùng báo npm ci/khởi chạy thành công. Lượt này không chạy lại build/lint/application tests vì chỉ đổi tài liệu/.gitignore và log cũ đã có. Không gọi các số 41/4/9 là kết quả lượt này.
- Rà tệp text source/config/doc theo mẫu private key, provider/GitHub token, credential URL; không phát hiện secret thật theo các mẫu đã quét. Không có file .env local tại thời điểm kiểm tra. Helper test-postgres có credential cố định chỉ dành cho local test, đã phân loại, không in giá trị. Đây là kiểm tra theo mẫu, không đảm bảo phát hiện mọi loại secret. Không có lịch sử Git ở đây để kết luận về lịch sử một remote khác.
- Kiểm tra .gitignore bằng Git ở repository scratch ngoài dự án; xác minh loại .env/log/database/trace và giữ template/lockfile/migration/source/docs. Kiểm tra cấu trúc bảng đủ từng ID CODE_PLAN và bảo toàn hash các file ứng dụng.

evidence/ và PACKAGING_VERIFICATION.json là tài liệu cục bộ của gói cũ, .gitignore loại khỏi lần push. TEST_REPORT/IMPLEMENTATION_STATUS vẫn được theo dõi để mang theo kết quả tổng hợp. Nếu cần chia sẻ log, lọc riêng và rà trước, không force-add cả evidence.

Kết quả kiểm tra tài liệu lượt này: PASS cấu trúc 128 ID (12 B + 7 M + 97 U/A/F/I/S/E/X + 12 INV); PASS 30 trường hợp Git ignore/keep bằng Git scratch ngoài dự án; PASS tên npm scripts đối chiếu package.json; PASS parse cú pháp 15 khối PowerShell trong README/GITHUB_PUSH_GUIDE mà không thực thi commit/push. Hash xác nhận chỉ 4 file hiện hữu thay đổi (README, IMPLEMENTATION_STATUS, TEST_REPORT, .gitignore) và thêm GITHUB_PUSH_GUIDE; code/config/lockfile/migration không đổi. Trạng thái cuối: dự án vẫn chưa có .git.
