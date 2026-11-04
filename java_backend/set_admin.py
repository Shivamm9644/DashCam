import bcrypt
import subprocess

password = b"InurumAdmin2026!"
hashed = bcrypt.hashpw(password, bcrypt.gensalt()).decode("utf-8")
print(f"Generated hash: {hashed}")

# Update superadmin and admin in MySQL
sql = f"""
UPDATE users SET password_hash = '{hashed}', status = 'ACTIVE' WHERE email = 'superadmin@inurum.com';
INSERT INTO users (id, email, password_hash, role, status, tenant_id, name, created_at)
VALUES ('usr-admin', 'admin@inurum.com', '{hashed}', 'SUPER_ADMIN', 'ACTIVE', 'tenant-inurum', 'Platform Admin', NOW())
ON DUPLICATE KEY UPDATE password_hash = '{hashed}', status = 'ACTIVE';
"""

p = subprocess.run(["sudo", "mysql", "-u", "dashcam", "-proot", "dashcam_db", "-e", sql], capture_output=True, text=True)
print("MySQL stdout:", p.stdout)
print("MySQL stderr:", p.stderr)
print("Returncode:", p.returncode)

