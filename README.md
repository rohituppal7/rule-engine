### 1. Configure the Python Backend (FastAPI)

Open your system terminal, navigate to the project directory, and initialize your virtual environment:

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Create a localized virtual environment named 'venv'
python3 -m venv venv

# 3. Activate the virtual environment
# On macOS / Linux:
source venv/bin/activate
# On Windows (PowerShell):
# .\venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
# .\venv\Scripts\activate.bat

# 4. Install all mandatory core libraries and parsers
pip install -r requirements.txt

# 5. Install the spaCy NLP model directly via URL 
# (Works cross-platform on Windows, macOS, and Linux without SSL issues)
pip install [https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl](https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl)


Folder structure
├── files/                  # Root folder for physical storage (Drop test files directly here!)
├── backend/
│   ├── main.py             # FastAPI Server, rule-matching logic, & document parsers
│   ├── requirements.txt    # Target Python dependencies
│   └── venv/               # Local Python environment directory (git-ignored)
├── index.html              # Dashboard User Interface Layout
├── style.css               # Interface styling & modal rules
└── script.js               # Event handlers, API connection client, & UI state manager



# ⚙️ Rule Engine: Excel & Document Validation Dashboard

A localized, fast, and intelligent document validation ecosystem that automatically audits spreadsheets (`.xlsx`, `.xls`), Word files (`.docx`), and text documents (`.txt`) against predefined industrial formatting, grammatical, and structural standards.

---

## 📖 Project Description & Business Use Case

In enterprise workflows, product lifecycle management (PLM), and database migrations, inconsistent data formatting leads to broken pipelines and integration failures. The **Validation Rule Engine** acts as an automated quality gate. It replaces manual document auditing by evaluating catalog files, spec lists, and text inputs against 14 strict metadata compliance rules.

The system processes data line-by-line (for text and Word documents) or cell-by-cell (for Excel files) and outputs visual error matrices with direct inline feedback.

### 🔍 14 Core Validation Rules Enforced

| # | Validation Rule | Requirement Description |
|---|---|---|
| **1** | **Proper Case / Title Case** | Standardizes text to Title Case or Sentence Case. Rejects fully upper/lowercase inputs. |
| **2** | **No Numbers Allowed** | Ensures attributes remain strictly alphabetical (rejects numeric characters). |
| **3** | **Length Limit (30 Chars)** | Prevents excessively long descriptive entries in key attribute headers. |
| **4** | **No Prohibited Words** | Checks against restricted database strings (`"test"`, `"admin"`, `"fake"`, `"dummy"`). |
| **5** | **Clear & Meaningful** | Leverages NLP POS (Part-of-Speech) tagging to ensure words hold structural nouns or adjectives. |
| **6** | **No Special Characters** | Flags non-alphanumeric symbols (e.g., `@`, `#`, `$` or `*`) that break databases. |
| **7** | **No Junk Text** | Detects gibberish, keyboard-mashed strings (e.g., `ajjkfbsejkfb`), or high-entropy noise. |
| **8** | **No Promotional Words** | Keeps catalogs unbiased by flagging sales buzzwords (`"Best"`, `"Premium"`, `"Top"`). |
| **9** | **No Repeated Words** | Flags repetitive consecutive terms (e.g., `"Color Color"`). |
| **10** | **No Embedded Units** | Disallows unit designations in spec names (e.g., flags `"Weight KG"`; expects `"Weight"`). |
| **11** | **No Duplicate Attributes** | Detects redundant attributes within a single file category. |
| **12** | **Industry Standard Names** | Matches names against approved catalogs using fuzzy string mapping. |
| **13** | **No Spelling Mistakes** | Identifies typographical and spelling errors on the fly. |
| **14** | **Acronyms in UPPERCASE** | Enforces that approved acronyms (e.g., `LED`, `USB`, `PVC`, `HDPE`) are capitalized. |

---

## 🚀 System Architecture & How It Works

The system utilizes a decoupled, client-server architecture:

```text
  ┌────────────────────────┐      AJAX / JSON      ┌────────────────────────┐
  │   Frontend Dashboard   │ ────────────────────> │  FastAPI Python Engine │
  │  (Vanilla HTML5/JS/CSS)│ <──────────────────── │   (Validation Rules)   │
  └────────────────────────┘                       └────────────────────────┘
              ▲                                                 │
              │ Monitors                                        ▼ Reads/Writes
              └───────────────────────────────────────── [ Root /files/ Folder ]