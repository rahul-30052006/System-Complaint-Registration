const adminLoginForm = document.getElementById("admin-login-form");

adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const login_id = document.getElementById("admin-login-id").value.trim();
    const password = document.getElementById("admin-login-password").value;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login_id, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Login failed. Check your credentials.");
        }
        if (data.user.role !== "admin") {
            showToast("This page is for administrators. Please use Student Login.", "error");
            return;
        }

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.assign("/dashboard");
    } catch (error) {
        showToast(error.message || "Login failed. Check your credentials.", "error");
    }
});

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
