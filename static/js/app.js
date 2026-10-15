/**
 * System Complaint Registration Frontend JS
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
const adminLoginLink = document.getElementById("admin-login-link");

// Auth Elements
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const tabButtons = document.querySelectorAll(".auth-tabs .tab-btn");
const authPanels = document.querySelectorAll(".auth-panel");

// Student Elements
const pillButtons = document.querySelectorAll(".pill-btn");
const studentPanels = document.querySelectorAll(".dashboard-section .view-panel");
const complaintForm = document.getElementById("complaint-form");
const labNameSelect = document.getElementById("lab-name");
const customLabGroup = document.getElementById("custom-lab-group");
const customLabName = document.getElementById("custom-lab-name");
const studentComplaintsList = document.getElementById("student-complaints-list");
const myComplaintsCount = document.getElementById("my-complaints-count");
const btnRefreshStudent = document.getElementById("btn-refresh-student");
const complaintDateInput = document.getElementById("complaint-date");
const departmentInput = document.getElementById("department");
const complaintStudentNameInput = document.getElementById("complaint-student-name");
const complaintStudentRollInput = document.getElementById("complaint-student-roll");

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
const btnSendEmail = document.getElementById("btn-send-email");

// Modal Elements
const statusModal = document.getElementById("status-modal");
const modalClose = document.getElementById("modal-close");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const modalStatusForm = document.getElementById("modal-status-form");
const modalTitle = document.getElementById("modal-title");
const modalSummary = document.getElementById("modal-summary");
const modalComplaintId = document.getElementById("modal-complaint-id");
const modalStatusSelect = document.getElementById("modal-status-select");
const modalAssignedTechnician = document.getElementById("modal-assigned-technician");
const modalRepairAction = document.getElementById("modal-repair-action");
const modalAdminRemarks = document.getElementById("modal-admin-remarks");
const btnDeleteComplaint = document.getElementById("btn-delete-complaint");
const emailModal = document.getElementById("email-modal");
const emailComposeForm = document.getElementById("email-compose-form");
const emailModalClose = document.getElementById("email-modal-close");
const emailCancel = document.getElementById("email-cancel");
const emailRecipient = document.getElementById("email-recipient");
const emailSubject = document.getElementById("email-subject");
const emailMessage = document.getElementById("email-message");
const emailSubmit = document.getElementById("email-submit");
const emailSendStatus = document.getElementById("email-send-status");
const emailComplaintContext = document.getElementById("email-complaint-context");

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
    labNameSelect.addEventListener("change", toggleCustomLabInput);
    complaintForm.addEventListener("reset", () => {
        customLabGroup.style.display = "none";
        customLabName.required = false;
        customLabName.disabled = true;
        customLabName.value = "";
    });
    modalStatusForm.addEventListener("submit", handleUpdateStatus);
    emailComposeForm.addEventListener("submit", handleSendEmail);

    // Logout
    btnLogout.addEventListener("click", handleLogout);

    // Refresh buttons
    if (btnRefreshStudent) btnRefreshStudent.addEventListener("click", loadStudentComplaints);
    if (btnRefreshAdmin) btnRefreshAdmin.addEventListener("click", loadAdminData);
    if (btnSendEmail) btnSendEmail.addEventListener("click", () => openEmailModal());

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
    emailModalClose.addEventListener("click", closeEmailModal);
    emailCancel.addEventListener("click", closeEmailModal);
    btnDeleteComplaint.addEventListener("click", handleDeleteComplaint);
    adminComplaintsTbody.addEventListener("click", event => {
        const emailButton = event.target.closest("[data-email-complaint]");
        if (emailButton) {
            openEmailModal(emailButton.dataset.emailComplaint);
            return;
        }
        const button = event.target.closest("[data-delete-complaint]");
        if (!button) return;
        deleteComplaint(button.dataset.deleteComplaint, false, button);
    });
    emailModal.addEventListener("click", event => {
        if (event.target === emailModal) closeEmailModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && emailModal.style.display === "flex") {
            closeEmailModal();
        }
    });

    toggleCustomLabInput();
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
        if (data.user.role !== "student") {
            showToast("This page is for student accounts. Please use Admin Login.", "error");
            return;
        }

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
    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    try {
        const data = await apiRequest("/api/auth/register", "POST", {
            username,
            email,
            password
        });

        state.token = data.access_token;
        state.user = data.user;
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));

        showToast("Account created successfully! Welcome.", "success");
        signupForm.reset();
        showDashboardView();
    } catch (err) {
        showToast(err.message || "Registration failed. Try a different username/email.", "error");
    }
}

function handleLogout() {
    const loginPath = state.user && state.user.role === "admin"
        ? "/admin-login"
        : "/student-login";
    state.token = null;
    state.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.assign(loginPath);
}

function showAuthView() {
    document.body.classList.remove("dashboard-mode");
    authSection.style.display = "flex";
    studentSection.style.display = "none";
    adminSection.style.display = "none";
    navUserSection.style.display = "none";
}

function showDashboardView() {
    document.body.classList.add("dashboard-mode");
    authSection.style.display = "none";
    navUserSection.style.display = "flex";
    userDisplayName.textContent = state.user.full_name;
    
    if (state.user.role === "admin") {
        userRoleBadge.textContent = "Admin";
        userRoleBadge.className = "badge badge-admin";
        adminLoginLink.style.display = "inline-flex";
        studentSection.style.display = "none";
        adminSection.style.display = "block";
        loadAdminData();
    } else {
        populateComplaintStudentFields();
        userRoleBadge.textContent = "Student";
        userRoleBadge.className = "badge badge-student";
        adminLoginLink.style.display = "none";
        adminSection.style.display = "none";
        studentSection.style.display = "block";
        loadStudentComplaints();
    }
}

function populateComplaintStudentFields() {
    const now = new Date();
    const date = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    const studentName = state.user.full_name || state.user.username;

    complaintDateInput.value = date;
    complaintDateInput.defaultValue = date;
    complaintStudentNameInput.value = studentName;
    complaintStudentNameInput.defaultValue = studentName;
    complaintStudentRollInput.value = state.user.username;
    complaintStudentRollInput.defaultValue = state.user.username;
}

function toggleCustomLabInput() {
    const needsCustomName = labNameSelect.value === "Others";

    customLabGroup.style.display = needsCustomName ? "block" : "none";
    customLabName.required = needsCustomName;
    customLabName.disabled = !needsCustomName;

    if (needsCustomName) {
        customLabName.focus();
    } else {
        customLabName.value = "";
    }
}

// ================= STUDENT COMPLAINT LOGIC =================
async function handleCreateComplaint(e) {
    e.preventDefault();
    
    const selectedLab = labNameSelect.value;
    const lab_name = selectedLab === "Others" ? customLabName.value.trim() : selectedLab;
    const department = departmentInput.value.trim();
    const lab_location = document.getElementById("lab-location").value.trim();
    const system_no = document.getElementById("system-no").value.trim();
    const issue_type = document.getElementById("issue-type").value;
    const priority = document.getElementById("priority").value;
    const description = document.getElementById("description").value.trim();

    if (!department || !lab_name || !lab_location || !system_no || !issue_type || !description) {
        if (selectedLab === "Others" && !lab_name) {
            customLabName.reportValidity();
            return;
        }
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        await apiRequest("/api/complaints", "POST", {
            department,
            lab_name,
            lab_location,
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
                    ${c.lab_location ? `<div class="complaint-lab-name">${escapeHtml(c.lab_location)}</div>` : ''}
                </div>
                <div class="tags-group">
                    <span class="priority-badge priority-${c.priority.toLowerCase()}">${c.priority}</span>
                    <span class="status-badge status-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span>
                </div>
            </div>

            <div>
                <strong style="font-size: 0.825rem; color: #475569;">Department: ${escapeHtml(c.department || "Not specified")}</strong>
            </div>

            <div>
                <strong style="font-size: 0.825rem; color: #475569;">Issue: ${escapeHtml(c.issue_type)}</strong>
                <div class="complaint-desc">${escapeHtml(c.description)}</div>
            </div>

            ${c.assigned_technician ? `<div class="complaint-remarks"><strong>Assigned Technician:</strong> ${escapeHtml(c.assigned_technician)}</div>` : ''}
            ${c.repair_action ? `<div class="complaint-remarks"><strong>Repair Action:</strong> ${escapeHtml(c.repair_action)}</div>` : ''}
            ${c.admin_remarks ? `
                <div class="complaint-remarks">
                    <strong>Technician Remarks:</strong> ${escapeHtml(c.admin_remarks)}
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
                <td colspan="14" class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>No complaints match your current filter criteria.</p>
                </td>
            </tr>
        `;
        return;
    }

    adminComplaintsTbody.innerHTML = complaints.map((c, index) => `
        <tr>
            <td><strong>${index + 1}</strong></td>
            <td style="white-space: nowrap;">${formatDate(c.created_at)}</td>
            <td>${escapeHtml(c.department || "Not specified")}</td>
            <td>
                <strong>${escapeHtml(c.student_name)}</strong>
            </td>
            <td>${escapeHtml(c.student_roll)}</td>
            <td>
                <small style="color: #64748b;">${escapeHtml(c.lab_name)}</small>
                ${c.lab_location ? `<br><small style="color: #64748b;">${escapeHtml(c.lab_location)}</small>` : ''}
            </td>
            <td><span class="badge" style="background:#e0e7ff; color:#3730a3;">${escapeHtml(c.system_no)}</span></td>
            <td>
                <strong>${escapeHtml(c.issue_type)}</strong>
                <p style="font-size: 0.8rem; color: #334155; margin-top: 0.25rem;">${escapeHtml(c.description)}</p>
            </td>
            <td>${escapeHtml(c.assigned_technician || "Not assigned")}</td>
            <td>
                <span class="priority-badge priority-${c.priority.toLowerCase()}">${c.priority}</span>
            </td>
            <td>
                <span class="status-badge status-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span>
            </td>
            <td style="white-space: nowrap; font-size: 0.8rem; color: #64748b;">
                ${c.rectified_date ? escapeHtml(c.rectified_date) : "Not rectified"}
            </td>
            <td>
                ${c.repair_action ? `<div><strong>Action:</strong> ${escapeHtml(c.repair_action)}</div>` : ''}
                ${c.admin_remarks ? `<div><strong>Remarks:</strong> ${escapeHtml(c.admin_remarks)}</div>` : ''}
                ${!c.repair_action && !c.admin_remarks ? "No repair notes" : ""}
            </td>
            <td>
                <div class="admin-complaint-actions">
                    <button class="btn btn-outline-primary btn-sm" onclick="openStatusModal(${c.id})">
                        ✏️ Update
                    </button>
                    <button class="btn btn-outline-primary btn-sm" data-email-complaint="${c.id}" aria-label="Email ${escapeHtml(c.student_name)} about complaint #${c.id}">
                        ✉️ Email
                    </button>
                    <button class="btn btn-outline-danger btn-sm" data-delete-complaint="${c.id}" aria-label="Delete complaint #${c.id}">
                        Delete
                    </button>
                </div>
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
    modalAssignedTechnician.value = complaint.assigned_technician || "";
    modalRepairAction.value = complaint.repair_action || "";
    modalAdminRemarks.value = complaint.admin_remarks || "";

    modalSummary.innerHTML = `
        <div><strong>Student:</strong> ${escapeHtml(complaint.student_name)} (${escapeHtml(complaint.student_roll)}) - ${escapeHtml(complaint.department || "Department not provided")}</div>
        <div><strong>Location:</strong> ${escapeHtml(complaint.lab_name)} - ${escapeHtml(complaint.lab_location || "Not specified")} - ${escapeHtml(complaint.system_no)}</div>
        <div><strong>Issue:</strong> ${escapeHtml(complaint.issue_type)} - <em>${escapeHtml(complaint.description)}</em></div>
    `;

    statusModal.style.display = "flex";
};

function openEmailModal(complaintId = null) {
    const complaint = complaintId
        ? state.adminComplaints.find(item => String(item.id) === String(complaintId))
        : null;

    emailComposeForm.reset();
    emailSendStatus.textContent = "";
    emailSendStatus.className = "email-send-status";

    if (complaint) {
        emailRecipient.value = complaint.student_email || "";
        emailSubject.value = `Update regarding complaint #${complaint.id}`;
        emailMessage.value = [
            `Dear ${complaint.student_name || "Student"},`,
            "",
            `I am writing regarding your system complaint #${complaint.id} (${complaint.system_no || "system"}).`,
            "",
            "Regards,",
            state.user.full_name || "System Administrator"
        ].join("\n");
        emailComplaintContext.textContent = complaint.student_email
            ? `Complaint #${complaint.id} · Recipient filled from the student's registered email.`
            : `Complaint #${complaint.id} · No registered student email is available; enter the recipient address.`;
        emailComplaintContext.style.display = "block";
    } else {
        emailComplaintContext.textContent = "";
        emailComplaintContext.style.display = "none";
    }

    emailModal.style.display = "flex";
    emailRecipient.focus();
}

function closeEmailModal() {
    if (emailSubmit.disabled) return;
    emailModal.style.display = "none";
    emailComposeForm.reset();
    emailSendStatus.textContent = "";
}

async function handleSendEmail(event) {
    event.preventDefault();
    emailSubmit.disabled = true;
    emailSubmit.textContent = "Sending...";
    emailSendStatus.textContent = "Sending email...";
    emailSendStatus.className = "email-send-status is-loading";

    try {
        await apiRequest("/send-email", "POST", {
            to_email: emailRecipient.value.trim(),
            subject: emailSubject.value.trim(),
            message: emailMessage.value
        });
        showToast("Email sent successfully.", "success");
        emailModal.style.display = "none";
        emailComposeForm.reset();
        emailSendStatus.textContent = "";
    } catch (err) {
        const message = err.message || "Unable to send email. Please try again.";
        emailSendStatus.textContent = message;
        emailSendStatus.className = "email-send-status is-error";
        showToast(message, "error");
    } finally {
        emailSubmit.disabled = false;
        emailSubmit.textContent = "✉️ Send Email";
    }
}

function closeModal() {
    statusModal.style.display = "none";
}

async function handleUpdateStatus(e) {
    e.preventDefault();
    const id = modalComplaintId.value;
    const status = modalStatusSelect.value;
    const admin_remarks = modalAdminRemarks.value.trim();

    try {
        const result = await apiRequest(`/api/admin/complaints/${id}`, "PATCH", {
            status,
            assigned_technician: modalAssignedTechnician.value.trim(),
            repair_action: modalRepairAction.value.trim(),
            admin_remarks
        });

        if (result.email_notification === "failed") {
            showToast(`Complaint #${id} was updated, but the resolution email failed. Check the server configuration and logs.`, "error");
        } else {
            showToast(`Complaint #${id} updated to ${status}!`, "success");
        }
        closeModal();
        loadAdminData();
    } catch (err) {
        showToast(err.message || "Failed to update complaint.", "error");
    }
}

async function deleteComplaint(complaintId, closeStatusModal = false, triggerButton = null) {
    const id = complaintId;
    if (!confirm(`Are you sure you want to permanently delete Complaint #${id}?`)) {
        return;
    }

    if (triggerButton) {
        triggerButton.disabled = true;
        triggerButton.textContent = "Deleting...";
    }

    try {
        await apiRequest(`/api/admin/complaints/${id}`, "DELETE");
        state.adminComplaints = state.adminComplaints.filter(complaint => String(complaint.id) !== String(id));
        renderAdminComplaints(state.adminComplaints);
        showToast(`Complaint #${id} deleted successfully.`, "info");
        if (closeStatusModal) closeModal();
        await loadAdminData();
    } catch (err) {
        if (triggerButton) {
            triggerButton.disabled = false;
            triggerButton.textContent = "Delete";
        }
        showToast(err.message || "Failed to delete complaint.", "error");
    }
}

async function handleDeleteComplaint() {
    return deleteComplaint(modalComplaintId.value, true);
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
