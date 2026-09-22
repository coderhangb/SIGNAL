# SIGNAL

SIGNAL giúp ứng viên Điếc/khiếm thính và người cần hỗ trợ giao tiếp chuẩn bị kế hoạch trước phỏng vấn, phối hợp với HR để làm rõ từng nhu cầu. Ứng viên kiểm soát thông tin chia sẻ và tự duyệt phương án cuối.

## Chức năng hiện có

- Chọn cách giao tiếp và hỗ trợ bằng key ổn định; phân biệt cần thiết/mong muốn. Chọn VSL có bước làm rõ ai bố trí phiên dịch.
- Dán thư mời dạng text; phân tích bằng rules hoặc AI được cấu hình, hoặc nhập tay. Hiện bằng chứng và bốn trạng thái: confirmed, needs_confirmation, unknown, not_available.
- Chỉnh chi tiết phỏng vấn, tạo/sửa mẫu thư chỉ theo nhu cầu đã chọn, duyệt các trường chia sẻ trước khi tạo link HR.
- Lưu snapshot và revision vào PostgreSQL; HR phản hồi từng mục qua link; ứng viên chấp nhận/từ chối phương án cụ thể, duyệt bản hiện tại và copy kế hoạch cuối.
- Thay đổi dữ liệu làm mất hiệu lực kết quả/consent/approval liên quan. Thay snapshot đã lưu thu hồi link cũ; HR đổi phản hồi yêu cầu ứng viên duyệt lại. Có thu hồi link và xóa kế hoạch.
- Demo có nhãn riêng, không tạo phản hồi thật giả danh HR. Không tự gửi email, tự cung cấp captions, nhận diện ký hiệu, OCR, chấm điểm ứng viên hoặc tự chọn phương án thay ứng viên.

## Công nghệ và cấu trúc

JavaScript, React 19, Vite 7, Tailwind CSS 4, Express 5, PostgreSQL qua `pg`, npm workspaces `artifacts/*`. Test dùng Node test runner, Playwright và PGlite (PostgreSQL WASM chỉ trong test).

```text
artifacts/signal/src/          React: pages, state reducer, api client, components
artifacts/api-server/src/      API: domain, services, repositories, routes, config
  db/migrations/001_plans.sql  Migration PostgreSQL
artifacts/api-server/tests/    Unit, provider và HTTP/SQL integration tests
artifacts/signal/tests/        Reducer tests
tests/                        Browser E2E, runtime tests, test DB helpers
scripts/                      Migration, lint, syntax, E2E runner, AI/holdout eval
lib/api-spec/openapi.yaml      Contract v2 (JSON là cú pháp YAML hợp lệ)
lib/*                         Scaffold/generated TS cũ, không thuộc root workspaces
.env.example                  Cấu hình mẫu, không có secret
CODE_PLAN.md                   Đặc tả và tiêu chí nghiệm thu
IMPLEMENTATION_STATUS.md       Từng ID, bằng chứng và việc còn lại
TEST_REPORT.md                 Kết quả lịch sử và kiểm tra tài liệu hiện tại
GITHUB_PUSH_GUIDE.md           Các bước tự đưa lên GitHub
```

V1 được giữ trong source lịch sử nhưng không mount; giao diện hiện tại gọi v2. Không tự sửa generated client. Build dùng esbuild WASM khóa trong package-lock để tránh lỗi binary native của sandbox Windows trước đây; không cần pnpm/catalog. `scripts/post-merge.sh` chỉ cài npm, không tự đẩy schema DB.

## Yêu cầu môi trường

- Môi trường đã kiểm tra: **Windows, Node 22.19.0, npm 10.9.3**. Dùng bộ phiên bản này để tái lập. Root package.json chưa khai báo `engines` hay `packageManager`; Vite 7 yêu cầu Node `^20.19.0 || >=22.12.0`, còn script dùng `--env-file-if-exists`, nên hướng dẫn này chọn Node 22.19 trở lên trong nhánh 22. `.replit` cấu hình Node 24 nhưng chưa có bằng chứng kiểm thử Node 24 ở máy này.
- PostgreSQL server và công cụ `psql` khi cần lưu/chia sẻ HR. Dự án chưa khóa một phiên bản PostgreSQL server được chứng nhận; cần kiểm thử native trước nghiệm thu.
- AI key/model chỉ cần khi chọn AI. Git chỉ cần cho quản lý mã nguồn; đã phát hiện Git 2.49.0.windows.1.
- Chromium Playwright chỉ cần cho E2E. Cổng mặc định: API 3000, frontend 5173, test server 4173.

