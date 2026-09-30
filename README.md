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
| `G` | xịt hơi 💨 — heo gần bạn tán loạn bỏ chạy |
| `1`–`7` | đàn heo piano 🎹 |
| `P` | tiệc pháo giấy, cả đàn nhảy múa 🎉 |
| `H` | chụp ảnh có khung + tải về máy 📸 |
| `T` | chơi trốn tìm: tìm 3 heo con trong 35 giây 🔍 |
| Chuột kéo / lăn | xoay camera / zoom |
| Bấm/chạm vào heo khác | nó giật mình bỏ chạy (hiện tên nó) |
| Bấm/chạm vào chính mình | đặt tên + đổi màu heo của bạn |
| Nhảy xuống vũng bùn | bắn bùn, heo dính bùn |
| `C` | chế độ điện ảnh (ẩn UI, camera quay chậm) |
| `F3` | debug FPS |

Trò chơi luôn sẵn trên map: săn 6 **táo vàng** 🍎 (xong tự sang vòng mới),
tìm 3 **trứng vàng** 🥚 ẩn quanh trại (đủ 3 thì **Heo Vàng** xuất hiện đi theo
và mở màu vàng trong bảng màu), **đá táo** vào khung thành phía tây sân ⚽.

Mỗi con heo có bảng tên trên đầu: đàn heo đầu mang tên Lâm, Phan Anh, Đức,
Thành, Trung, Đạt, Công, Dương, Huy; heo con mới đẻ có tên ngẫu nhiên kiểu
Ụt, Bông, Mực, Tí Nị…

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
