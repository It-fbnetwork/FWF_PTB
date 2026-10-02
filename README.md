# FWF Photo Booth

Hệ thống photobooth gồm website cloud trên Vercel và camera agent chạy tại máy booth Windows.

## Kiến trúc đang sử dụng

```text
Điện thoại khách
  https://ptb.facewashfox.com/checkin
                    |
                    v
Vercel / Railway Postgres / Cloudflare R2
                    |
                    v
Agent trên máy booth Windows
                    |
                    v
Sony Camera Remote Command (PTP) -> Sony ZV-E10
                    |
                    v
Chèn frame -> upload R2 -> display + điện thoại khách
```

Thiết bị hiển thị thực tế chỉ gồm:

- Màn hình booth: mở trang display cho khách xem frame, countdown và ảnh kết quả.
- Điện thoại của khách: check-in, chọn frame, bấm chụp và tải ảnh.

## Địa chỉ sử dụng

| Môi trường | Địa chỉ |
| --- | --- |
| Production | `https://ptb.facewashfox.com` |
| Check-in production | `https://ptb.facewashfox.com/checkin` |
| Display production | `https://ptb.facewashfox.com/display` |
| Web local | `http://localhost:3010` |
| Display local của agent | `http://localhost:3020/display` |

## Cấu trúc repository

```text
apps/web/       Next.js: check-in, operator, API và display cloud
apps/agent/     Agent Windows: nhận lệnh, theo dõi ảnh, ghép frame và upload
db/schema.sql   Schema Railway Postgres
docs/           Tài liệu kiểm thử
```

## Các ứng dụng cần có trên máy booth

- Windows 11.
- Node.js 20 trở lên. Máy hiện tại dùng Node.js 24.
- CMake 4.4.3.
- Visual Studio Build Tools 2022, workload C++ và MFC v143 x86/x64.
- Sony Camera Remote Command 2.02.00.
- Bản `CameraControlPTPExample for v2` đã được build và bổ sung IPC nền.
- Google Chrome để mở display.

Imaging Edge Desktop/Remote không còn dùng để phát lệnh chụp. Không mở `Remote.exe` khi chạy PTP vì hai ứng dụng có thể tranh kết nối camera.

## Camera và driver hiện tại

Camera thực tế là **Sony ZV-E10 đời đầu**, không phải ZV-E10 II.

Camera Remote SDK cấp cao không hỗ trợ model này. Hệ thống dùng **Sony Camera Remote Command (PTP)**, nhánh sample Windows v2.

Thiết lập trên camera:

1. `MENU -> Network -> Smartphone Connect -> Smartphone Connection -> Off`.
2. `MENU -> Network -> PC Remote Function`.
3. `PC Remote -> On`.
4. `PC Remote Cnct Method -> USB`.
5. Kết nối USB-C có truyền dữ liệu trực tiếp từ camera vào PC.

Driver đúng trong Windows Device Manager:

```text
Device: ZV-E10
Class: Portable Devices / WPD
Driver: MTP USB Device
INF: wpdmtp.inf
```

Không dùng driver `Sony Remote Control Camera / libusbK / oem11.inf` cho luồng PTP hiện tại. Driver đó có độ ưu tiên cao hơn MTP và làm `CameraControlPTP` báo `Camera Not Detected`.

Kiểm tra driver bằng PowerShell:

```powershell
pnputil /enum-devices /connected /class WPD
```

Kết quả phải có `ZV-E10`, trạng thái `Started`, driver `wpdmtp.inf`.

## Sony Camera Remote Command cục bộ

Gói Sony có giấy phép riêng nên source và binary không được commit vào Git. Máy booth hiện lưu chúng tại:

```text
C:\Users\Admin\Downloads\CameraRemoteCommand-2.02.00
C:\Users\Admin\Documents\Face Wash Fox\FWF_PTB\.local\sony-ptp\example-v2-windows
```

Executable đang dùng:

```text
C:\Users\Admin\Documents\Face Wash Fox\FWF_PTB\.local\sony-ptp\example-v2-windows\Release\CameraControlPTP.exe
```

Thư mục `.local/` được Git bỏ qua để không đẩy tài liệu/binary Sony lên GitHub.

Bản sample cục bộ đã được bổ sung IPC bằng Windows named event:

```text
Local\FWF_PTP_CAPTURE
```

