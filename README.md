# Task Folder Manager MVP

MVP demo quản lý và phân rã task theo cây thư mục, dùng `React + Vite + Firebase Realtime Database`, tối ưu để demo nhanh trên Firebase Hosting.

## Tính năng chính

- Mock login theo 4 role: `Tổng giám đốc`, `Phó giám đốc`, `Trưởng phòng`, `Nhân viên`
- Cây task dạng folder hierarchy với `expand / collapse`
- Phân quyền hiển thị:
  - cấp dưới không thấy task cấp trên
  - cấp trên thấy toàn bộ nhánh bên dưới
  - mỗi user thấy task assign cho mình, task do mình tạo, task thuộc cấp dưới
- Tạo `task gốc`, `subtask`, `chia task` thành nhiều node cùng lúc
- Cập nhật `status`, `progress`, `note`
- Lịch sử `assign`, `status change`, `split`, `edit`
- Auto seed dữ liệu demo lên Realtime Database khi database đang trống
- UI hiện đại, responsive cơ bản, phù hợp demo khách hàng

## Firebase đang dùng

Project mặc định đã được cấu hình vào source:

- `projectId`: `tiengviet-68b03`
- `databaseURL`: `https://tiengviet-68b03-default-rtdb.firebaseio.com`

File cấu hình:

- `src/firebase/config.js`
- `firebase.json`
- `.firebaserc`
- `database.rules.json`

Lưu ý: `database.rules.json` hiện đang mở `read/write` cho mục đích demo MVP. Khi đưa production thật, bạn nên thay bằng rule có auth và role-based security.

## Cấu trúc project

```text
src/
  components/
    CreateTaskModal.jsx
    EditHistoryList.jsx
    EditTaskModal.jsx
    LoginScreen.jsx
    Modal.jsx
    SplitTaskModal.jsx
    TaskDetailPanel.jsx
    TaskHistoryPanel.jsx
    TaskNode.jsx
    TreeView.jsx
  data/
    demoData.js
  firebase/
    config.js
    seed.js
  utils/
    formatters.js
    mutationBuilders.js
    taskUtils.js
  App.jsx
  index.css
  main.jsx
firebase.json
.firebaserc
database.rules.json
```

## Seed data

Dữ liệu mẫu nằm trong [src/data/demoData.js](./src/data/demoData.js):

- `users`: 1 CEO, 2 Deputy, 3 Manager, 8 Staff
- `tasks`: 2 task root, phân rã nhiều cấp theo đúng hierarchy `CEO -> Deputy -> Manager -> Staff`
- `taskHistory`: có sẵn log `create`, `assign`, `status_change`, `edit`, `split`

App sẽ:

1. Kết nối Firebase Realtime Database
2. Kiểm tra `users`, `tasks`, `taskHistory`
3. Nếu chưa có dữ liệu thì tự seed bộ demo này lên database

## Chạy local

```bash
npm install
npm run dev
```

App dev mặc định chạy bằng Vite. Sau khi mở, chọn một user ở màn Login để vào hệ thống.

## Build production

```bash
npm run build
```

Output sẽ nằm ở thư mục `dist/`.

## Deploy Firebase Hosting

Nếu máy chưa có Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
```

Deploy Hosting và Realtime Database rules:

```bash
npm run build
firebase deploy --only hosting,database
```

Nếu chỉ muốn deploy Hosting:

```bash
firebase deploy --only hosting
```

## Cách demo nhanh

1. Vào bằng user `Nguyễn Minh Châu` để xem toàn bộ cây task từ trên xuống.
2. Chuyển sang `Trần Anh Khoa` hoặc `Lê Thu Hà` để thấy cây đã bị cắt phần task cấp trên.
3. Mở `Task Detail` bên phải để xem:
   - thông tin chung
   - subtask
   - history timeline
   - edit history
4. Dùng các nút `Tạo task gốc`, `Tạo subtask`, `Chia task`, `Chỉnh sửa`.
5. Dùng form `Cập nhật tiến độ` để tạo thêm log realtime.

## Kiểm tra nhanh

```bash
npm run lint
npm run build
```

## Gợi ý mở rộng tiếp theo

- Thêm Firebase Authentication thật thay cho mock login
- Siết `database.rules.json` theo `role`, `managerId`, `createdBy`, `assignedTo`
- Thêm bộ lọc theo deadline, priority, phòng ban
- Thêm comment thread riêng thay vì lưu note trong edit history
- Thêm dashboard tổng hợp số liệu cho lãnh đạo
