# DBWeb - Gestor de Bases de Datos Universal y Visualizador ER

DBWeb es un estudio de gestión de bases de datos basado en web de nivel profesional, diseñado para ingenieros que necesitan una visibilidad profunda de sus esquemas. Proporciona un diagrama ER interactivo, un terminal SQL robusto, documentación automatizada y herramientas de exploración de datos en una interfaz unificada de alto rendimiento.

## 🚀 Características Principales

- **Diagramas ER Interactivos**: Visualización dinámica de esquemas de bases de datos con posicionamiento manual, persistencia y selección por marquesina.
- **Constructor de Consultas Visual**: Construye consultas complejas utilizando una interfaz visual basada en nodos.
- **Terminal SQL**: Editor SQL completo con fragmentos (snippets), soporte para múltiples pestañas y registros de ejecución en tiempo real.
- **Documentación Automatizada**: Generación instantánea de documentación de la base de datos en Markdown, incluyendo mapas de relaciones y especificaciones de tablas.
- **Explorador de Datos**: Edición, filtrado y ordenación de registros de tablas con soporte para navegación por claves foráneas (FK).

## 🛠 Stack Tecnológico

- **Frontend**: React (18+), Vite, TailwindCSS (utilidades), XYFlow (Diagramas), CodeMirror (Editores).
- **Backend**: FastAPI (Python 3.10+), SQLAlchemy.
- **Persistencia**: SQLite (Datos internos de la aplicación como snippets y posiciones).

## 🧑‍💻 Autoría y Propiedad

> [!IMPORTANT]
> Este proyecto es **100% personal e independiente**. No está afiliado a ninguna empresa, organización o institución.
> 
> **Autor y Único Desarrollador**: Juan Jose Rodriguez Duarte
> **Estado**: Proyecto Personal Privado.
>
> Todo el código dentro de este repositorio fue desarrollado de forma independiente para uso personal e investigación.

## ⚙️ Configuración e Instalación

### Opción 1: Docker Compose (Recomendado)

1. Asegúrate de tener instalados Docker y Docker Compose.
2. Ejecuta el siguiente comando desde el directorio raíz:
   ```bash
   docker-compose up --build
   ```
3. Accede a la aplicación en `http://localhost:5173`.

### Opción 2: Configuración Manual de Desarrollo

#### Backend
1. Navega al directorio `backend`.
2. Crea un entorno virtual e instala las dependencias:
   ```bash
   python -m venv venv
   source venv/bin/activate  # o venv\Scripts\activate en Windows
   pip install -r requirements.txt
   ```
3. Inicia el servidor FastAPI:
   ```bash
   python run.py
   ```

#### Frontend
1. Navega al directorio `frontend`.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## 📝 Licencia

Solo para uso personal interno. Todos los derechos reservados por el autor.
