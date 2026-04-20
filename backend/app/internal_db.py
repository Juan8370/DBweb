import datetime
import uuid
from sqlalchemy import create_engine, Column, String, Text, DateTime, Boolean, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Internal SQLite DB for App Data
SQLALCHEMY_DATABASE_URL = "sqlite:///./dbweb_internal.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Snippet(Base):
    __tablename__ = "snippets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    type = Column(String)  # 'sql' | 'visual'
    content = Column(Text)
    db_type = Column(String, index=True, nullable=True) # postgresql, mysql, sqlserver
    host = Column(String, index=True, nullable=True)     # Host or server address
    db_name = Column(String, index=True, nullable=True)  # Database name
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, index=True)
    content = Column(Text)
    type = Column(String)  # 'custom' | 'system'
    db_type = Column(String, index=True, nullable=True)
    host = Column(String, index=True, nullable=True)
    db_name = Column(String, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
class NodePosition(Base):
    __tablename__ = "node_positions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    table_name = Column(String, index=True)
    x = Column(Text) # Float as string to avoid precision issues in some SQLite versions if needed, but Float is fine. Let's use String for simplicity in this dev tool or Float if standard. String is safer for coordinates sometimes but Float is better.
    # Actually Float is standard.
    x = Column(Text) 
    y = Column(Text)
    db_type = Column(String, index=True, nullable=True)
    host = Column(String, index=True, nullable=True)
    db_name = Column(String, index=True, nullable=True)

class TableMetadata(Base):
    __tablename__ = "table_metadata"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    table_name = Column(String, index=True)
    is_index = Column(Boolean, default=False)
    db_type = Column(String, index=True, nullable=True)
    host = Column(String, index=True, nullable=True)
    db_name = Column(String, index=True, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Manual migration for existing databases (Alembic might be overkill for this simple SQLite app)
    with engine.connect() as conn:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if 'table_metadata' not in tables:
            Base.metadata.tables['table_metadata'].create(bind=engine)
        
        # Add columns to 'snippets' if missing
        snippet_cols = [c['name'] for c in inspector.get_columns('snippets')]
        if 'db_type' not in snippet_cols:
            conn.execute(text("ALTER TABLE snippets ADD COLUMN db_type VARCHAR"))
        if 'host' not in snippet_cols:
            conn.execute(text("ALTER TABLE snippets ADD COLUMN host VARCHAR"))
            
        # Add columns to 'documents' if missing
        doc_cols = [c['name'] for c in inspector.get_columns('documents')]
        if 'db_type' not in doc_cols:
            conn.execute(text("ALTER TABLE documents ADD COLUMN db_type VARCHAR"))
        if 'host' not in doc_cols:
            conn.execute(text("ALTER TABLE documents ADD COLUMN host VARCHAR"))
        if (doc_cols := inspector.get_columns('documents')):
            if 'db_name' not in [c['name'] for c in doc_cols]:
                conn.execute(text("ALTER TABLE documents ADD COLUMN db_name VARCHAR"))
        
        # Ensure node_positions table exists is handled by create_all, 
        # but we check if it was missing to be safe in some environments
        if 'node_positions' not in inspector.get_table_names():
            Base.metadata.tables['node_positions'].create(bind=engine)

        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
