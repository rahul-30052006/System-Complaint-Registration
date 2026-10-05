/**
 * LabSys Care - System Complaint Registration Frontend JS
 */

// Application State
const state = {
    token: localStorage.getItem("token") || null,
    user: JSON.parse(localStorage.getItem("user") || "null"),
    adminComplaints: [],
    studentComplaints: []
};

// DOM Elements
const authSection = document.getElementById("auth-section");
const studentSection = document.getElementById("student-section");
const adminSection = document.getElementById("admin-section");
const navUserSection = document.getElementById("nav-user-section");
const userDisplayName = document.getElementById("user-display-name");
const userRoleBadge = document.getElementById("user-role-badge");
const btnLogout = document.getElementById("btn-logout");

// Auth Elements
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const tabButtons = document.querySelectorAll(".auth-tabs .tab-btn");
const authPanels = document.querySelectorAll(".auth-panel");

// Student Elements
const pillButtons = document.querySelectorAll(".pill-btn");
const studentPanels = document.querySelectorAll(".dashboard-section .view-panel");
const complaintForm = document.getElementById("complaint-form");
const studentComplaintsList = document.getElementById("student-complaints-list");
const myComplaintsCount = document.getElementById("my-complaints-count");
const btnRefreshStudent = document.getElementById("btn-refresh-student");

// Admin Elements
const statTotal = document.getElementById("stat-total");
const statPending = document.getElementById("stat-pending");
const statProgress = document.getElementById("stat-progress");
const statResolved = document.getElementById("stat-resolved");
const adminComplaintsTbody = document.getElementById("admin-complaints-tbody");
const adminSearch = document.getElementById("admin-search");
const adminFilterLab = document.getElementById("admin-filter-lab");
const adminFilterStatus = document.getElementById("admin-filter-status");
const btnRefreshAdmin = document.getElementById("btn-refresh-admin");

// Modal Elements
const statusModal = document.getElementById("status-modal");
const modalClose = document.getElementById("modal-close");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const modalStatusForm = document.getElementById("modal-status-form");
const modalTitle = document.getElementById("modal-title");
const modalSummary = document.getElementById("modal-summary");
const modalComplaintId = document.getElementById("modal-complaint-id");
const modalStatusSelect = document.getElementById("modal-status-select");
const modalAdminRemarks = document.getElementById("modal-admin-remarks");
const btnDeleteComplaint = document.getElementById("btn-delete-complaint");

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
    initEvents();
    checkAuth();
});

function initEvents() {
    // Auth Tabs
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            authPanels.forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");
        });
    });

    // Student Nav Pills
    pillButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            pillButtons.forEach(b => b.classList.remove("active"));
            studentPanels.forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.view).classList.add("active");
            if (btn.dataset.view === "student-my-complaints") {
                loadStudentComplaints();
            }
        });
    });

    // Forms
    loginForm.addEventListener("submit", handleLogin);
    signupForm.addEventListener("submit", handleSignup);
    complaintForm.addEventListener("submit", handleCreateComplaint);
    modalStatusForm.addEventListener("submit", handleUpdateStatus);

    // Logout
    btnLogout.addEventListener("click", handleLogout);

    // Refresh buttons
    if (btnRefreshStudent) btnRefreshStudent.addEventListener("click", loadStudentComplaints);
    if (btnRefreshAdmin) btnRefreshAdmin.addEventListener("click", loadAdminData);

    // Admin Filters & Search
    let searchDebounce;
    adminSearch.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(loadAdminComplaints, 300);
    });
    adminFilterLab.addEventListener("change", loadAdminComplaints);
    adminFilterStatus.addEventListener("change", loadAdminComplaints);

    // Modal controls
    modalClose.addEventListener("click", closeModal);
    btnCancelModal.addEventListener("click", closeModal);
    btnDeleteComplaint.addEventListener("click", handleDeleteComplaint);
}

// ================= AUTHENTICATION =================
async function checkAuth() {
    if (!state.token) {
        showAuthView();
        return;
    }

    try {
        const res = await apiRequest("/api/auth/me");
        if (res && res.user) {
            state.user = res.user;
            localStorage.setItem("user", JSON.stringify(res.user));
            showDashboardView();
        } else {
            handleLogout();
        }
    } catch (err) {
        console.error("Auth validation failed", err);
        handleLogout();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const login_id = document.getElementById("login-id").value.trim();
    const password = document.getElementById("login-password").value;

    try {
        const data = await apiRequest("/api/auth/login", "POST", { login_id, password });
        state.token = data.access_token;
        state.user = data.user;
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));

        showToast(`Welcome, ${data.user.full_name}!`, "success");
        loginForm.reset();
        showDashboardView();
    } catch (err) {
        showToast(err.message || "Login failed. Check your credentials.", "error");
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const full_name = document.getElementById("signup-fullname").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    try {
        const data = await apiRequest("/api/auth/register", "POST", {
            full_name,
            username,
            email,
            password
        });

        state.token = data.access_token;
        state.user = data.user;
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));

        showToast("Account created successfully! Welcome to LabSys Care.", "success");
        signupForm.reset();
        showDashboardView();
    } catch (err) {
        showToast(err.message || "Registration failed. Try a different username/email.", "error");
    }
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    showAuthView();
    showToast("You have been signed out.", "info");
}

