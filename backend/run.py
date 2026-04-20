import uvicorn
import os
from dotenv import load_dotenv

# Cargar variables de entorno si existen
load_dotenv()

if __name__ == "__main__":
    # El puerto se puede configurar por variable de entorno o usar 8000 por defecto
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Iniciando servidor en http://localhost:{port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
