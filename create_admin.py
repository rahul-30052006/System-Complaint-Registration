"""
Server file to create or reset an Administrator account.
Usage:
    python create_admin.py
or with arguments:
    python create_admin.py <username> <email> <password> <full_name>
Example:
    python create_admin.py admin admin@lab.local admin123 "Lab Administrator"
"""
import sys
from datetime import datetime
from database import get_db, init_db
from auth import hash_password

def create_or_update_admin(username="admin", email="admin@lab.local", password="admin123", full_name="Lab Administrator"):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if username or email already exists
    cursor.execute("SELECT id, username, role FROM users WHERE username = ? OR email = ?", (username, email))
    existing = cursor.fetchone()
    
    password_hash = hash_password(password)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if existing:
        user_id = existing["id"]
        cursor.execute("""
            UPDATE users 
            SET full_name = ?, email = ?, password_hash = ?, role = 'admin'
            WHERE id = ?
        """, (full_name, email, password_hash, user_id))
        conn.commit()
        print(f"[SUCCESS] Admin user '{username}' (ID: {user_id}) updated successfully.")
    else:
        cursor.execute("""
            INSERT INTO users (username, full_name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, 'admin', ?)
        """, (username, full_name, email, password_hash, now))
        conn.commit()
        print(f"[SUCCESS] Admin user '{username}' created successfully.")
        
    conn.close()
    print("-" * 50)
    print("Admin Account Details:")
    print(f"  Username  : {username}")
    print(f"  Email     : {email}")
    print(f"  Password  : {password}")
    print(f"  Full Name : {full_name}")
    print(f"  Role      : admin")
    print("-" * 50)

if __name__ == "__main__":
    if len(sys.argv) == 5:
        u, e, p, fn = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
        create_or_update_admin(u, e, p, fn)
    elif len(sys.argv) == 1:
        # Prompt or use defaults if run directly
        print("Creating Administrator Account (Press ENTER to accept default values):")
        try:
            username = input("Username [default: admin]: ").strip() or "admin"
            email = input("Email [default: admin@lab.local]: ").strip() or "admin@lab.local"
            password = input("Password [default: admin123]: ").strip() or "admin123"
            full_name = input("Full Name [default: Lab Administrator]: ").strip() or "Lab Administrator"
            create_or_update_admin(username, email, password, full_name)
        except EOFError:
            # Non-interactive fallback
            create_or_update_admin()
    else:
        print("Usage: python create_admin.py [username email password full_name]")
        sys.exit(1)