function showAuthView() {
    authSection.style.display = "flex";
    studentSection.style.display = "none";
    adminSection.style.display = "none";
    navUserSection.style.display = "none";
}

function showDashboardView() {
    authSection.style.display = "none";
    navUserSection.style.display = "flex";
    userDisplayName.textContent = state.user.full_name;
    
    if (state.user.role === "admin") {
        userRoleBadge.textContent = "Admin";
        userRoleBadge.className = "badge badge-admin";
        studentSection.style.display = "none";
        adminSection.style.display = "block";
        loadAdminData();
    } else {
        userRoleBadge.textContent = "Student";
        userRoleBadge.className = "badge badge-student";
        adminSection.style.display = "none";
        studentSection.style.display = "block";
        loadStudentComplaints();
    }
}

// ================= STUDENT COMPLAINT LOGIC =================
async function handleCreateComplaint(e) {
    e.preventDefault();
    
    const lab_name = document.getElementById("lab-name").value;
    const system_no = document.getElementById("system-no").value.trim();
    const issue_type = document.getElementById("issue-type").value;
    const priority = document.getElementById("priority").value;
    const description = document.getElementById("description").value.trim();

    if (!lab_name || !system_no || !issue_type || !description) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        await apiRequest("/api/complaints", "POST", {
            lab_name,
            system_no,
            issue_type,
            priority,
            description
        });

        showToast("Complaint registered successfully! An admin will review it.", "success");
        complaintForm.reset();
        
        // Switch to "My Complaints" tab to show newly created complaint
        pillButtons[1].click();
    } catch (err) {
        showToast(err.message || "Failed to submit complaint.", "error");
    }
}

async function loadStudentComplaints() {
    try {
        const data = await apiRequest("/api/complaints/my");
        state.studentComplaints = data.complaints || [];
        myComplaintsCount.textContent = state.studentComplaints.length;
        renderStudentComplaints(state.studentComplaints);
    } catch (err) {
        showToast(err.message || "Error fetching complaints.", "error");
    }
}