Agent phát event này; CameraControlPTP nhận event và gọi S2 shutter trong nền. Vì vậy không cần đưa CameraControlPTP hoặc Imaging Edge ra foreground, và màn display luôn có thể nằm phía trước.

Nếu tải lại source Sony hoặc build lại từ đầu, phải áp dụng lại phần IPC cục bộ trước khi dùng với agent.

Build sample Sony:

```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe" `
  ".\CameraControlPTP.sln" `
  /t:Build `
  /p:Configuration=Release `
  /p:Platform=Win32 `
  /m
```

## Biến môi trường

Agent và web local đọc file:

```text
apps/web/.env.local
```

Các biến chính:

| Biến | Mục đích |
| --- | --- |
| `DATABASE_URL` | Railway Postgres |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret |
| `R2_BUCKET` | Tên bucket |
| `R2_PUBLIC_BASE_URL` | Public URL của ảnh, không có dấu `/` cuối |
| `OPERATOR_PIN` | PIN trang operator |
| `AGENT_TOKEN` | Token xác thực agent trên Vercel |
| `FWF_API_URL` | Production: `https://ptb.facewashfox.com` |
| `FWF_AGENT_TOKEN` | Cùng giá trị với `AGENT_TOKEN` |
| `FWF_WATCH_DIR` | Mặc định Windows: `C:\Users\Admin\Pictures` |
| `FWF_DATA_DIR` | Mặc định: `C:\Users\Admin\FWF_PhotoBooth` |
| `FWF_CAPTURE_MODE` | Có thể đặt `ptp-window`; đây cũng là mặc định hiện tại |

Không commit `.env.local` hoặc đưa secret vào README/log công khai.

## Quy trình mở booth hằng ngày

Thực hiện theo đúng thứ tự này.

### 1. Bật và kết nối camera

1. Bật Sony ZV-E10.
2. Kiểm tra `PC Remote = On` và phương thức kết nối là `USB`.
3. Cắm USB-C dữ liệu vào PC.
4. Không mở Imaging Edge Remote.

### 2. Mở CameraControlPTP

Chạy:

```powershell
Start-Process "C:\Users\Admin\Documents\Face Wash Fox\FWF_PTB\.local\sony-ptp\example-v2-windows\Release\CameraControlPTP.exe"
```

Trong ứng dụng:

1. Bấm `Connect`.
2. Chọn `ZV-E10` rồi bấm `OK`.
3. Kiểm tra các ô Model, pin, khẩu độ và tốc độ đã có dữ liệu.
4. Giữ `Save Media = Host Device`.
5. Bấm `Save Folder` và chọn `C:\Users\Admin\Pictures`.
6. Thu nhỏ ứng dụng. Không bấm `X` trong lúc booth hoạt động.

### 3. Chạy agent

Mở PowerShell mới:

```powershell
cd "C:\Users\Admin\Documents\Face Wash Fox\FWF_PTB"
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm.cmd run agent
```

Chỉ chạy **một agent**. Nhiều agent cùng chạy sẽ nhận cùng một lệnh và có thể chụp/xử lý/upload trùng.

Log khởi động đúng:

```text
Cloud API: https://ptb.facewashfox.com
Local LED display: http://localhost:3020/display
Watching: C:\Users\Admin\Pictures
Waiting for new photo...
```

### 4. Mở display

Trên màn hình booth, mở Chrome ở một trong hai địa chỉ:

```text
http://localhost:3020/display
https://ptb.facewashfox.com/display
```

Ưu tiên display local `3020` tại booth. Có thể bật fullscreen bằng `F11`.

### 5. Khách sử dụng

1. Khách mở `https://ptb.facewashfox.com/checkin`.
2. Nhập họ tên, số điện thoại và đồng ý điều khoản.
3. Chọn frame. Display sẽ preview frame đang chọn.
4. Khách bấm chụp trên điện thoại.
5. Display chạy countdown.
6. Agent phát `FWF_PTP_CAPTURE`; ZV-E10 chụp và lưu JPEG vào Pictures.
7. Agent ghép frame theo tỉ lệ 9:16, xuất ảnh cuối 900 x 1600.
8. Agent upload lên R2 và cập nhật session.
9. Ảnh xuất hiện trên display và điện thoại để tải xuống.

Log một lượt chụp thành công:

