"""
Command-line utility to create or reset an Administrator account.
Run interactively with `python create_admin.py`; the password prompt is hidden.
"""
import getpass
import sys
from datetime import datetime
from database import get_db, init_db
from auth import hash_password

def create_or_update_admin(username="rahul", email="rahulrsrahul54@mail.com", password="rahul2006", full_name="Lab Administrator"):
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
    print(f"  Full Name : {full_name}")
    print(f"  Role      : admin")
    print("-" * 50)

if __name__ == "__main__":
    if len(sys.argv) != 1:
        print("Usage: python create_admin.py")
        sys.exit(1)

    print("Create or reset an Administrator account:")
    try:
        username = input("Username [default: admin]: ").strip() or "admin"
        email = input("Email [default: admin@lab.local]: ").strip() or "admin@lab.local"
        password = getpass.getpass("Password: ")
        password_confirmation = getpass.getpass("Confirm password: ")
        full_name = input("Full Name [default: Lab Administrator]: ").strip() or "Lab Administrator"
        if not password:
            raise ValueError("Administrator password must not be empty.")
        if password != password_confirmation:
            raise ValueError("Passwords do not match.")
        create_or_update_admin(username, email, password, full_name)
    except EOFError:
        print("Administrator setup requires interactive input.", file=sys.stderr)
        sys.exit(1)
    except ValueError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
