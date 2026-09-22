# Đưa SIGNAL lên GitHub từ Windows PowerShell

## Trạng thái thực tế trước khi bắt đầu

Thư mục đã kiểm tra:

```text
C:\Users\Admin\Documents\Codex\2026-09-23\h-y-tr-c-ti-p\outputs\SIGNAL-completed\SIGNAL
```

Git đã cài: 2.49.0.windows.1. `git rev-parse --show-toplevel`, `git status --short --branch`, `git remote -v` đều trả về “not a git repository”. Vì vậy hiện chưa có branch, remote, staged files hoặc lịch sử Git trong thư mục này. Chưa tự init/stage/commit/push/deploy. Bản code trước sửa tài liệu khớp 68/68 hash thay đổi cuối của gói bàn giao.

Đã rà source/config/docs theo mẫu token GitHub/provider, private key và URL có credential; chưa phát hiện secret thật theo các mẫu đó. Có credential cố định chỉ phục vụ helper DB test local, không dùng cho production. Không có file `.env` local tại thời điểm kiểm tra; không sửa cấu hình. Kiểm tra theo mẫu không bảo đảm tìm mọi secret. Nếu bạn bổ sung file/cấu hình sau đó, rà lại trước stage. Không có Git history ở đây để audit; không kết luận về lịch sử repository khác hoặc remote chưa được cung cấp.

`.gitignore` giữ mã nguồn, package.json, lockfile, migration, `.env.example`, docs và tests; loại node_modules, dist, log, `.env*` (trừ template), DB local, test-results/trace, evidence, archive và private-key containers. SQL migration không bị bỏ qua. Những log lịch sử được giữ trên máy để đối chiếu, không stage cả thư mục evidence. TEST_REPORT và IMPLEMENTATION_STATUS mang theo kết quả tổng hợp.

## 1. Tạo repository GitHub mới