## Chạy trên Windows PowerShell

### 1. Vào đúng thư mục và cài dependency

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-09-23\h-y-tr-c-ti-p\outputs\SIGNAL-completed\SIGNAL'
Get-Item package.json, package-lock.json
node --version
npm --version
npm ci
if (!(Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
notepad .env
```

Nếu đã có `.env`, lệnh trên giữ nguyên file. Không chép đè cấu hình đang dùng. Để chạy rules/manual trước, có thể giữ `DATABASE_URL=` trống, `AI_PROVIDER=none` và các cổng mặc định. Không cần tự tạo API key giả. Sau khi sửa `.env`, khởi động lại cả hai terminal. Biến môi trường PowerShell đang có có thể ưu tiên hơn `.env`; kiểm tra cấu hình local nếu giá trị không đúng mong đợi.

### 2. Terminal backend

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-09-23\h-y-tr-c-ti-p\outputs\SIGNAL-completed\SIGNAL'
npm run dev:api
```

### 3. Terminal frontend khác

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-09-23\h-y-tr-c-ti-p\outputs\SIGNAL-completed\SIGNAL'
npm run dev
```

Mở **http://localhost:5173**. Vite proxy `/api` tới API 3000. Có thể kiểm tra API từ terminal khác:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/healthz'
```

Health thành công chỉ chứng minh API trả lời, không chứng minh DB/AI hoạt động. Dừng mỗi terminal bằng Ctrl+C. Không có DB: phân tích rules/manual và copy mẫu thư vẫn dùng được; thao tác lưu/chia sẻ trả lỗi 503 rõ ràng.

## Biến môi trường code đang sử dụng

Các biến ứng dụng đặt trong `.env` ở **gốc SIGNAL**, không phải dưới artifacts. Không đặt secret trong `VITE_*` vì đó là nhóm biến dành cho frontend. Ví dụ dưới đây không chứa credential thật.

| Biến | Mục đích / nơi đọc | Bắt buộc | Mặc định hoặc ví dụ |
|---|---|---|---|
| API_PORT | Cổng API; Vite dùng để proxy | Không | 3000 |
| PORT | Cổng API dự phòng nếu thiếu API_PORT; proxy Vite không đọc PORT | Không; ưu tiên API_PORT để đồng bộ | 3000 |
| FE_PORT | Cổng Vite dev/preview | Không | 5173 |
| APP_ORIGIN | Origin trình duyệt được phép gửi mutation; phải đúng scheme/host/port | Cần đúng URL khi đổi địa chỉ | http://localhost:5173 |
| NODE_ENV | `production` bật Secure cookie và bắt APP_ORIGIN HTTPS | Không cho dev | development; production khi có HTTPS |
| DATABASE_URL | Kết nối pg cho migration/lưu/chia sẻ | Có cho DB workflow | postgresql://signal_app:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/signal_dev |
| AI_PROVIDER | Chọn adapter: none hoặc openai-compatible | Không | none |
| AI_BASE_URL | Base URL adapter; adapter nối /chat/completions | Không; đổi theo provider | https://api.openai.com/v1 |
| AI_API_KEY | Key chỉ backend dùng | Có nếu AI_PROVIDER khác none | Để trống trong source; điền riêng trên máy |
| AI_MODEL | Tên model provider hỗ trợ structured JSON schema | Có khi bật AI | YOUR_SUPPORTED_MODEL |
| AI_TIMEOUT_MS | Timeout mỗi lần gọi AI, 1–60000 ms | Không | 15000 |
| INVITATION_LIMIT | Giới hạn text thư, 1–100000 ký tự; JSON body vẫn bị giới hạn 128 KiB | Không | 20000 |
| RATE_LIMIT | Ngưỡng request /api/v2 theo IP mỗi phút, 1–10000 | Không | 60 |
| SESSION_HOURS | Thời hạn session, 1–8760 giờ | Không | 168 |
| GRANT_HOURS | Thời hạn share grant, 1–720 giờ | Không | 72 |
| BASE_PATH | Base asset URL của Vite; UI/router hiện dùng đường dẫn gốc | Không; giữ / cho local | / |
| REPL_ID | Khi tồn tại ngoài production, bật plugin phát triển Replit | Không trên Windows | Bỏ trống/không đặt |

Các biến chỉ phục vụ test/helper, thường đặt bằng `$env:TEN_BIEN = '...'` trong terminal chạy test; các script test không tự nạp `.env` như `dev:api`:

| Biến | Mục đích | Bắt buộc / ví dụ |
|---|---|---|
| TEST_DATABASE_URL | Chọn PostgreSQL native thay PGlite; chỉ chấp nhận database tên signal_test | Tùy chọn; cùng dạng URL ở trên nhưng DB là signal_test |
| TEST_DATA_DIR | Thư mục dữ liệu PGlite cho server test/restart | Tùy chọn; test-results/restart-local |
| TEST_PG_DIR | Thư mục helper embedded Postgres | Tùy chọn; mặc định test-data/postgres |
| E2E_EXTERNAL_SERVER | Playwright config bỏ tự tạo webServer khi biến có giá trị | Runner tự đặt; không cần đặt tay |
| PLAYWRIGHT_BROWSERS_PATH | Thư viện Playwright chọn nơi cài/tìm browser | Tùy chọn; nên dùng mặc định nếu chưa cấu hình |

`LOG_LEVEL` chỉ nằm trong module logger cũ không được entrypoint hiện tại import; không có tác dụng điều khiển log API hiện tại. Không liệt kê nó như cấu hình bắt buộc. `.replit` đặt `CI` cho công cụ build; không phải cấu hình nghiệp vụ SIGNAL.

## PostgreSQL và migration

Cài/chạy PostgreSQL riêng trên máy, thêm thư mục `bin` vào PATH nếu PowerShell chưa tìm thấy `psql`. Dùng database phát triển riêng, không dùng dữ liệu thật. Với tài khoản quản trị PostgreSQL của bạn (ví dụ `postgres`):

```powershell
psql --version
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

Trong **psql**, chạy từng lệnh dưới đây nếu role/database chưa tồn tại. `\password` hỏi mật khẩu tương tác, không ghi mật khẩu vào câu SQL:

```sql
CREATE ROLE signal_app LOGIN;
\password signal_app
CREATE DATABASE signal_dev OWNER signal_app;
CREATE DATABASE signal_test OWNER signal_app;
\q
```

Nếu role/database đã tồn tại, kiểm tra và dùng lại đúng DB phát triển của bạn; không DROP hoặc ghi đè. `signal_dev` dùng cho chạy thử ứng dụng, `signal_test` dành riêng cho automated tests. Điền `DATABASE_URL` trong `.env` bằng URL thực, thay placeholder và percent-encode ký tự đặc biệt trong mật khẩu. Không chia sẻ file này.

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-09-23\h-y-tr-c-ti-p\outputs\SIGNAL-completed\SIGNAL'
npm run db:migrate
npm run dev:api
```

Migration thật ở `artifacts/api-server/src/db/migrations/001_plans.sql`, chạy trong transaction. API khởi động kiểm tra version migration; không tự migrate. Nếu DATABASE_URL đã đặt nhưng DB/migration lỗi, API dừng với thông báo. Không có DATABASE_URL thì API vẫn chạy phần không cần DB.

Native integration/E2E: đặt `TEST_DATABASE_URL` trong môi trường terminal bằng kết nối riêng tới **signal_test**, rồi chạy `npm run test:integration`, build và `npm run test:e2e`. Không đưa URL có mật khẩu vào chat/log; không commit cấu hình. Test harness tự áp dụng migration vào DB test. PGlite là engine mặc định khi không đặt biến này, không thay thế pg trong production. Helper `scripts/test-postgres.mjs` chỉ dành cho test local; lần trước initdb bị sandbox chặn, nên không lấy helper đó làm bằng chứng PostgreSQL native PASS.

## AI thật, rules/manual và demo

Để bật AI, sửa `.env`: AI_PROVIDER=openai-compatible, AI_BASE_URL theo provider, AI_API_KEY riêng và AI_MODEL đúng model hỗ trợ `chat/completions` cùng structured JSON schema; khởi động lại backend. Không có model mặc định ngầm. UI yêu cầu consent gửi thư tới provider, tách khỏi consent HR.

Adapter không cấp tools, kiểm tra schema/quote/ngữ cảnh sau khi nhận kết quả. Timeout mặc định 15 giây mỗi lần, tối đa một retry lỗi tạm thời. Provider lỗi cho phép Retry hoặc nhập tay; không tự thay bằng fixture hoặc gọi rules là AI. Rules là nhận diện bảo thủ, cần người dùng review thư tự do; mẫu thư là template. Demo có nhãn DEMO ở các bước và không tạo HR response thật.

`npm run test:ai-live` là lệnh opt-in gửi fixture synthetic tới provider đã cấu hình. Kết quả cũ: BLOCKED do thiếu cấu hình; chưa có bằng chứng AI live thành công. Tham khảo triển khai cũ: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [transaction node-postgres](https://node-postgres.com/features/transactions).

## Build và kiểm thử

Các lệnh sau có thật trong root package.json:

| Lệnh | Tác dụng |
|---|---|
| npm run dev / npm run dev:api | Chạy frontend / backend |
| npm run db:migrate | Migration DB được cấu hình |
| npm run build | Build backend và frontend |
| npm start | Chạy backend đã build, phục vụ cả frontend dist |
| npm run preview | Vite preview frontend đã build; vẫn cần API riêng |
| npm run lint | ESLint |
| npm run check:syntax | Syntax JS/JSX; không phải TypeScript typecheck |
| npm test | Unit rồi HTTP/SQL integration |
| npm run test:unit / npm run test:integration | Chạy riêng từng nhóm |
| npm run test:runtime | Proxy, SPA/API, restart dữ liệu đĩa, frontend bundle |
| npm run test:e2e | Playwright và isolated server, dọn tiến trình qua IPC |
| npm run test:ai-live | Eval AI thật, cần cấu hình riêng |

Thứ tự kiểm tra thông thường (dừng dev servers để tránh chiếm cổng test):

```powershell
npm run lint
npm run check:syntax
npm test
npm run build
npm run test:runtime
npx playwright install chromium
npm run test:e2e
```

E2E cần frontend dist mới và cổng 4173 trống. Runtime tests dùng 3000/5173/4173; chạy riêng với E2E. Browser report mới được tạo tại `test-results/html/index.html`; báo cáo HTML/trace cũ không nằm trong ZIP chia sẻ, chỉ giữ log đã chọn. Không gọi fixture/mock-provider PASS là AI thật PASS. Generated TS trong lib không được kiểm tra kiểu trong luồng runtime JavaScript.

Xem bản build local trên một cổng: sau build, ở terminal backend đặt `$env:APP_ORIGIN = 'http://localhost:3000'`, chạy `npm start` rồi mở localhost:3000 (giữ dev mode). Production thực sự cần APP_ORIGIN HTTPS, NODE_ENV=production và reverse proxy HTTPS; chưa triển khai/kiểm thử hosting đó.

## Kịch bản thử xuyên suốt

Cần PostgreSQL và migration để làm trọn vòng HR; có thể dùng rules thay AI.

1. Mở chế độ thật, chọn Phụ đề trực tiếp và Kênh chat dự phòng, đánh dấu mức độ cần thiết.
2. Dán thư thử: “We invite you to an online interview on Zoom.” Chọn Rules. Zoom không tự chứng minh có captions. Điền/kiểm tra ngày ISO, giờ, múi giờ Asia/Ho_Chi_Minh, hình thức Online và link thử không chứa dữ liệu thật.
3. Review bằng chứng, tạo/sửa mẫu thư, kiểm tra không có hỗ trợ ngoài lựa chọn. Duyệt trường chia sẻ, mặc định chỉ supports, rồi đồng ý tạo link HR.
4. Mở link bằng profile/cửa sổ riêng. HR điền confirmed và chi tiết cho từng mục, gửi phản hồi. Đây là người giữ link tự khai, không phải danh tính doanh nghiệp đã xác minh.
5. Ứng viên tải phản hồi, kiểm tra nội dung và duyệt revision hiện tại. Chỉ lúc đủ details, essential đã giải quyết và có approval đúng bản mới được ready. Copy plan phải chứa kế hoạch hiện tại và nguồn.
6. HR sửa một mục thành unavailable; ứng viên tải lại phải mất ready và cần xử lý/duyệt lại. Essential không tự được thay bằng phương án khác: ứng viên phải chấp nhận phương án cụ thể.
7. Sửa nhu cầu và chia sẻ snapshot mới, link cũ không tiếp tục sử dụng được. Bản nháp đang sửa trên UI chưa phải snapshot đã lưu; có nút thu hồi ngay ở màn hình plan.

Cookie ẩn danh là quyền truy cập; mất cookie không khôi phục được bằng plan ID. Link có thể bị chuyển tiếp. Copy thư không có nghĩa đã gửi. Demo không phải bằng chứng backend/DB thật hoạt động.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| ENOENT package.json / chạy npm sai thư mục | Set-Location đúng gốc ở trên; Get-Item package.json, package-lock.json. Không npm init để chữa lỗi này |
| npm ci báo thiếu lock hoặc lock không khớp | Kiểm tra giải nén đầy đủ và thay đổi package.json; không xóa lock để che lỗi. Lockfile đã khóa esbuild WASM |
| PowerShell chặn npm.ps1 | Dùng npm.cmd thay npm trong các lệnh; không cần tắt chính sách toàn máy |
| Backend không kết nối / proxy ECONNREFUSED | Chạy terminal API, kiểm tra API_PORT khớp proxy; dùng healthz. Không dùng PORT đơn lẻ khi FE vẫn proxy 3000 |
| 403 Origin/CSRF | Mở đúng APP_ORIGIN; localhost khác 127.0.0.1. Khi đổi FE_PORT phải đổi APP_ORIGIN và restart |
| Lưu/link trả 503 hoặc DB unavailable/migration missing | Kiểm tra DATABASE_URL riêng trên máy, dịch vụ PostgreSQL/port/role, chạy db:migrate. Không bỏ qua migration |
| AI không cấu hình hoặc provider lỗi | Dùng rules/manual; khi bật AI cần provider/key/model hợp lệ. Xem lỗi đã được làm sạch; không đăng raw key |
| EADDRINUSE / Port is already in use | Ctrl+C terminal cũ, hoặc tìm PID bằng lệnh dưới. Chỉ dừng tiến trình bạn nhận diện; không kill hàng loạt Node |
| Link/phiên hết hạn hoặc 409 revision | Tải phản hồi mới; tạo link mới qua chủ kế hoạch khi cần. Không dùng ID để bỏ qua ownership |
| E2E thiếu executable hoặc giao diện cũ | npx playwright install chromium; npm run build trước test:e2e |

```powershell
Get-NetTCPConnection -LocalPort 3000,5173,4173 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
# Thay PID bằng số đã kiểm tra: Get-Process -Id 12345
```

## Tiến độ và giới hạn

Bạn đã xác nhận npm ci và khởi chạy được bản giải nén này trên Windows. Lượt tài liệu chỉ kiểm tra source/hash/config/Git, không chạy lại build hoặc test ứng dụng. **41 Node + 4 runtime + 9 browser PASS là báo cáo trước**, có log đi kèm; không phải kết quả mới trên máy bạn. Việc khởi chạy không chứng minh DB/AI/nghiệp vụ đầy đủ.

Native PostgreSQL concurrency/restart, AI live, screen reader, zoom trình duyệt 200%, holdout >=20 EN/VI do người gán nhãn và pilot với ứng viên/HR vẫn chưa có bằng chứng nghiệm thu. PGlite serializes transaction trong harness, không đủ thay native concurrent clients. UI chính tiếng Việt, chỉ nhãn nhu cầu đổi Việt/Anh; chưa dịch Anh toàn bộ. Không có bằng chứng cải thiện tỷ lệ tuyển dụng.

Ưu tiên tiếp theo: (1) PostgreSQL native và lifecycle/concurrency; (2) AI live + holdout độc lập; (3) screen reader/zoom; (4) pilot với hai nhóm người dùng. Xem IMPLEMENTATION_STATUS.md theo từng ID. Đưa code lên GitHub theo GITHUB_PUSH_GUIDE.md không đồng nghĩa deploy ứng dụng.