```text
Capture command for session ABC123
Remote capture requested. Shooting in 3 seconds...
Sony PTP S2 capture command sent in the background.
New photo detected...
Frame applied.
Output saved: C:\Users\Admin\FWF_PhotoBooth\processed\..._final.jpg
Upload OK
Public URL: https://...
DONE
Waiting for new photo...
```

## Chạy web local

Cài dependency:

```powershell
cd "C:\Users\Admin\Documents\Face Wash Fox\FWF_PTB"
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm.cmd install
```

Chạy web local trên port 3010:

```powershell
npm.cmd run dev
```

Agent dùng local API khi đặt:

```powershell
$env:FWF_API_URL = "http://localhost:3010"
npm.cmd run agent
```

Nếu không đặt biến tạm này, cấu hình trong `.env.local` sẽ quyết định API agent sử dụng.

## Kiểm tra nhanh PTP

Khi CameraControlPTP đã connect, có thể thử trực tiếp module trigger của agent:

```powershell
cd "C:\Users\Admin\Documents\Face Wash Fox\FWF_PTB"
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm.cmd run build -w @fwf/agent
node --input-type=module -e "import('./apps/agent/dist/capture-trigger.js').then(m => m.triggerCapture(0))"
```

Kết quả đúng:

```text
Sony PTP S2 capture command sent in the background.
```

Sau đó phải có JPEG mới trong:

```text
C:\Users\Admin\Pictures
```

## Dừng hệ thống

1. Dừng agent bằng `Ctrl+C` trong cửa sổ PowerShell.
2. Đóng CameraControlPTP.
3. Tắt camera hoặc rút USB nếu kết thúc vận hành.

## Xử lý lỗi thường gặp

### `Camera Not Detected`

- Kiểm tra camera đang ở `PC Remote -> USB`.
- Tắt `Smartphone Connection`.
- Đóng hoàn toàn Imaging Edge `Remote.exe`.
- Kiểm tra Device Manager phải hiện `ZV-E10` trong Portable Devices.
- Kiểm tra driver là `wpdmtp.inf`, không phải `oem11.inf/libusbK`.
- Rút/cắm lại USB-C và mở lại CameraControlPTP.

### Agent báo không tìm thấy event PTP

- CameraControlPTP chưa mở, chưa Connect hoặc đang dùng executable Sony nguyên bản chưa bổ sung IPC.
- Mở đúng executable trong `.local\sony-ptp\...\Release`.
- Connect camera và giữ ứng dụng chạy nền.

### Nút chụp trên điện thoại cứ hiện đang xử lý

- Xem log agent có nhận `Capture command for session ...` không.
- Xác nhận chỉ có một agent đang chạy.
- Kiểm tra CameraControlPTP vẫn connect.
- Kiểm tra có JPEG mới trong `C:\Users\Admin\Pictures`.
- Kiểm tra agent có log `Upload OK` và `DONE`.

### Ảnh chụp nhưng không hiện trên web

- Kiểm tra `DATABASE_URL`, R2 và token trong Vercel.
- Kiểm tra `FWF_API_URL=https://ptb.facewashfox.com`.
- Kiểm tra `FWF_AGENT_TOKEN` giống `AGENT_TOKEN` trên Vercel.
- Kiểm tra public R2 URL truy cập được.
- Nếu upload lỗi do mạng, agent giữ hàng đợi tại `C:\Users\Admin\FWF_PhotoBooth\upload-queue.json` và thử lại.

### Node/npm không được nhận diện

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
node --version
npm.cmd --version
```

### Dừng các agent chạy trùng

Không dừng tất cả tiến trình Node vì web hoặc công cụ khác cũng có thể dùng Node. Kiểm tra đúng command line `@fwf/agent` hoặc `dist/index.js`, rồi chỉ dừng PID tương ứng.

## Dịch vụ cloud

### Railway Postgres

Tạo PostgreSQL, lấy `DATABASE_URL`, sau đó chạy [`db/schema.sql`](db/schema.sql).

### Cloudflare R2

Bucket cần quyền Object Read/Write và public base URL để điện thoại/display tải ảnh.

### Vercel

- Repository: `It-fbnetwork/FWF_PTB`.
- Root Directory: `apps/web`.
- Production branch: `main`.
- Domain: `ptb.facewashfox.com`.

Các biến môi trường production phải được cấu hình trong Vercel và redeploy sau khi thay đổi.

## Kiểm thử thêm

Xem [`docs/VERIFY.md`](docs/VERIFY.md).
