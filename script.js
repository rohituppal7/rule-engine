// Dashboard UI Bindings
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const tableBody = document.getElementById("tableBody");
const searchInput = document.querySelector(".search");

const totalFiles = document.getElementById("totalFiles");
const totalRecords = document.getElementById("totalRecords");
const completed = document.getElementById("completed");
const totalRejected = document.getElementById("totalRejected");

// Array holding file objects, updated dynamically
let uploadedFiles = [];
const BASE_URL = "https://rule-engine-backend-835v.onrender.com";

// On page initialization, sync previously stored files in files/ folder
window.addEventListener("DOMContentLoaded", () => {
    syncFilesOnLoad();
});

// Sync from backend files/ directory
async function syncFilesOnLoad() {
    try {
        const response = await fetch(`${BASE_URL}/sync`);
        if (!response.ok) throw new Error("Sync failed");
        
        const files = await response.json();
        
        uploadedFiles = files.map(result => ({
            name: result.filename,
            rows: result.total_records,
            date: new Date().toLocaleString(),
            status: result.status, 
            file_type: result.file_type,
            summary: result.summary 
        }));
        
        updateDashboard();
    } catch (err) {
        console.error("Failed to auto-detect files:", err);
    }
}

// Trigger hidden file dialog
uploadBtn.addEventListener("click", () => {
    fileInput.click();
});

