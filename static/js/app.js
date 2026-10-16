/**
 * System Complaint Registration Frontend JS
 */

// Application State
const state = {
    token: localStorage.getItem("token") || null,
    user: JSON.parse(localStorage.getItem("user") || "null"),
    adminComplaints: [],
    studentComplaints: [],
    authRequestPending: false
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

// Admin Elements
const statTotal = document.getElementById("stat-total");
const statPending = document.getElementById("stat-pending");
const statProgress = document.getElementById("stat-progress");
const statResolved = document.getElementById("stat-resolved");
const adminComplaintsTbody = document.getElementById("admin-complaints-tbody");
const viewComplaintModal = document.getElementById("view-complaint-modal");
const viewComplaintTitle = document.getElementById("view-complaint-title");
const viewComplaintStatus = document.getElementById("view-complaint-status");
const viewComplaintContent = document.getElementById("view-complaint-content");
const viewComplaintClose = document.getElementById("view-complaint-close");
const viewComplaintDismiss = document.getElementById("view-complaint-dismiss");
const viewComplaintUpdate = document.getElementById("view-complaint-update");
const viewComplaintEmail = document.getElementById("view-complaint-email");
const btnDeleteComplaint = document.getElementById("btn-delete-complaint");
const adminSearch = document.getElementById("admin-search");
const adminFilterLab = document.getElementById("admin-filter-lab");
const adminFilterStatus = document.getElementById("admin-filter-status");
const btnRefreshAdmin = document.getElementById("btn-refresh-admin");
const btnSendEmail = document.getElementById("btn-send-email");

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
            document.body.classList.toggle("student-signin-page", btn.dataset.tab === "login-tab");
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
    viewComplaintContent.addEventListener("submit", event => {
        if (event.target.id === "complaint-update-form") handleUpdateStatus(event);
    });
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
    emailModalClose.addEventListener("click", closeEmailModal);
    emailCancel.addEventListener("click", closeEmailModal);
    btnDeleteComplaint.addEventListener("click", handleDeleteComplaint);
    adminComplaintsTbody.addEventListener("click", event => {
        const viewButton = event.target.closest("[data-view-complaint]");
        if (viewButton) {
            openViewComplaint(viewButton.dataset.viewComplaint);
            return;
        }
        const emailButton = event.target.closest("[data-email-complaint]");
        if (emailButton) {
            openEmailModal(emailButton.dataset.emailComplaint);
            return;
        }
        const button = event.target.closest("[data-delete-complaint]");
        if (!button) return;
        deleteComplaint(button.dataset.deleteComplaint, false, button);
    });
    viewComplaintClose.addEventListener("click", closeViewComplaint);
    viewComplaintDismiss.addEventListener("click", closeViewComplaint);
    viewComplaintUpdate.addEventListener("click", () => {
        const assignmentForm = document.getElementById("complaint-update-form");
        assignmentForm.scrollIntoView({ behavior: "smooth", block: "start" });
        assignmentForm.querySelector("#update-status").focus({ preventScroll: true });
    });
    viewComplaintEmail.addEventListener("click", () => {
        openEmailModal(viewComplaintModal.dataset.complaintId);
    });
    viewComplaintModal.addEventListener("click", event => {
        if (event.target === viewComplaintModal) closeViewComplaint();
    });
    emailModal.addEventListener("click", event => {
        if (event.target === emailModal) closeEmailModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (viewComplaintModal.style.display === "flex") closeViewComplaint();
            if (emailModal.style.display === "flex") closeEmailModal();
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
    if (state.authRequestPending) return;
    state.authRequestPending = true;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = "Signing in...";
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
    } finally {
        state.authRequestPending = false;
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

async function handleSignup(e) {
    e.preventDefault();
    if (state.authRequestPending) return;
    state.authRequestPending = true;
    const submitButton = signupForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = "Creating account...";
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
    } finally {
        state.authRequestPending = false;
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
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
    document.body.classList.remove("student-dashboard-mode");
    document.body.classList.add("student-auth-page");
    authSection.style.display = "flex";
    studentSection.style.display = "none";
    adminSection.style.display = "none";
    navUserSection.style.display = "none";
}

function showDashboardView() {
    document.body.classList.add("dashboard-mode");
    document.body.classList.remove("student-auth-page");
    document.body.classList.toggle("student-dashboard-mode", state.user.role !== "admin");
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
    const studentName = state.user.full_name || state.user.username;

    complaintStudentNameInput.value = studentName;
    complaintStudentNameInput.defaultValue = studentName;
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
    const complaint_date = complaintDateInput.value;
    const department = departmentInput.value.trim();
    const lab_location = document.getElementById("lab-location").value.trim();
    const system_no = document.getElementById("system-no").value.trim();
    const issue_type = document.getElementById("issue-type").value;
    const priority = document.getElementById("priority").value;
    const description = document.getElementById("description").value.trim();

    if (!complaint_date || !department || !lab_name || !lab_location || !system_no || !issue_type || !description) {
        if (selectedLab === "Others" && !lab_name) {
            customLabName.reportValidity();
            return;
        }
        showToast("Please fill in all required fields.", "error");
        return;
    }

    try {
        await apiRequest("/api/complaints", "POST", {
            complaint_date,
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
            ${c.technician_contact ? `<div class="complaint-remarks"><strong>Technician Contact:</strong> ${escapeHtml(c.technician_contact)}</div>` : ''}
            ${c.service_visit_at ? `<div class="complaint-remarks"><strong>Scheduled Service Visit:</strong> ${escapeHtml(formatServiceVisit(c.service_visit_at))}</div>` : ''}
            ${c.repair_action ? `<div class="complaint-remarks"><strong>Repair Action:</strong> ${escapeHtml(c.repair_action)}</div>` : ''}
            ${c.admin_remarks ? `
                <div class="complaint-remarks">
                    <strong>Technician Remarks:</strong> ${escapeHtml(c.admin_remarks)}
                </div>
            ` : ''}

            <div class="complaint-meta">
                <span>Ticket #${c.id}</span>
                <span>Filed: ${formatComplaintDate(c.complaint_date || c.created_at)}</span>
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
                <td colspan="11" class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>No complaints match your current filter criteria.</p>
                </td>
            </tr>
        `;
        return;
    }

    adminComplaintsTbody.innerHTML = complaints.map((c, index) => `
        <tr class="complaint-row">
            <td data-label="SL No."><strong>${index + 1}</strong></td>
            <td data-label="Complaint Date">${formatComplaintDate(c.complaint_date)}</td>
            <td data-label="Student Name">
                <strong>${escapeHtml(c.student_name)}</strong>
            </td>
            <td data-label="Department">${escapeHtml(c.department || "Not specified")}</td>
            <td data-label="Lab Name">${escapeHtml(c.lab_name)}</td>
            <td data-label="System No."><span class="badge" style="background:#e0e7ff; color:#3730a3;">${escapeHtml(c.system_no)}</span></td>
            <td data-label="Lab Location">${escapeHtml(c.lab_location || "Not specified")}</td>
            <td data-label="Issue">
                <strong>${escapeHtml(c.issue_type)}</strong>
            </td>
            <td class="priority-cell" data-label="Priority">
                <span class="priority-badge priority-${c.priority.toLowerCase()}">${c.priority}</span>
            </td>
            <td class="complaint-details-cell" data-label="Complaint Details">${escapeHtml(c.description)}</td>
            <td data-label="Actions">
                <div class="admin-complaint-actions">
                    <button class="btn btn-outline-primary btn-sm" type="button" data-view-complaint="${c.id}">View Complaints</button>
                    <button class="btn btn-outline-primary btn-sm" type="button" data-email-complaint="${c.id}">Email</button>
                    <button class="btn btn-outline-danger btn-sm" type="button" data-delete-complaint="${c.id}">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");
}

function openViewComplaint(complaintId) {
    const complaint = state.adminComplaints.find(item => String(item.id) === String(complaintId));
    if (!complaint) {
        showToast("Complaint not found. Refresh the list and try again.", "error");
        return;
    }

    const field = (label, value, className = "") => `
        <div class="complaint-detail-item ${className}">
            <dt>${escapeHtml(label)}</dt>
            <dd>${value}</dd>
        </div>
    `;
    const value = (text, fallback = "Not provided") =>
        escapeHtml(String(text || fallback));
    const sections = [
        {
            title: "Student Information",
            fields: [
                field("Student Name", value(complaint.student_name)),
                field("Roll Number", value(complaint.student_roll)),
                field("Registered Email", value(complaint.student_email, "Not available")),
                field("Department", value(complaint.department, "Not specified"))
            ]
        },
        {
            title: "Lab & System Information",
            fields: [
                field("Lab Name", value(complaint.lab_name)),
                field("Lab Location", value(complaint.lab_location, "Not specified")),
                field("System Number", value(complaint.system_no))
            ]
        },
        {
            title: "Complaint Details",
            fields: [
                field("Issue Type", value(complaint.issue_type, "Not specified")),
                field("Priority", `<span class="priority-badge priority-${escapeHtml(String(complaint.priority || "").toLowerCase())}">${value(complaint.priority)}</span>`),
                field("Status", `<span class="status-badge status-${escapeHtml(String(complaint.status || "").toLowerCase().replace(/\s+/g, "-"))}">${value(complaint.status)}</span>`),
                field("Description", value(complaint.description), "complaint-detail-item-wide")
            ]
        },
        {
            title: "Resolution Information",
            fields: [
                field("Assigned Technician", value(complaint.assigned_technician, "Not assigned")),
                field("Technician Contact", value(complaint.technician_contact, "Not provided")),
                field("Expected Service Date", value(formatServiceVisit(complaint.service_visit_at))),
                field("Repair Action Taken", value(complaint.repair_action, "None")),
                field("Admin Remarks", value(complaint.admin_remarks, "None"), "complaint-detail-item-wide"),
                field("Rectified Date", value(complaint.rectified_date, "Not rectified"))
            ]
        },
        {
            title: "Record Information",
            fields: [
                field("Complaint Date", value(formatComplaintDate(complaint.complaint_date)))
            ]
        }
    ];

    viewComplaintTitle.textContent = `Complaint No: ${complaint.id}`;
    viewComplaintStatus.textContent = complaint.status || "Unknown";
    viewComplaintStatus.className = `status-badge status-${String(complaint.status || "").toLowerCase().replace(/\s+/g, "-")}`;
    viewComplaintContent.innerHTML = `
        <div class="complaint-detail-sections">
            ${sections.map(section => `
                <section class="complaint-detail-section">
                    <h4>${escapeHtml(section.title)}</h4>
                    <dl class="complaint-detail-list">${section.fields.join("")}</dl>
                </section>
            `).join("")}
            <section class="complaint-assignment-panel" aria-labelledby="assignment-heading">
                <div class="assignment-panel-heading">
                    <h4 id="assignment-heading">Assign Service Technician</h4>
                    <p>Save service details and notify the student at their registered email when assignment details change.</p>
                </div>
                <form id="complaint-update-form" class="complaint-update-form">
                    <div class="service-form-grid">
                        <div class="form-group">
                            <label for="update-technician">Technician name</label>
                            <input id="update-technician" type="text" maxlength="100" value="${escapeHtml(complaint.assigned_technician || "")}" placeholder="Name of assigned technician">
                        </div>
                        <div class="form-group">
                            <label for="update-technician-contact">Technician contact details</label>
                            <input id="update-technician-contact" type="text" maxlength="200" value="${escapeHtml(complaint.technician_contact || "")}" placeholder="Phone number or email, if available">
                        </div>
                        <div class="form-group">
                            <label for="update-service-visit">Service visit date and time</label>
                            <input id="update-service-visit" type="datetime-local" value="${escapeHtml(String(complaint.service_visit_at || "").replace(" ", "T").slice(0, 16))}">
                        </div>
                        <div class="form-group">
                            <label for="update-status">Complaint status</label>
                            <select id="update-status" required>
                                ${["Pending", "In Progress", "Technician Assigned", "Resolved", "Rejected"].map(status => `
                                    <option value="${status}" ${complaint.status === status ? "selected" : ""}>${status}</option>
                                `).join("")}
                            </select>
                        </div>
                        <div class="form-group service-form-wide">
                            <label for="update-repair-action">Repair action or service instructions</label>
                            <textarea id="update-repair-action" rows="3" maxlength="2000" placeholder="Repair action taken or instructions for the service visit">${escapeHtml(complaint.repair_action || "")}</textarea>
                        </div>
                        <div class="form-group service-form-wide">
                            <label for="update-admin-remarks">Admin remarks and contact instructions</label>
                            <textarea id="update-admin-remarks" rows="3" maxlength="1000" placeholder="Add updates or instructions for the student">${escapeHtml(complaint.admin_remarks || "")}</textarea>
                        </div>
                    </div>
                    <p id="complaint-update-status" class="complaint-update-status" role="status" aria-live="polite"></p>
                    <button id="complaint-update-submit" type="submit" class="btn btn-primary modal-action-btn">Save / Update Complaint</button>
                </form>
            </section>
        </div>
    `;
    btnDeleteComplaint.dataset.complaintId = String(complaint.id);
    viewComplaintModal.dataset.complaintId = String(complaint.id);
    viewComplaintModal.style.display = "flex";
    syncModalScrollLock();
}

function closeViewComplaint() {
    viewComplaintModal.style.display = "none";
    syncModalScrollLock();
}

function openEmailModal(complaintId = null) {
    const complaint = complaintId
        ? state.adminComplaints.find(item => String(item.id) === String(complaintId))
        : null;
    if (complaintId !== null && !complaint) {
        showToast("Complaint not found. Refresh the list and try again.", "error");
        return;
    }
    if (complaint && !complaint.student_email) {
        showToast("This complaint has no registered student email address.", "error");
        return;
    }

    emailComposeForm.reset();
    emailSendStatus.textContent = "";
    emailSendStatus.className = "email-send-status";
    emailRecipient.readOnly = Boolean(complaint);
    emailModal.dataset.complaintId = complaint ? String(complaint.id) : "";

    if (complaint) {
        emailRecipient.value = complaint.student_email;
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
    syncModalScrollLock();
    emailRecipient.focus();
}

function closeEmailModal() {
    if (emailSubmit.disabled) return;
    emailModal.style.display = "none";
    syncModalScrollLock();
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
        const complaintId = emailModal.dataset.complaintId;
        const emailRequest = complaintId
            ? apiRequest(`/api/admin/complaints/${complaintId}/email`, "POST", {
                subject: emailSubject.value.trim(),
                message: emailMessage.value
            })
            : apiRequest("/send-email", "POST", {
                to_email: emailRecipient.value.trim(),
                subject: emailSubject.value.trim(),
                message: emailMessage.value
            });
        await emailRequest;
        showToast("Email sent successfully.", "success");
        emailModal.style.display = "none";
        syncModalScrollLock();
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

function syncModalScrollLock() {
    const modalOpen = [viewComplaintModal, emailModal]
        .some(modal => modal.style.display === "flex");
    document.body.classList.toggle("modal-open", modalOpen);
}

async function handleUpdateStatus(event) {
    event.preventDefault();
    const complaintId = viewComplaintModal.dataset.complaintId;
    const currentComplaint = state.adminComplaints.find(
        complaint => String(complaint.id) === String(complaintId)
    );
    const form = event.target;
    const status = form.querySelector("#update-status").value;
    const feedback = form.querySelector("#complaint-update-status");
    const submitButton = form.querySelector("#complaint-update-submit");

    if (!currentComplaint) {
        feedback.textContent = "Complaint not found. Refresh the dashboard and try again.";
        feedback.className = "complaint-update-status is-error";
        return;
    }
    if (status === "Resolved" && currentComplaint.status !== "Resolved" &&
        !confirm("Mark this complaint as Resolved and send the repair-completion email to the student?")) {
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    feedback.textContent = "Saving complaint updates...";
    feedback.className = "complaint-update-status is-loading";
    try {
        const result = await apiRequest(`/api/admin/complaints/${complaintId}`, "PATCH", {
            status,
            assigned_technician: form.querySelector("#update-technician").value.trim(),
            technician_contact: form.querySelector("#update-technician-contact").value.trim(),
            service_visit_at: form.querySelector("#update-service-visit").value || null,
            repair_action: form.querySelector("#update-repair-action").value.trim(),
            admin_remarks: form.querySelector("#update-admin-remarks").value.trim()
        });

        state.adminComplaints = state.adminComplaints.map(complaint =>
            String(complaint.id) === String(complaintId)
                ? { ...complaint, ...result.complaint }
                : complaint
        );
        renderAdminComplaints(state.adminComplaints);
        openViewComplaint(complaintId);
        const updatedFeedback = document.getElementById("complaint-update-status");
        if (result.email_notification === "failed") {
            const message = `Complaint saved, but the ${result.notification_type} email was not sent: ${result.email_error || "SMTP delivery failed."}`;
            updatedFeedback.textContent = message;
            updatedFeedback.className = "complaint-update-status is-error";
            showToast(message, "error");
        } else if (result.email_notification === "sent") {
            const message = `Complaint saved and ${result.notification_type} email sent to the student's registered address.`;
            updatedFeedback.textContent = message;
            updatedFeedback.className = "complaint-update-status is-success";
            showToast(message, "success");
        } else {
            const message = `Complaint #${complaintId} saved successfully. No notification was needed for this unchanged update.`;
            updatedFeedback.textContent = message;
            updatedFeedback.className = "complaint-update-status is-success";
            showToast(message, "success");
        }
        await loadAdminData();
    } catch (err) {
        feedback.textContent = err.message || "Failed to update complaint.";
        feedback.className = "complaint-update-status is-error";
        showToast(feedback.textContent, "error");
    } finally {
        const activeSubmitButton = document.getElementById("complaint-update-submit");
        if (activeSubmitButton) {
            activeSubmitButton.disabled = false;
            activeSubmitButton.textContent = "Save / Update Complaint";
        }
    }
}

async function deleteComplaint(complaintId, closeDetailsModal = false, triggerButton = null) {
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
        showToast(`Complaint #${id} deleted successfully.`, "success");
        if (closeDetailsModal) closeViewComplaint();
        await loadAdminData();
    } catch (err) {
        showToast(err.message || "Failed to delete complaint.", "error");
    } finally {
        if (triggerButton) {
            triggerButton.disabled = false;
            triggerButton.textContent = "Delete";
        }
    }
}

async function handleDeleteComplaint() {
    return deleteComplaint(viewComplaintModal.dataset.complaintId, true, btnDeleteComplaint);
}

// ================= API & UTILITY HELPERS =================
async function apiRequest(url, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) {
        headers["Authorization"] = `Bearer ${state.token}`;
    }

    const options = {
        method,
        headers,
        cache: method === "GET" ? "no-store" : "default"
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    let data;
    try {
        data = await response.json();
    } catch {
        if (!response.ok) {
            if (url.startsWith("/api/auth/") && response.status >= 500) {
                throw new Error(
                    "The server could not complete your sign-in or registration. Please try again; if it continues, check the backend terminal log."
                );
            }
            throw new Error(`Request failed with status ${response.status}.`);
        }
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        const detail = Array.isArray(data.detail)
            ? data.detail.map(issue => {
                const field = Array.isArray(issue.loc) ? issue.loc[issue.loc.length - 1] : null;
                return field ? `${field}: ${issue.msg}` : issue.msg;
            }).join("; ")
            : data.detail;
        if (url.startsWith("/api/auth/") && response.status >= 500) {
            throw new Error(
                "The server could not complete your sign-in or registration. Please try again; if it continues, check the backend terminal log."
            );
        }
        throw new Error(detail || data.message || "An unexpected error occurred.");
    }

    return data;
}

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const duplicate = [...container.querySelectorAll(".toast")].some(
        toast => toast.dataset.message === message && toast.dataset.type === type
    );
    if (duplicate) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.dataset.message = message;
    toast.dataset.type = type;

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

function formatServiceVisit(dateStr) {
    if (!dateStr) return "Not scheduled";
    try {
        const d = new Date(dateStr.replace(" ", "T"));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return dateStr;
    }
}

function formatComplaintDate(dateStr) {
    if (!dateStr) return "-";
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    if (!match) return formatDate(dateStr);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}
