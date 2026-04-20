from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..internal_db import get_db, Snippet, Document, NodePosition
from ..schemas import SnippetSchema, DocumentSchema, SaveSnippetRequest, SaveDocumentRequest, NodePositionSchema, SaveNodePositionsRequest

router = APIRouter(prefix="/api/internal", tags=["Internal"])

# --- Snippets ---

@router.get("/snippets", response_model=List[SnippetSchema])
def list_snippets(
    db_type: Optional[str] = Query(None),
    host: Optional[str] = Query(None),
    db_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Snippet)
    if db_type is not None: query = query.filter(Snippet.db_type == db_type)
    if host is not None: query = query.filter(Snippet.host == host)
    if db_name is not None: query = query.filter(Snippet.db_name == db_name)
    
    return query.order_by(Snippet.created_at.desc()).all()

@router.post("/snippets", response_model=SnippetSchema)
def create_snippet(req: SaveSnippetRequest, db: Session = Depends(get_db)):
    snippet = Snippet(
        name=req.name,
        type=req.type,
        content=req.content,
        db_type=req.db_type,
        host=req.host,
        db_name=req.db_name
    )
    db.add(snippet)
    db.commit()
    db.refresh(snippet)
    return snippet

@router.put("/snippets/{snippet_id}", response_model=SnippetSchema)
def update_snippet(snippet_id: str, req: SaveSnippetRequest, db: Session = Depends(get_db)):
    db_snippet = db.query(Snippet).filter(Snippet.id == snippet_id).first()
    if not db_snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    if req.name is not None: db_snippet.name = req.name
    if req.content is not None: db_snippet.content = req.content
    if req.type is not None: db_snippet.type = req.type
    if req.db_type is not None: db_snippet.db_type = req.db_type
    if req.host is not None: db_snippet.host = req.host
    if req.db_name is not None: db_snippet.db_name = req.db_name
    
    db.commit()
    db.refresh(db_snippet)
    return db_snippet

@router.delete("/snippets/{snippet_id}")
def delete_snippet(snippet_id: str, db: Session = Depends(get_db)):
    db_snippet = db.query(Snippet).filter(Snippet.id == snippet_id).first()
    if not db_snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    db.delete(db_snippet)
    db.commit()
    return {"message": "Snippet deleted"}

# --- Documents ---

@router.get("/documents", response_model=List[DocumentSchema])
def list_documents(
    db_type: Optional[str] = Query(None),
    host: Optional[str] = Query(None),
    db_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Document)
    if db_type is not None: query = query.filter(Document.db_type == db_type)
    if host is not None: query = query.filter(Document.host == host)
    if db_name is not None: query = query.filter(Document.db_name == db_name)
    
    return query.order_by(Document.updated_at.desc()).all()

@router.post("/documents", response_model=DocumentSchema)
def create_document(req: SaveDocumentRequest, db: Session = Depends(get_db)):
    doc = Document(
        title=req.title,
        content=req.content,
        type=req.type,
        db_type=req.db_type,
        host=req.host,
        db_name=req.db_name
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

@router.put("/documents/{doc_id}", response_model=DocumentSchema)
def update_document(doc_id: str, req: SaveDocumentRequest, db: Session = Depends(get_db)):
    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if req.title is not None: db_doc.title = req.title
    if req.content is not None: db_doc.content = req.content
    if req.type is not None: db_doc.type = req.type
    if req.db_type is not None: db_doc.db_type = req.db_type
    if req.host is not None: db_doc.host = req.host
    if req.db_name is not None: db_doc.db_name = req.db_name
    
    db.commit()
    db.refresh(db_doc)
    return db_doc

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(db_doc)
    db.commit()
    return {"message": "Document deleted"}

# --- Node Positions ---

@router.get("/positions", response_model=List[NodePositionSchema])
def list_positions(
    db_type: Optional[str] = Query(None),
    host: Optional[str] = Query(None),
    db_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(NodePosition)
    if db_type is not None: query = query.filter(NodePosition.db_type == db_type)
    if host is not None: query = query.filter(NodePosition.host == host)
    if db_name is not None: query = query.filter(NodePosition.db_name == db_name)
    
    return query.all()

@router.post("/positions/bulk")
def save_positions(req: SaveNodePositionsRequest, db: Session = Depends(get_db)):
    # Simple strategy: remove existing positions for this context and re-insert
    # This is fine for small numbers of tables (typical ER diagrams)
    db.query(NodePosition).filter(
        NodePosition.db_type == req.db_type,
        NodePosition.host == req.host,
        NodePosition.db_name == req.db_name
    ).delete()
    
    for pos in req.positions:
        p = NodePosition(
            table_name=pos.table_name,
            x=pos.x,
            y=pos.y,
            db_type=req.db_type,
            host=req.host,
            db_name=req.db_name
        )
        db.add(p)
    
    db.commit()
    return {"message": "Positions saved"}
