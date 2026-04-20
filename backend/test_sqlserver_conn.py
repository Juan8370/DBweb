import pyodbc
import sys

def test_connection():
    # Intento de conexión a instancia nombrada
    # Nota: ODBC Driver 18 requiere TrustServerCertificate=yes para conexiones locales sin cert
    server = r'localhost\MyDB'
    user = 'sa'
    password = '1234'
    database = 'master' # Usamos master para la prueba inicial
    
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
        f"Connection Timeout=10;"
    )
    
    print(f"Intentando conectar a {server}...")
    try:
        conn = pyodbc.connect(conn_str)
        print("[SUCCESS] Conexion exitosa desde el script!")
        
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        row = cursor.fetchone()
        print(f"Version de SQL Server: {row[0]}")
        
        # Listamos bases de datos para ayudar al usuario
        print("\nBases de datos disponibles:")
        cursor.execute("SELECT name FROM sys.databases")
        for db in cursor.fetchall():
            print(f" - {db[0]}")
            
        conn.close()
    except Exception as e:
        print(f"[ERROR] Error de conexion: {e}")

if __name__ == "__main__":
    test_connection()
