import os
import re
import uvicorn
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from docx import Document
from titlecase import titlecase
import nltk
from nltk.corpus import stopwords
import spacy
from io import BytesIO

# Initialize FastAPI app
app = FastAPI(title="File Validation Rule Checker Engine")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the local storage directory relative to backend folder
# ../files points to the 'files' folder at the root of the project
FILES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "files")
os.makedirs(FILES_DIR, exist_ok=True)

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    nlp = None

RESTRICTED_WORDS = ["best", "worst", "fake", "dummy", "test", "admin"]

# --- RULE MATCHING LOGIC ---
def check_title_case(text: str) -> bool:
    if not text or not isinstance(text, str):
        return False
    cleaned = text.strip()
    is_title = (cleaned == titlecase(cleaned))
    is_sentence = cleaned[0].isupper() if cleaned else False
    return is_title or is_sentence

def check_no_numbers(text: str) -> bool:
    return not bool(re.search(r'\d', str(text)))

def check_length_limit(text: str, max_len: int = 30) -> bool:
    return len(str(text)) <= max_len

def check_restricted_words(text: str) -> bool:
    words = str(text).lower().split()
    return not any(rw in words for rw in RESTRICTED_WORDS)

def check_clear_meaningful(text: str) -> bool:
    text_str = str(text).strip()
    if not text_str or len(text_str) < 2:
        return False
    if nlp:
        doc = nlp(text_str)
        return any(token.pos_ in ["NOUN", "VERB", "PROPN", "ADJ"] for token in doc)
    return text_str.lower() not in ["details", "stuff", "info", "data"]

def validate_single_item(item: str) -> list:
    errors = []
    if not check_title_case(item):
        errors.append("Not in Proper/Title Case / Sentence Case")
    if not check_no_numbers(item):
        errors.append("Contains numbers (Not Allowed)")
    if not check_length_limit(item, 30):
        errors.append("Exceeds 30 characters limit")
    if not check_restricted_words(item):
        errors.append("Contains restricted/prohibited words")
    if not check_clear_meaningful(item):
        errors.append("Lacks clear business meaning")
    return errors

# --- FILE PARSERS WITH PREVIEW SUPPORT ---
def process_txt(file_content: bytes) -> tuple:
    lines = file_content.decode("utf-8").splitlines()
    preview_data = []
    failed_count = 0
    passed_count = 0
    
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            preview_data.append({"index": idx, "content": "", "errors": []})
            continue
            
        violations = validate_single_item(stripped)
        if violations:
            failed_count += 1
            preview_data.append({"index": idx, "content": stripped, "errors": violations})
        else:
            passed_count += 1
            preview_data.append({"index": idx, "content": stripped, "errors": []})
            
    return preview_data, passed_count, failed_count

def process_docx(file_bytes: bytes) -> tuple:
    doc = Document(BytesIO(file_bytes))
    preview_data = []
    failed_count = 0
    passed_count = 0
    idx = 0
    
    for p in doc.paragraphs:
        text = p.text.strip()
        if not text:
            continue
        violations = validate_single_item(text)
        if violations:
            failed_count += 1
            preview_data.append({"index": idx, "content": text, "errors": violations})
        else:
            passed_count += 1
            preview_data.append({"index": idx, "content": text, "errors": []})
        idx += 1
        
    return preview_data, passed_count, failed_count

def process_xlsx(file_bytes: bytes) -> tuple:
    df = pd.read_excel(BytesIO(file_bytes))
    df = df.fillna("")
    
    headers = [str(col) for col in df.columns]
    header_errors = {}
    
    for col in headers:
        violations = validate_single_item(col)
        if violations:
            header_errors[col] = violations

    rows_data = []
    failed_count = len(header_errors)
    passed_count = len(headers) - failed_count
    
    for r_idx, row in df.iterrows():
        row_cells = {}
        for col in df.columns:
            val = str(row[col])
            violations = []
            if val.strip():
                violations = validate_single_item(val)
                if violations:
                    failed_count += 1
                else:
                    passed_count += 1
            
            row_cells[str(col)] = {
                "value": val,
                "errors": violations
            }
        rows_data.append({"row_index": r_idx, "cells": row_cells})
        
    preview_data = {
        "headers": [{"name": h, "errors": header_errors.get(h, [])} for h in headers],
        "rows": rows_data
    }
    return preview_data, passed_count, failed_count

# Helper to process file content and return validation payload
def analyze_file_data(filename: str, content: bytes) -> dict:
    ext = os.path.splitext(filename)[1].lower()
    if ext in ['.xlsx', '.xls']:
        preview, passed, failed = process_xlsx(content)
        file_type = "excel"
    elif ext == '.docx':
        preview, passed, failed = process_docx(content)
        file_type = "docx"
    elif ext == '.txt':
        preview, passed, failed = process_txt(content)
        file_type = "txt"
    else:
        raise ValueError(f"Unsupported extension: {ext}")
        
    status = "Passed" if failed == 0 else "Failed"
    total_records = passed + failed
    
    return {
        "filename": filename,
        "status": status,
        "total_records": total_records,
        "file_type": file_type,
        "summary": {
            "status": status,
            "passed": passed,
            "failed": failed,
            "preview_data": preview
        }
    }

# --- ENDPOINT: SYNC/DETECT EXISTING FILES ---
@app.get("/sync")
async def sync_local_files():
    """Scans the 'files/' folder, processes each file found, and returns reports."""
    synced_files = []
    
    if not os.path.exists(FILES_DIR):
        return synced_files

    for file_name in os.listdir(FILES_DIR):
        file_path = os.path.join(FILES_DIR, file_name)
        # Skip directories or hidden files
        if os.path.isdir(file_path) or file_name.startswith('.'):
            continue
            
        try:
            with open(file_path, "rb") as f:
                content = f.read()
                report = analyze_file_data(file_name, content)
                synced_files.append(report)
        except Exception as e:
            print(f"Error syncing {file_name}: {str(e)}")
            
    return synced_files

# --- ENDPOINT: SAVE NEW UPLOADS & RUN ANALYSIS ---
@app.post("/validate")
async def validate_file(file: UploadFile = File(...)):
    filename = file.filename
    try:
        content = await file.read()
        
        # Save physical file copy to /files folder in root
        dest_path = os.path.join(FILES_DIR, filename)
        with open(dest_path, "wb") as buffer:
            buffer.write(content)
            
        # Run analysis
        report = analyze_file_data(filename, content)
        return report
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving/processing file: {str(e)}")

# --- ENDPOINT: DELETE LOCAL FILE ---
@app.delete("/delete/{filename}")
async def delete_local_file(filename: str):
    """Deletes physical file from files/ folder."""
    file_path = os.path.join(FILES_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return {"status": "success", "message": f"{filename} deleted successfully."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
    else:
        raise HTTPException(status_code=404, detail="File not found in local files directory.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)