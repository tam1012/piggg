# Trại Heo (PIG) — hướng dẫn cho agent

Game 3D tĩnh thuần HTML/JS (three.js nằm trong `vendor/`), không cần build, không CDN ngoài.
Chi tiết gameplay/phím xem README.md.

## Ngôn ngữ

- Luôn trả lời người dùng bằng tiếng Việt.
- Commit message viết bằng tiếng Việt, mô tả rõ thay đổi.

## Deploy — BẮT BUỘC làm đủ sau mỗi lần sửa code (người dùng không cần nhắc lại)

Có **hai nơi chạy thật**, phải luôn cùng phiên bản:

### 1. Trang chính — VPS GreenCloud HK (anh em chơi ở link này)

- Domain: https://heomi.tam1012.site (nginx, SSL Let's Encrypt, certbot webroot
  `/var/www/greencloud-acme`; nginx config: `/etc/nginx/sites-available/heomi.tam1012.site`)
- Máy: `ubuntu@192.131.142.97`, thư mục web: `/var/www/heomi`
- Deploy bằng một lệnh:

  ```bash
  bash deploy.sh
  ```

  (script này chính là `tar czf - index.html main.js vendor | ssh -i
  "/c/Users/Ha Tam/.ssh/gc_hk_key" ubuntu@192.131.142.97 "tar xzf - -C /var/www/heomi"`)

### 2. Mirror — GitHub Pages (tự cập nhật)

- https://tam1012.github.io/piggg/ — tự build lại ~1 phút sau mỗi lần `git push origin main`
  (Pages lấy nguồn nhánh `main`, thư mục gốc).
- Repo: https://github.com/tam1012/piggg

### Quy trình chuẩn khi xong một thay đổi

1. Commit + push lên nhánh `main`.
2. Chạy `bash deploy.sh` để cập nhật VPS.
3. Kiểm chứng **cả hai** URL đều chạy bản mới, ví dụ grep một chuỗi code vừa sửa:

   ```bash
   curl -s https://heomi.tam1012.site/main.js | grep -n "<chuỗi code mới>"
   curl -s https://tam1012.github.io/piggg/main.js | grep -n "<chuỗi code mới>"
   ```

## Vị trí code quan trọng

- Preset giờ trong ngày: hằng số `TIME_PRESET` trong `main.js` (đầu file, khu vực cấu hình).
- Màu trời / ánh sáng theo giờ + thời tiết: hàm `updateSky` trong `main.js`
  (hằng `C_DAY_*` / `C_DUSK_*` / `C_NIGHT_*` ngay phía trên).
- Màn hình chờ + báo lỗi sớm: script inline cuối `index.html`.

## Lưu ý

- Nếu người dùng muốn bỏ bớt một trong hai nơi deploy hoặc trỏ `heomi.tam1012.site`
  về GitHub Pages: hỏi lại và chờ xác nhận trước khi đụng tới DNS/nginx.
- Đừng commit file nhạy cảm; SSH key chỉ nằm local, không copy vào repo.
