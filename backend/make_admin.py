import sqlite3
conn = sqlite3.connect('users.db')
conn.execute("UPDATE users SET role='admin'")
conn.commit()
print("All users updated to admin.")
