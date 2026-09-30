# 🐷 Trại Heo — farm 3D cho vui

Web 3D nhỏ để nghịch cho vui: một trang trại lợn kiểu low-poly, lấy cảm hứng từ
[grass-76ul.vercel.app](https://grass-76ul.vercel.app/) (đồng cỏ + con bò), nhưng thay bằng… heo.

Không cần build, không asset ngoài, không CDN — mọi thứ (scene, heo, âm thanh) đều được
sinh bằng code. Three.js nằm sẵn trong `vendor/`.

## Chơi gì

| Phím | Hành động |
|---|---|
| `WASD` / mũi tên | đi |
| `Shift` | chạy |
| `Space` | nhảy |
| `E` | ụt ịt — cả đàn heo chạy tới tìm bạn |
| `B` | đẻ thêm heo con (tối đa ~26 con) |
| `F` | ăn ở máng cám (phải đứng gần máng) |
| Chuột kéo / lăn | xoay camera / zoom |
| Chạm vào heo khác | nó giật mình bỏ chạy |
| Nhảy xuống vũng bùn | bắn bùn, heo dính bùn |
| `C` | chế độ điện ảnh (ẩn UI, camera quay chậm) |
| `F3` | debug FPS |

Trên điện thoại: cần điều khiển ảo bên trái + nút bên phải, máy màn nhỏ tự động
chạy chất lượng "Thấp" cho mượt.

Tùy chọn: chất lượng đồ họa, thời tiết (nắng / mây / mưa), giờ trong ngày
(chu kỳ ngày đêm hoặc cố định), bật/tắt âm thanh.

## Chạy local

```bash
cd PIG
python -m http.server 8137
# mở http://localhost:8137
```

## Deploy lên VPS GreenCloud HK

Site tĩnh nằm ở `/var/www/heomi/` trên VPS, nginx phục vụ domain `heomi.tam1012.site`
(SSL Let's Encrypt, gia hạn tự động qua certbot webroot `/var/www/greencloud-acme`).

```bash
# đẩy code mới lên
cd PIG
tar czf - index.html main.js vendor | ssh -i "/c/Users/Ha Tam/.ssh/gc_hk_key" ubuntu@192.131.142.97 \
  "tar xzf - -C /var/www/heomi"
```

Nginx config: `/etc/nginx/sites-available/heomi.tam1012.site` (backup cùng thư mục).
Repo: https://github.com/tam1012/piggg
