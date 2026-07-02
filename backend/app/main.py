from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime
import json
import shutil
import uuid

app = FastAPI(
    title="AI Judge Backend",
    description="AI-assisted case file, evidence, hearing, and report analysis system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "database"
UPLOAD_DIR = BASE_DIR / "uploads"
EVIDENCE_DIR = UPLOAD_DIR / "evidence"
HEARING_DIR = UPLOAD_DIR / "hearings"
REPORT_DIR = BASE_DIR / "reports"

for folder in [DATA_DIR, EVIDENCE_DIR, HEARING_DIR, REPORT_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

CASES_FILE = DATA_DIR / "cases.json"
EVIDENCE_FILE = DATA_DIR / "evidence.json"
HEARINGS_FILE = DATA_DIR / "hearings.json"

def load_json(path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)

class CaseCreate(BaseModel):
    case_title: str
    case_type: str
    case_number: str
    parties_involved: str
    description: str
    status: str = "Pending"

class HearingCreate(BaseModel):
    case_id: str
    transcript: str

@app.get("/")
def home():
    return {
        "message": "AI Judge backend is running",
        "docs": "Open /docs to test APIs",
        "modules": [
            "case files",
            "evidence upload",
            "hearing transcript",
            "AI case report",
            "decision explanation",
            "mood chart"
        ]
    }

@app.post("/cases")
def create_case(case: CaseCreate):
    cases = load_json(CASES_FILE)

    new_case = {
        "id": str(uuid.uuid4()),
        "case_title": case.case_title,
        "case_type": case.case_type,
        "case_number": case.case_number,
        "parties_involved": case.parties_involved,
        "description": case.description,
        "status": case.status,
        "created_at": datetime.now().isoformat()
    }

    cases.append(new_case)
    save_json(CASES_FILE, cases)

    return {
        "message": "Case created successfully",
        "case": new_case
    }

@app.get("/cases")
def get_cases():
    return load_json(CASES_FILE)

@app.get("/cases/{case_id}")
def get_case(case_id: str):
    cases = load_json(CASES_FILE)

    for case in cases:
        if case["id"] == case_id:
            return case

    raise HTTPException(status_code=404, detail="Case not found")

@app.post("/evidence/upload")
def upload_evidence(
    case_id: str = Form(...),
    description: str = Form(...),
    uploaded_by: str = Form(...),
    file: UploadFile = File(...)
):
    cases = load_json(CASES_FILE)
    case_exists = any(case["id"] == case_id for case in cases)

    if not case_exists:
        raise HTTPException(status_code=404, detail="Case not found")

    file_id = str(uuid.uuid4())
    saved_name = f"{file_id}_{file.filename}"
    saved_path = EVIDENCE_DIR / saved_name

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    evidence_list = load_json(EVIDENCE_FILE)

    evidence = {
        "id": file_id,
        "case_id": case_id,
        "file_name": file.filename,
        "saved_path": str(saved_path),
        "description": description,
        "uploaded_by": uploaded_by,
        "uploaded_at": datetime.now().isoformat(),
        "ai_summary": generate_evidence_summary(file.filename, description)
    }

    evidence_list.append(evidence)
    save_json(EVIDENCE_FILE, evidence_list)

    return {
        "message": "Evidence uploaded successfully",
        "evidence": evidence
    }

@app.get("/cases/{case_id}/evidence")
def get_case_evidence(case_id: str):
    evidence_list = load_json(EVIDENCE_FILE)
    return [item for item in evidence_list if item["case_id"] == case_id]

@app.post("/hearings")
def add_hearing(hearing: HearingCreate):
    cases = load_json(CASES_FILE)
    case_exists = any(case["id"] == hearing.case_id for case in cases)

    if not case_exists:
        raise HTTPException(status_code=404, detail="Case not found")

    hearings = load_json(HEARINGS_FILE)

    hearing_data = {
        "id": str(uuid.uuid4()),
        "case_id": hearing.case_id,
        "transcript": hearing.transcript,
        "summary": generate_hearing_summary(hearing.transcript),
        "mood_chart": generate_mood_chart(),
        "created_at": datetime.now().isoformat()
    }

    hearings.append(hearing_data)
    save_json(HEARINGS_FILE, hearings)

    return {
        "message": "Hearing transcript saved successfully",
        "hearing": hearing_data
    }

@app.get("/cases/{case_id}/hearings")
def get_case_hearings(case_id: str):
    hearings = load_json(HEARINGS_FILE)
    return [item for item in hearings if item["case_id"] == case_id]

@app.get("/cases/{case_id}/case-report")
def generate_case_report(case_id: str):
    case = get_case(case_id)
    evidence = get_case_evidence(case_id)
    hearings = get_case_hearings(case_id)

    report = {
        "case_report": {
            "case_title": case["case_title"],
            "case_type": case["case_type"],
            "case_number": case["case_number"],
            "parties_involved": case["parties_involved"],
            "case_summary": case["description"],
            "evidence_count": len(evidence),
            "hearing_count": len(hearings),
            "key_findings": [
                "Evidence files were reviewed and summarized.",
                "Hearing transcript was analyzed.",
                "Contradictions and important statements should be checked by a human reviewer."
            ],
            "suggested_decision": "AI recommends human legal review before final decision.",
            "confidence_score": "Demo mode - confidence score not legally valid"
        },
        "decision_explanation_report": {
            "why_this_decision": "The recommendation is based on case description, evidence summaries, and hearing transcript.",
            "important_evidence": evidence,
            "important_warning": "Facial expression, mood, and voice tone should not be used as direct proof of truth or guilt.",
            "final_note": "This system is an AI assistant, not a replacement for a real judge."
        },
        "mood_report": hearings[-1]["mood_chart"] if hearings else generate_mood_chart()
    }

    report_path = REPORT_DIR / f"{case_id}_report.json"
    save_json(report_path, report)

    return report

def generate_evidence_summary(file_name, description):
    return {
        "summary": f"This evidence file named '{file_name}' was uploaded. Description: {description}",
        "importance": "Medium",
        "possible_use": "Can support case facts if verified by a human reviewer."
    }

def generate_hearing_summary(transcript):
    short_text = transcript[:300] + "..." if len(transcript) > 300 else transcript

    return {
        "summary": "The hearing transcript was received and analyzed in demo mode.",
        "important_points": [
            short_text,
            "Speaker arguments should be compared with uploaded evidence.",
            "Any contradiction should be reviewed manually."
        ]
    }

def generate_mood_chart():
    return {
        "Neutral": 45,
        "Stressed": 25,
        "Confident": 15,
        "Angry": 10,
        "Sad": 5
    }