Đăng nhập GitHub → New repository. Chọn tên (ví dụ SIGNAL), owner và visibility phù hợp. Tạo **repository trống**, không thêm README, .gitignore hoặc license từ GitHub vì local đã có file; tránh hai lịch sử khởi tạo độc lập. Tạo repo xong, lấy HTTPS URL sạch dạng `https://github.com/OWNER/REPOSITORY.git` hoặc SSH URL nếu đã cấu hình SSH. Không nhúng token/password trong URL và không dán token vào chat. [Hướng dẫn GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

Bạn cần điền URL ở bước 5. Không có URL thật trong tài liệu này. Đưa code lên GitHub không chạy migration hay deploy ứng dụng.

## 2. Vào đúng thư mục, init chỉ nếu chưa có repo

Chạy từng khối theo thứ tự; dừng khi lệnh báo lỗi, không tiếp tục push một cách tự động.

```powershell
Set-Location 'C:\Users\Admin\Documents\Codex\2026-09-23\h-y-tr-c-ti-p\outputs\SIGNAL-completed\SIGNAL'
Get-Item package.json, package-lock.json, .gitignore, .env.example
git --version

$signalGitRoot = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0) {
    git init -b main
    if ($LASTEXITCODE -ne 0) { throw 'git init thất bại; dừng và kiểm tra.' }
} elseif ([System.IO.Path]::GetFullPath($signalGitRoot.Trim()) -ne (Get-Location).Path) {
    throw 'Đang thuộc repository thư mục cha. Dừng để kiểm tra đúng repo, không init lồng.'
}
git branch --show-current
git remote -v
git status --short --branch
```

Hiện chưa có repo nên lần đầu khối trên tạo branch `main`. Nếu bạn đã init trước khi đọc tài liệu, khối này giữ branch/repo đang có; không đổi tên branch hoặc ghi đè remote. Nếu `branch --show-current` rỗng (detached HEAD), dừng và chọn branch làm việc phù hợp trước commit/push.

## 3. Rà file trước khi stage

```powershell
git status --short --untracked-files=all
git ls-files --others --exclude-standard
git check-ignore -v -- .env .env.local node_modules/test.txt artifacts/signal/dist/index.html test-results/artifacts/trace.zip test-data/postgres/PG_VERSION evidence/e2e.log
# Các file sau phải không bị ignore; không có output và exit 1 là bình thường:
git check-ignore -v -- .env.example package-lock.json artifacts/api-server/src/db/migrations/001_plans.sql README.md
# Tìm file đã được theo dõi nhưng nay thuộc ignore rules (lần init đầu sẽ rỗng):
git ls-files -ci --exclude-standard
```

Mở và đọc file dự kiến stage trên máy của bạn, nhất là config, docs, test fixtures và script. Không đăng raw `.env`/URL DB/token/ảnh HR ra công khai. Không dùng `git add .` hoặc `git add -f` để bỏ qua bước rà.

Nếu một secret đã bị theo dõi, `.gitignore` không tự bỏ nó khỏi index. Ví dụ **chỉ khi `.env` đang tracked**, chạy:

```powershell
git ls-files -- .env
git rm --cached -- .env
Test-Path -LiteralPath .env
```

`--cached` chỉ bỏ theo dõi và giữ file local. Với file khác, thay đúng đường dẫn đã xác nhận; không xóa cache toàn repo. Nếu secret từng được commit, bỏ theo dõi không xóa nó khỏi lịch sử. Dừng push, thu hồi/đổi credential liên quan và lên phương án xử lý history có phối hợp; tài liệu này không tự viết lại lịch sử. [GitHub về ignore](https://docs.github.com/en/get-started/git-basics/ignoring-files), [git rm --cached](https://git-scm.com/docs/git-rm).

## 4. Stage danh sách đã rà, xem diff, commit

Chỉ chạy sau khi bạn đã xem danh sách file ở bước 3. Danh sách này gồm các thư mục source/test hiện có; `.gitignore` tiếp tục loại generated files bên trong.

```powershell
git add -- .gitignore .env.example .replit .replitignore package.json package-lock.json eslint.config.js playwright.config.js README.md CODE_PLAN.md IMPLEMENTATION_STATUS.md TEST_REPORT.md GITHUB_PUSH_GUIDE.md replit.md artifacts lib scripts tests
if ($LASTEXITCODE -ne 0) { throw 'Stage lỗi; kiểm tra lại trước commit.' }
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check
git diff --cached
git status --short
```

Xem diff trên máy, không gửi nội dung nhạy cảm lên chat. Không được có `.env` thật, DB dump, log/trace, node_modules hoặc secret. Muốn bỏ một file khỏi stage trước commit đầu tiên mà vẫn giữ trên đĩa: `git rm --cached -- 'DUONG_DAN_FILE_DA_XAC_NHAN'`. Không thêm `-f`; nếu Git từ chối vì file đã đổi, kiểm tra lại trước khi xử lý. Với repo đã có commit có thể dùng `git restore --staged -- 'DUONG_DAN_FILE_DA_XAC_NHAN'`.

Kiểm tra identity local; nếu chưa có hoặc không đúng, điền tên/email của bạn (có thể dùng email noreply do GitHub cấp). Không cần đổi global:

```powershell
git config --get user.name
git config --get user.email
# Chỉ chạy hai dòng sau nếu cần, thay placeholder trước:
# git config user.name 'TEN_HIEN_THI_CUA_BAN'
# git config user.email 'EMAIL_HOAC_NOREPLY_CUA_BAN'
```

Sau khi diff đã đúng và identity sẵn sàng, tự commit:

```powershell
git commit -m 'Prepare SIGNAL source, tests and Vietnamese documentation'
if ($LASTEXITCODE -ne 0) { throw 'Commit chưa thành công; chưa push.' }
git status --short --branch
```

## 5. Chọn remote an toàn và tự push

Thay URL placeholder. Remote dưới đây tên `signal-github`, được chọn cho lần đưa code này lên GitHub; không giả định đã có `origin`. Nếu bạn muốn dùng remote khác đã có, thay `$signalRemote` bằng đúng tên sau khi kiểm tra URL. Không ghi đè remote khi URL khác.

```powershell
$signalRepoUrl = 'https://github.com/THAY_OWNER/THAY_REPOSITORY.git'
$signalRemote = 'signal-github'
if ($signalRepoUrl -match 'THAY_OWNER|THAY_REPOSITORY') {
    throw 'Điền URL repository GitHub thật trước khi tiếp tục.'
}
if ($signalRepoUrl -match '^https?://[^/]*@') {
    throw 'Không nhúng token/userinfo vào URL. Dùng URL GitHub sạch.'
}
git remote -v
$signalRemotes = @(git remote)
if ($signalRemotes -contains $signalRemote) {
    $signalExistingUrl = git remote get-url $signalRemote
    if ($signalExistingUrl.Trim() -ne $signalRepoUrl) {
        throw 'Remote đã có URL khác. Kiểm tra và chọn tên remote khác; không ghi đè.'
    }
} else {
    git remote add $signalRemote $signalRepoUrl
    if ($LASTEXITCODE -ne 0) { throw 'Không thêm được remote.' }
}
git remote get-url --all $signalRemote
git remote get-url --push --all $signalRemote
# Xác nhận cả fetch/push URL đều đúng; nếu có URL lạ, dừng trước push.
git ls-remote $signalRemote
if ($LASTEXITCODE -ne 0) { throw 'Chưa truy cập được remote; kiểm tra URL/quyền đăng nhập.' }
$signalBranch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($signalBranch)) { throw 'Chưa ở branch; dừng trước push.' }
git status --short --branch
git push -u $signalRemote $signalBranch
```

Không dùng force push. Với repository mới trống, `ls-remote` có thể không in ref nào và exit 0. Nếu repository đã có commit, đọc mục rejected dưới đây trước khi xử lý. Đăng nhập bằng Git Credential Manager/trình duyệt hoặc SSH đã cấu hình; token chỉ nhập ở trình quản lý xác thực phù hợp, không lưu vào source/URL. [Quản lý remote](https://docs.github.com/en/get-started/git-basics/managing-remote-repositories).

## Xử lý lỗi thường gặp

- **Author identity unknown / thiếu user.name, user.email:** cấu hình local theo bước 4 rồi commit lại. Không tự dùng danh tính người khác.
- **Authentication failed / Permission denied:** kiểm tra đúng owner/repo và quyền ghi; đăng nhập lại Git Credential Manager đúng tài khoản hoặc cấu hình SSH public key với GitHub. Không dùng password tài khoản GitHub để thay token trong Git HTTPS. Không tắt SSL để chữa lỗi.
- **remote origin already exists:** dùng `git remote -v` để xem URL; nếu đúng, chọn `$signalRemote = 'origin'`. Nếu khác, giữ nguyên và chọn tên mới, ví dụ `signal-github`. Không chạy remote set-url hoặc remove mù quáng.
- **Push rejected / non-fast-forward:** không force. `git fetch $signalRemote`, sau đó `git log --oneline --graph --decorate --all` để so sánh. Nếu cùng lịch sử, có thể rebase/merge sau khi review và giải quyết conflict; chỉ push khi đã kiểm tra. Nếu GitHub được khởi tạo riêng bằng README/license, lựa chọn đơn giản là tạo repo trống khác và thêm remote tên khác, giữ repo cũ; không tự dùng allow-unrelated-histories để che khác biệt. [GitHub về push](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository).
- **nothing to commit:** xem git status; nếu đã có commit đúng thì chuyển kiểm tra remote, không sửa file giả để ép commit.
- **GitHub push protection phát hiện secret:** dừng và xử lý credential/lịch sử thích hợp; không bypass chỉ để push thành công.

Sau push thành công, mở repository GitHub, kiểm tra README, source, lockfile, migration và `.env.example`; xác nhận không có file `.env`, data hoặc log. Chỉ lúc đó mới coi upload hoàn tất. Các giới hạn nghiệm thu DB/AI/accessibility trong TEST_REPORT vẫn giữ nguyên.
