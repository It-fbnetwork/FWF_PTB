# FWF PHOTO BOOTH & LED DISPLAY SYSTEM

**Project Technical Specification – v0.1**

**Project:** Face Wash Fox Photo Booth  
**Camera:** Sony ZV-E10  
**Development machine:** macOS  
**Camera software:** Sony Imaging Edge Desktop / Remote  
**Status:** Camera tethering tested successfully

This file is the project source of truth. **Current implementation is Phase 1 only** (local camera agent).

---

## 1. Mục tiêu dự án

Xây dựng hệ thống Photo Booth cho Face Wash Fox với flow:

```text
Khách quét QR
      ↓
Điền thông tin
      ↓
Check-in / vào hàng chờ
      ↓
Nhân viên chọn khách
      ↓
Khách chụp hình
      ↓
Sony ZV-E10
      ↓ USB-C
Mac
      ↓
Nhận ảnh tự động
      ↓
Ghép Frame FWF
      ↓
Upload ảnh
      ↓
Hiển thị lên màn hình LED
      ↓
Khách nhận/tải ảnh
```

Mục tiêu là giảm tối đa thao tác thủ công.

Photographer về cơ bản chỉ cần:

```text
Chọn khách
→ Chụp
→ Hệ thống xử lý
```

---

## 2. Hardware hiện có

### Camera

Sony ZV-E10, USB-C ↔ USB-C. Không sử dụng Wi-Fi cho camera trong phiên bản đầu tiên.

### Computer

Mac Apple Silicon. Mac đóng vai trò camera receiver, local FWF Agent, operator dashboard, LED output.

### LED

Mac → HDMI → LED Controller → LED Screen. Resolution / controller model TBD.

---

## 3. Camera integration – ĐÃ TEST THÀNH CÔNG

Sony Imaging Edge Remote nhận camera, Live View hoạt động, shutter trên body, ảnh tự động về Mac.

**STATUS: PASS**

---

## 4. Camera image destination

```text
/Users/lehoanganh/Pictures/
```

Test file: `DSC00001.JPG` — JPEG, 6000 × 3376, Sony ZV-E10.

---

## 5. Nguyên tắc quan trọng

Không giao tiếp trực tiếp với camera trong MVP. Không cần Sony Camera SDK ở giai đoạn đầu.

Sony Imaging Edge chịu trách nhiệm giao tiếp với ZV-E10. FWF software chỉ **WATCH** folder Pictures.

---

## 6–32. Architecture, modules, database, security

See the original Phase 1–5 plan in the conversation that seeded this project. Summary:

1. Customer Web App
2. Operator Dashboard
3. FWF Camera Agent  ← **Phase 1 (now)**
4. Image Processor    ← **Phase 1 (now, local only)**
5. LED Display        ← Phase 2

---

## 33. PHASE 1 — done

Local prototype:

```text
ZV-E10 → JPEG → detect → process → add FWF frame → save _final.jpg
```

## 35. PHASE 2 — done

Local Display at `http://localhost:3010/display` with SSE, fade, FIFO queue.

## 36. PHASE 3 — current

Local Check-in + Operator + Active Session:

```text
/checkin → WAITING
/operator PREPARE → READY (active)
Camera → associate photo → READY_TO_DISPLAY
/display + /checkin/:code
```

Sessions stored in `~/FWF_PhotoBooth/sessions.json` (no cloud DB yet).


---

## 40. Implementation rules

```text
DO NOT attempt direct Sony camera control yet.
DO NOT replace Sony Imaging Edge.
DO NOT process historical images on startup.
DO NOT process partially transferred files.
DO NOT put processed images inside watched Pictures folder.
DO NOT require Internet for local image processing.
DO NOT stretch image aspect ratio.
DO NOT associate photos with customers without an explicit active session.
```