function renderStudentComplaints(complaints) {
    if (!complaints.length) {
        studentComplaintsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h4>No complaints filed yet</h4>
                <p>If you encounter an issue on any lab computer, use the "Register Complaint" form.</p>
            </div>
        `;
        return;
    }

    studentComplaintsList.innerHTML = complaints.map(c => `
        <div class="complaint-card">
            <div class="complaint-card-header">
                <div>
                    <span class="complaint-system-badge">${escapeHtml(c.system_no)}</span>
                    <div class="complaint-lab-name">${escapeHtml(c.lab_name)}</div>
                </div>
                <div class="tags-group">
                    <span class="priority-badge priority-${c.priority.toLowerCase()}">${c.priority}</span>
                    <span class="status-badge status-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span>
                </div>
            </div>

            <div>
                <strong style="font-size: 0.825rem; color: #475569;">Issue: ${escapeHtml(c.issue_type)}</strong>
                <div class="complaint-desc">${escapeHtml(c.description)}</div>
            </div>

            ${c.admin_remarks ? `
                <div class="complaint-remarks">
                    <strong>Admin Remark:</strong> ${escapeHtml(c.admin_remarks)}
                </div>
            ` : ''}

            <div class="complaint-meta">
                <span>Ticket #${c.id}</span>
                <span>Filed: ${formatDate(c.created_at)}</span>
            </div>
        </div>
    `).join("");
}

// ================= ADMIN DASHBOARD LOGIC =================
async function loadAdminData() {
    await Promise.all([
        loadAdminStats(),
        loadAdminComplaints()
    ]);
}

async function loadAdminStats() {
    try {
        const stats = await apiRequest("/api/admin/stats");
        statTotal.textContent = stats.total;
        statPending.textContent = stats.pending;
        statProgress.textContent = stats.in_progress;
        statResolved.textContent = stats.resolved;
    } catch (err) {
        console.error("Failed to load admin stats", err);
    }
}

async function loadAdminComplaints() {
    const search = adminSearch.value.trim();
    const lab = adminFilterLab.value;
    const status = adminFilterStatus.value;

    const queryParams = new URLSearchParams();
    if (search) queryParams.append("search", search);
    if (lab && lab !== "all") queryParams.append("lab", lab);
    if (status && status !== "all") queryParams.append("status", status);

    try {
        const data = await apiRequest(`/api/admin/complaints?${queryParams.toString()}`);
        state.adminComplaints = data.complaints || [];
        renderAdminComplaints(state.adminComplaints);
    } catch (err) {
        showToast(err.message || "Failed to load complaints table.", "error");
    }
}

function renderAdminComplaints(complaints) {
    if (!complaints.length) {
        adminComplaintsTbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>No complaints match your current filter criteria.</p>
                </td>
            </tr>
        `;
        return;
    }

    adminComplaintsTbody.innerHTML = complaints.map(c => `
        <tr>
            <td><strong>#${c.id}</strong></td>
            <td>
                <strong>${escapeHtml(c.student_name)}</strong><br>
                <small style="color: #64748b;">Roll: ${escapeHtml(c.student_roll)}</small>
            </td>
            <td>
                <span class="badge" style="background:#e0e7ff; color:#3730a3;">${escapeHtml(c.system_no)}</span><br>
                <small style="color: #64748b;">${escapeHtml(c.lab_name)}</small>
            </td>
            <td>
                <strong>${escapeHtml(c.issue_type)}</strong>
                <p style="font-size: 0.8rem; color: #334155; margin-top: 0.25rem;">${escapeHtml(c.description)}</p>
                ${c.admin_remarks ? `<small style="color:#059669; font-weight:600;">Remarks: ${escapeHtml(c.admin_remarks)}</small>` : ''}
            </td>
            <td>
                <span class="priority-badge priority-${c.priority.toLowerCase()}">${c.priority}</span>
            </td>
            <td>
                <span class="status-badge status-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span>
            </td>
            <td style="white-space: nowrap; font-size: 0.8rem; color: #64748b;">
                ${formatDate(c.created_at)}
            </td>
            <td>
                <button class="btn btn-outline-primary btn-sm" onclick="openStatusModal(${c.id})">
                    ✏️ Update
                </button>
            </td>
        </tr>
    `).join("");
}

// ================= ADMIN STATUS MODAL =================
window.openStatusModal = function(complaintId) {
    const complaint = state.adminComplaints.find(c => c.id === complaintId);
    if (!complaint) return;

    modalComplaintId.value = complaint.id;
    modalTitle.textContent = `Update Ticket #${complaint.id} (${complaint.system_no})`;
    modalStatusSelect.value = complaint.status;
    modalAdminRemarks.value = complaint.admin_remarks || "";

    modalSummary.innerHTML = `
        <div><strong>Student:</strong> ${escapeHtml(complaint.student_name)} (${escapeHtml(complaint.student_roll)})</div>
        <div><strong>Location:</strong> ${escapeHtml(complaint.lab_name)} - ${escapeHtml(complaint.system_no)}</div>
        <div><strong>Issue:</strong> ${escapeHtml(complaint.issue_type)} - <em>${escapeHtml(complaint.description)}</em></div>
    `;

    statusModal.style.display = "flex";
};

function closeModal() {
    statusModal.style.display = "none";
}

async function handleUpdateStatus(e) {
    e.preventDefault();
    const id = modalComplaintId.value;
    const status = modalStatusSelect.value;
    const admin_remarks = modalAdminRemarks.value.trim();

    try {
        await apiRequest(`/api/admin/complaints/${id}`, "PATCH", {
            status,
            admin_remarks
        });

        showToast(`Complaint #${id} updated to ${status}!`, "success");
        closeModal();
        loadAdminData();
    } catch (err) {
        showToast(err.message || "Failed to update complaint.", "error");
    }
}

async function handleDeleteComplaint() {
    const id = modalComplaintId.value;
    if (!confirm(`Are you sure you want to permanently delete Complaint #${id}?`)) {
        return;
    }

    try {
        await apiRequest(`/api/admin/complaints/${id}`, "DELETE");
        showToast(`Complaint #${id} deleted successfully.`, "info");
        closeModal();
        loadAdminData();
    } catch (err) {
        showToast(err.message || "Failed to delete complaint.", "error");
    }
}

// ================= API & UTILITY HELPERS =================
async function apiRequest(url, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) {
        headers["Authorization"] = `Bearer ${state.token}`;
    }

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || data.message || "An unexpected error occurred.");
    }

    return data;
}

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
    if (!dateStr) return "-";
    try {
        const d = new Date(dateStr.replace(" ", "T"));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch {
        return dateStr;
    }
}