// File input change handler
fileInput.addEventListener("change", async function (e) {
    const files = Array.from(e.target.files);

    for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            addPlaceholderFile(file.name);

            const response = await fetch(`${BASE_URL}/validate`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server returned error status: ${response.status}`);
            }

            const result = await response.json();

            // Fix duplicates: remove only the placeholder
            uploadedFiles = uploadedFiles.filter(f => !(f.name === file.name && f.status === "Validating..."));
            
            uploadedFiles.push({
                name: file.name,
                rows: result.total_records,
                date: new Date().toLocaleString(),
                status: result.status, 
                file_type: result.file_type,
                summary: result.summary 
            });

        } catch (error) {
            console.error("Connection Error:", error);
            uploadedFiles = uploadedFiles.filter(f => !(f.name === file.name && f.status === "Validating..."));
            uploadedFiles.push({
                name: file.name,
                rows: 0,
                date: new Date().toLocaleString(),
                status: "Error",
                summary: null
            });
        }

        updateDashboard();
    }
    fileInput.value = "";
});

function addPlaceholderFile(fileName) {
    uploadedFiles.push({
        name: fileName,
        rows: "--",
        date: new Date().toLocaleString(),
        status: "Validating...",
        summary: null
    });
    updateDashboard();
}

function updateDashboard() {
    tableBody.innerHTML = "";
    let totalRowCount = 0;
    let passedCount = 0;
    let rejectedCount = 0;

    if (uploadedFiles.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color: #64748b; padding: 30px;">No files uploaded yet.</td></tr>`;
        totalFiles.innerText = "0";
        totalRecords.innerText = "0";
        completed.innerText = "0";
        totalRejected.innerText = "0";
        return;
    }

    uploadedFiles.forEach((file, index) => {
        if (typeof file.rows === "number") {
            totalRowCount += file.rows;
        }
        
        let statusBadge = "⏳ Processing...";
        if (file.status === "Passed") {
            statusBadge = "<span style='color: #10b981; font-weight: bold;'>✅ Passed</span>";
            passedCount++;
        } else if (file.status === "Failed") {
            statusBadge = "<span style='color: #ef4444; font-weight: bold;'>❌ Failed</span>";
            rejectedCount++;
        } else if (file.status === "Error") {
            statusBadge = "<span style='color: #f59e0b; font-weight: bold;'>⚠️ Error</span>";
            rejectedCount++;
        }

        tableBody.innerHTML += `
            <tr>
                <td style="text-align: left; padding-left: 20px;"><b>📄 ${file.name}</b></td>
                <td>${file.rows}</td>
                <td>${statusBadge}</td>
                <td>${file.date}</td>
                <td>
                    <button onclick="viewFile(${index})" style="padding: 6px 12px; cursor: pointer; margin-right: 5px; border-radius: 4px; border: 1px solid #ccc; background: white;">View</button>
                    <button onclick="deleteFile(${index})" style="padding: 6px 12px; cursor: pointer; background: #ef4444; color: white; border: none; border-radius: 4px;">Delete</button>
                </td>
            </tr>
        `;
    });

    totalFiles.innerText = uploadedFiles.length;
    totalRecords.innerText = totalRowCount;
    completed.innerText = passedCount;
    totalRejected.innerText = rejectedCount;
}

// FULL PREVIEW MODAL RENDERING LOGIC
function viewFile(index) {
    const file = uploadedFiles[index];
    if (file.status === "Validating...") {
        alert("File is processing, please wait!");
        return;
    }
    if (file.status === "Error" || !file.summary) {
        alert("Cannot open preview for failed/empty requests.");
        return;
    }

    const modalOverlay = document.createElement("div");
    modalOverlay.className = "modal-overlay";
    modalOverlay.id = "previewModal";

    let previewContentHTML = "";

    if (file.file_type === "excel") {
        const headers = file.summary.preview_data.headers;
        const rows = file.summary.preview_data.rows;

        previewContentHTML += `<table class="preview-table"><thead><tr>`;
        headers.forEach(h => {
            const hasErr = h.errors.length > 0;
            previewContentHTML += `
                <th class="${hasErr ? 'error-cell' : ''}" title="${hasErr ? h.errors.join(', ') : ''}">
                    ${h.name} ${hasErr ? '⚠️' : ''}
                </th>`;
        });
        previewContentHTML += `</tr></thead><tbody>`;

        rows.forEach(r => {
            previewContentHTML += `<tr>`;
            headers.forEach(h => {
                const cellData = r.cells[h.name] || { value: "", errors: [] };
                const hasErr = cellData.errors && cellData.errors.length > 0;
                previewContentHTML += `
                    <td class="${hasErr ? 'error-cell' : ''}" title="${hasErr ? cellData.errors.join(', ') : ''}">
                        ${cellData.value}
                        ${hasErr ? `<ul class="error-list">${cellData.errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
                    </td>`;
            });
            previewContentHTML += `</tr>`;
        });
        previewContentHTML += `</tbody></table>`;
    } 
    else {
        const textBlocks = file.summary.preview_data;
        textBlocks.forEach(block => {
            const hasErr = block.errors && block.errors.length > 0;
            if (hasErr) {
                previewContentHTML += `
                    <div class="error-row-txt">
                        <strong>"${block.content}"</strong>
                        <ul class="error-list">
                            ${block.errors.map(e => `<li>⚠️ ${e}</li>`).join('')}
                        </ul>
                    </div>`;
            } else {
                previewContentHTML += `<div class="clean-row-txt">${block.content || "<i>[Empty Line]</i>"}</div>`;
            }
        });
    }

    modalOverlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔍 Full File Preview: ${file.name} (${file.status})</h2>
                <button class="close-modal-btn" onclick="closePreview()">&times;</button>
            </div>
            <div class="modal-body">
                ${previewContentHTML}
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.addEventListener("click", (e) => {
        if (e.target.id === "previewModal") {
            closePreview();
        }
    });
}

function closePreview() {
    const modal = document.getElementById("previewModal");
    if (modal) {
        modal.remove();
    }
}

// Delete from UI and from local folder
async function deleteFile(index) {
    const file = uploadedFiles[index];
    if (confirm(`Are you sure you want to delete ${file.name} from the files/ directory?`)) {
        try {
            const response = await fetch(`${BASE_URL}/delete/${encodeURIComponent(file.name)}`, {
                method: "DELETE"
            });
            
            if (response.ok) {
                uploadedFiles.splice(index, 1);
                updateDashboard();
            } else {
                alert("Failed to delete file from local folder.");
            }
        } catch (err) {
            console.error("Error calling delete endpoint:", err);
            alert("Could not connect to backend to delete file.");
        }
    }
}

// Sidebar Filter System
function filterDashboard(filterType) {
    document.querySelectorAll(".menu li").forEach(li => li.classList.remove("active"));
    
    if (filterType === 'all') {
        document.getElementById("menuDashboard").classList.add("active");
        document.getElementById("dashboardTitle").innerText = "Validation Rule Checker Dashboard";
    } else if (filterType === 'Passed') {
        document.getElementById("menuValidated").classList.add("active");
        document.getElementById("dashboardTitle").innerText = "Validated (Passed) Files Only";
    } else if (filterType === 'Failed') {
        document.getElementById("menuRejected").classList.add("active");
        document.getElementById("dashboardTitle").innerText = "Rejected Files Only";
    }

    const rows = tableBody.getElementsByTagName("tr");
    if (uploadedFiles.length === 0) return;

    for (let i = 0; i < rows.length; i++) {
        const fileStatus = uploadedFiles[i]?.status;
        
        if (filterType === 'all') {
            rows[i].style.display = "";
        } else if (filterType === 'Passed' && fileStatus === 'Passed') {
            rows[i].style.display = "";
        } else if (filterType === 'Failed' && (fileStatus === 'Failed' || fileStatus === 'Error')) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}

searchInput.addEventListener("keyup", function () {
    const query = this.value.toLowerCase();
    const rows = tableBody.getElementsByTagName("tr");
    for (let row of rows) {
        const fileCell = row.cells[0];
        if (fileCell) {
            const fileName = fileCell.innerText.toLowerCase();
            if (fileName.includes(query) || fileName.includes("no files")) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        }
    }
});
