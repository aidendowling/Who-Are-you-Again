import os
import qrcode

assets_dir = os.path.dirname(os.path.abspath(__file__))
qr_67_path = os.path.join(assets_dir, 'qr_seat_67.png')
qr_69_path = os.path.join(assets_dir, 'qr_seat_69.png')

# Generate QR for seat 67
qr_67 = qrcode.make('wh0ru://room/test-room/seat/67')
qr_67.save(qr_67_path)

# Generate QR for seat 69
qr_69 = qrcode.make('wh0ru://room/test-room/seat/69')
qr_69.save(qr_69_path)

print(f"QR codes generated:\n{qr_67_path}\n{qr_69_path}")
