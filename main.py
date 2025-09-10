from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, Numeric, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import Optional, List
import os
import enum
from datetime import datetime
import uuid
import shutil

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://erp_lmx7_user:Bv6xeEg8ZdWRFQYnkcoYYAxOljredyDa@dpg-d30ji4vdiees7380n3rg-a/erp_lmx7")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enums
class UserRole(str, enum.Enum):
    MERCHANDISER = "merchandiser"
    FACTORY_TEAM = "factory_team"
    QC_TEAM = "qc_team"
    MANAGEMENT = "management"

class ProductionStage(str, enum.Enum):
    CUTTING = "cutting"
    STITCHING = "stitching"
    LASTING = "lasting"
    FINISHING = "finishing"
    PACKING = "packing"
    COMPLETED = "completed"

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"

class QCStatus(str, enum.Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"

class DocumentType(str, enum.Enum):
    PURCHASE_ORDER = "purchase_order"
    BOM = "bom"
    QC_REPORT = "qc_report"
    DISPATCH_DOCUMENT = "dispatch_document"

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True)
    first_name = Column(String)
    last_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.MERCHANDISER)
    created_at = Column(DateTime, default=datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = Column(String, unique=True)
    customer_id = Column(String)
    customer_name = Column(String)
    style = Column(String)
    quantity = Column(Integer)
    order_amount = Column(Numeric(10, 2))
    due_date = Column(DateTime)
    current_stage = Column(Enum(ProductionStage), default=ProductionStage.CUTTING)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    priority = Column(String, default="normal")
    customer_requirements = Column(Text)
    progress = Column(Integer, default=0)
    assigned_team = Column(String)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String)
    file_name = Column(String)
    original_name = Column(String)
    file_size = Column(Integer)
    mime_type = Column(String)
    document_type = Column(Enum(DocumentType))
    file_path = Column(String)
    uploaded_by = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

class QCReport(Base):
    __tablename__ = "qc_reports"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String)
    inspector = Column(String)
    inspection_date = Column(DateTime, default=datetime.utcnow)
    defects_found = Column(Integer, default=0)
    defect_description = Column(Text)
    qc_status = Column(Enum(QCStatus), default=QCStatus.PENDING)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic models
class OrderCreate(BaseModel):
    customer_id: str
    customer_name: str
    style: str
    quantity: int
    order_amount: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "normal"
    customer_requirements: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    order_number: str
    customer_name: str
    style: str
    quantity: int
    order_amount: Optional[float]
    current_stage: ProductionStage
    status: OrderStatus
    due_date: Optional[datetime]
    progress: int
    created_at: datetime

class QCReportCreate(BaseModel):
    order_id: str
    defects_found: int = 0
    defect_description: Optional[str] = None
    qc_status: QCStatus = QCStatus.PENDING
    notes: Optional[str] = None

class DashboardStats(BaseModel):
    active_orders: int
    completed_orders: int
    pending_qc: int
    monthly_revenue: str
    production_pipeline: dict
    qc_status: dict

# FastAPI app
app = FastAPI(title="FootwearERP API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Mock PO extraction function
def extract_po_data(file_path: str, file_type: str):
    """Mock PO data extraction - in production, use AI/ML service"""
    return {
        "customer_name": "Sample Customer Corp",
        "style": "Classic Athletic Shoe",
        "quantity": 2500,
        "order_amount": "125000.00"
    }

# Routes
@app.get("/", response_class=HTMLResponse)
async def read_index():
    with open("static/index.html", "r") as f:
        return HTMLResponse(f.read())

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    # Active orders
    active_orders = db.query(Order).filter(
        Order.status.in_([OrderStatus.PENDING, OrderStatus.IN_PROGRESS])
    ).count()
    
    # Completed orders
    completed_orders = db.query(Order).filter(Order.status == OrderStatus.COMPLETED).count()
    
    # Pending QC
    pending_qc = db.query(QCReport).filter(QCReport.qc_status == QCStatus.PENDING).count()
    
    # Production pipeline
    pipeline_counts = {}
    for stage in ProductionStage:
        count = db.query(Order).filter(
            Order.current_stage == stage,
            Order.status.in_([OrderStatus.PENDING, OrderStatus.IN_PROGRESS])
        ).count()
        pipeline_counts[stage.value] = count
    
    # QC status counts
    qc_counts = {
        "passed": db.query(QCReport).filter(QCReport.qc_status == QCStatus.PASSED).count(),
        "pending": db.query(QCReport).filter(QCReport.qc_status == QCStatus.PENDING).count(),
        "failed": db.query(QCReport).filter(QCReport.qc_status == QCStatus.FAILED).count()
    }
    
    return DashboardStats(
        active_orders=active_orders,
        completed_orders=completed_orders,
        pending_qc=pending_qc,
        monthly_revenue="0",
        production_pipeline=pipeline_counts,
        qc_status=qc_counts
    )

@app.get("/api/orders")
async def get_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return orders

@app.get("/api/orders/recent")
async def get_recent_orders(limit: int = 3, db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(limit).all()
    return orders

@app.post("/api/orders")
async def create_order(
    customer_id: str = Form(...),
    customer_name: str = Form(...),
    style: str = Form(...),
    quantity: int = Form(...),
    order_amount: str = Form(""),
    due_date: str = Form(""),
    priority: str = Form("normal"),
    customer_requirements: str = Form(""),
    po_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Generate order number
    order_number = f"SF-{datetime.now().year}-{str(int(datetime.now().timestamp()))[-6:]}"
    
    # Handle file upload and extraction
    extracted_data = {}
    if po_file:
        # Save uploaded file
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = f"{upload_dir}/{po_file.filename}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(po_file.file, buffer)
        
        # Extract data from PO
        extracted_data = extract_po_data(file_path, po_file.content_type)
        
        # Save document record
        document = Document(
            order_id="",  # Will be updated after order creation
            file_name=po_file.filename,
            original_name=po_file.filename,
            file_size=po_file.size or 0,
            mime_type=po_file.content_type or "",
            document_type=DocumentType.PURCHASE_ORDER,
            file_path=file_path,
            uploaded_by="system"
        )
        db.add(document)
    
    # Merge extracted data with form data
    final_data = {
        "customer_id": customer_id,
        "customer_name": extracted_data.get("customer_name", customer_name),
        "style": extracted_data.get("style", style),
        "quantity": extracted_data.get("quantity", quantity),
        "order_amount": float(extracted_data.get("order_amount", order_amount or "0")),
        "due_date": datetime.fromisoformat(due_date) if due_date else None,
        "priority": priority,
        "customer_requirements": customer_requirements
    }
    
    # Create order
    order = Order(
        order_number=order_number,
        **final_data
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Update document with order ID
    if po_file:
        document.order_id = order.id
        db.commit()
    
    return order

@app.get("/api/qc/reports")
async def get_qc_reports(db: Session = Depends(get_db)):
    reports = db.query(QCReport).order_by(QCReport.created_at.desc()).all()
    return reports

@app.post("/api/qc/reports")
async def create_qc_report(report: QCReportCreate, db: Session = Depends(get_db)):
    qc_report = QCReport(
        **report.dict(),
        inspector="system"
    )
    
    db.add(qc_report)
    db.commit()
    db.refresh(qc_report)
    
    return qc_report

@app.get("/api/documents")
async def get_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).order_by(Document.uploaded_at.desc()).all()
    return documents

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
