// Application State
let currentPage = "dashboard";
let orders = [];
let documents = [];
let qcReports = [];
let dashboardStats = {};

// API Base URL
const API_BASE = "";

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  initializeNavigation();
  loadDashboardData();
  initializeFileUpload();
  initializeFormHandlers();
});

// Navigation
function initializeNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const page = this.dataset.page;
      if (page) {
        navigateToPage(page);
      }
    });
  });
}

function navigateToPage(page) {
  // Update active nav link
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
  });
  document.querySelector(`[data-page="${page}"]`).classList.add("active");

  // Show/hide pages
  document.querySelectorAll(".page").forEach((p) => {
    p.classList.remove("active");
  });
  document.getElementById(page).classList.add("active");

  currentPage = page;

  // Load page-specific data
  switch (page) {
    case "dashboard":
      loadDashboardData();
      break;
    case "orders":
      loadOrdersData();
      break;
    case "documents":
      loadDocumentsData();
      break;
    case "quality":
      loadQualityData();
      break;
    case "production":
      loadProductionData();
      break;
  }
}

// API Functions
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    showToast("Error loading data", "error");
    return null;
  }
}

// Dashboard Functions
async function loadDashboardData() {
  const stats = await fetchAPI("/api/dashboard/stats");
  if (stats) {
    dashboardStats = stats;
    updateDashboardUI();
  }
}

function updateDashboardUI() {
  // Update KPI cards
  document.getElementById("active-orders").textContent =
    dashboardStats.active_orders || 0;
  document.getElementById("completed-orders").textContent =
    dashboardStats.completed_orders || 0;
  document.getElementById("pending-qc").textContent =
    dashboardStats.pending_qc || 0;
  document.getElementById("monthly-revenue").textContent =
    dashboardStats.monthly_revenue || "0";

  // Update pipeline stages
  updatePipelineStages();
}

function updatePipelineStages() {
  const stagesContainer = document.getElementById("pipeline-stages");
  const stages = ["cutting", "stitching", "lasting", "finishing", "packing"];
  const stageIcons = {
    cutting: "fas fa-cut",
    stitching: "fas fa-tshirt",
    lasting: "fas fa-box",
    finishing: "fas fa-paint-brush",
    packing: "fas fa-truck",
  };

  stagesContainer.innerHTML = stages
    .map((stage) => {
      const count = dashboardStats.production_pipeline?.[stage] || 0;
      return `
            <div class="pipeline-stage stage-${stage}">
                <div class="stage-icon">
                    <i class="${stageIcons[stage]}"></i>
                </div>
                <h4>${stage}</h4>
                <div class="count">${count}</div>
                <div class="label">orders</div>
            </div>
        `;
    })
    .join("");
}

// Orders Functions
async function loadOrdersData() {
  const ordersData = await fetchAPI("/api/orders");
  const recentOrdersData = await fetchAPI("/api/orders/recent");

  if (ordersData) {
    orders = ordersData;
    updateOrdersTable();
  }

  if (recentOrdersData) {
    updateRecentOrders(recentOrdersData);
  }
}

function updateRecentOrders(recentOrders) {
  const container = document.getElementById("recent-orders");

  container.innerHTML = recentOrders
    .slice(0, 3)
    .map(
      (order) => `
        <div class="recent-order-card">
            <div class="recent-order-header">
                <span class="order-number">${order.order_number}</span>
                <span class="badge stage-${order.current_stage}">${
        order.current_stage
      }</span>
            </div>
            <p class="order-style">${order.style}</p>
            <p class="due-date">Due: ${
              order.due_date
                ? new Date(order.due_date).toLocaleDateString()
                : "N/A"
            }</p>
        </div>
    `
    )
    .join("");
}

function updateOrdersTable() {
  const tbody = document.getElementById("orders-tbody");

  tbody.innerHTML = orders
    .map(
      (order) => `
        <tr>
            <td class="font-mono">${order.order_number}</td>
            <td>${order.customer_name}</td>
            <td>${order.style}</td>
            <td class="font-mono">${order.quantity?.toLocaleString()}</td>
            <td><span class="badge stage-${order.current_stage}">${
        order.current_stage
      }</span></td>
            <td>${
              order.due_date
                ? new Date(order.due_date).toLocaleDateString()
                : "N/A"
            }</td>
            <td><span class="badge status-${
              order.status
            }">${order.status?.replace("_", " ")}</span></td>
            <td>
                <button class="action-btn" onclick="viewOrder('${order.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn" onclick="editOrder('${order.id}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

// Documents Functions
async function loadDocumentsData() {
  const documentsData = await fetchAPI("/api/documents");

  if (documentsData) {
    documents = documentsData;
    updateDocumentsTable();
  }
}

function updateDocumentsTable() {
  const tbody = document.getElementById("documents-tbody");

  if (documents.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: var(--muted-foreground);">
                    No documents found. Upload your first document to get started.
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = documents
    .map(
      (doc) => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-file-text" style="color: var(--primary);"></i>
                    <span>${doc.original_name}</span>
                </div>
            </td>
            <td class="font-mono">${doc.order_id || "N/A"}</td>
            <td><span class="badge">${doc.document_type?.replace(
              "_",
              " "
            )}</span></td>
            <td>${doc.uploaded_by || "System"}</td>
            <td>${new Date(doc.uploaded_at).toLocaleDateString()}</td>
            <td>${(doc.file_size / 1024 / 1024).toFixed(1)} MB</td>
            <td>
                <button class="action-btn" onclick="viewDocument('${doc.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn" onclick="downloadDocument('${
                  doc.id
                }')">
                    <i class="fas fa-download"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

// Quality Control Functions
async function loadQualityData() {
  const qcData = await fetchAPI("/api/qc/reports");

  if (qcData) {
    qcReports = qcData;
    updateQcSummary();
    updateQcReportsTable();
  }
}

function updateQcSummary() {
  const stats = qcReports.reduce(
    (acc, report) => {
      acc[report.qc_status]++;
      return acc;
    },
    { passed: 0, pending: 0, failed: 0 }
  );

  document.getElementById("qc-passed").textContent = stats.passed;
  document.getElementById("qc-pending").textContent = stats.pending;
  document.getElementById("qc-failed").textContent = stats.failed;
}

function updateQcReportsTable() {
  const tbody = document.getElementById("qc-reports-tbody");

  if (qcReports.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: var(--muted-foreground);">
                    No QC reports found. Create your first QC report to get started.
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = qcReports
    .map(
      (report) => `
        <tr>
            <td class="font-mono">${report.order_id}</td>
            <td>Order Style</td>
            <td>${report.inspector}</td>
            <td>${new Date(report.inspection_date).toLocaleDateString()}</td>
            <td style="color: ${
              report.defects_found === 0 ? "#22c55e" : "#ef4444"
            };">
                ${
                  report.defects_found === 0
                    ? "0"
                    : `${report.defects_found} defects`
                }
            </td>
            <td><span class="badge qc-${report.qc_status}">${
        report.qc_status
      }</span></td>
            <td>
                <button class="action-btn" onclick="viewQcReport('${
                  report.id
                }')">
                    <i class="fas fa-eye"></i>
                </button>
                ${
                  report.qc_status === "pending"
                    ? `
                    <button class="action-btn" onclick="editQcReport('${report.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                `
                    : ""
                }
                ${
                  report.qc_status === "failed"
                    ? `
                    <button class="action-btn" onclick="retryQc('${report.id}')">
                        <i class="fas fa-redo"></i>
                    </button>
                `
                    : ""
                }
            </td>
        </tr>
    `
    )
    .join("");
}

// Production Functions
async function loadProductionData() {
  const ordersData = await fetchAPI("/api/orders");

  if (ordersData) {
    const productionOrders = ordersData.filter(
      (order) => order.status === "in_progress" || order.status === "pending"
    );
    updateProductionPipeline(ordersData);
    updateProductionOrdersTable(productionOrders);
  }
}

function updateProductionPipeline(ordersData) {
  const pipelineContainer = document.getElementById("production-pipeline");
  const stages = ["cutting", "stitching", "lasting", "finishing", "packing"];
  const stageIcons = {
    cutting: "fas fa-cut",
    stitching: "fas fa-tshirt",
    lasting: "fas fa-box",
    finishing: "fas fa-paint-brush",
    packing: "fas fa-truck",
  };

  const stageCounts = stages.reduce((acc, stage) => {
    acc[stage] = ordersData.filter(
      (order) =>
        order.current_stage === stage &&
        (order.status === "in_progress" || order.status === "pending")
    ).length;
    return acc;
  }, {});

  pipelineContainer.innerHTML = stages
    .map(
      (stage) => `
        <div class="production-stage stage-${stage}">
            <div class="stage-icon">
                <i class="${stageIcons[stage]}"></i>
            </div>
            <h4>${stage}</h4>
            <div class="count">${stageCounts[stage]}</div>
            <div class="label">orders</div>
        </div>
    `
    )
    .join("");
}

function updateProductionOrdersTable(productionOrders) {
  const tbody = document.getElementById("production-orders-tbody");

  if (productionOrders.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 32px; color: var(--muted-foreground);">
                    No active production orders found.
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = productionOrders
    .map(
      (order) => `
        <tr>
            <td><input type="checkbox" name="order-select" value="${
              order.id
            }"></td>
            <td class="font-mono">${order.order_number}</td>
            <td>${order.style}</td>
            <td><span class="badge stage-${order.current_stage}">${
        order.current_stage
      }</span></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${
                          order.progress || 0
                        }%"></div>
                    </div>
                    <span style="font-size: 12px; color: var(--muted-foreground);">${
                      order.progress || 0
                    }%</span>
                </div>
            </td>
            <td>${order.assigned_team || "Unassigned"}</td>
            <td>${
              order.due_date
                ? new Date(order.due_date).toLocaleDateString()
                : "N/A"
            }</td>
            <td>
                <button class="action-btn" onclick="advanceStage('${
                  order.id
                }')">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <button class="action-btn" onclick="editProductionOrder('${
                  order.id
                }')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

// Modal Functions
function openNewOrderModal() {
  document.getElementById("new-order-modal").classList.add("active");
}

function closeNewOrderModal() {
  document.getElementById("new-order-modal").classList.remove("active");
  document.getElementById("new-order-form").reset();
  document.getElementById("file-info").style.display = "none";
}

function openQcBot() {
  window.open(
    "https://open-aicode-uqjmrr2kqqusmuittt3pqq.streamlit.app/",
    "_blank"
  );
}

function openNewQcReportModal() {
  // Implement QC report modal
  showToast("QC Report modal coming soon", "info");
}

// File Upload
function initializeFileUpload() {
  const fileInput = document.getElementById("po-file");
  const fileInfo = document.getElementById("file-info");

  fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      fileInfo.style.display = "block";
      fileInfo.innerHTML = `
                <i class="fas fa-file-text"></i>
                Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(
        1
      )} MB)
            `;

      // Mock extraction delay
      setTimeout(() => {
        mockExtractPOData();
      }, 1000);
    }
  });
}

function mockExtractPOData() {
  // Mock extracted data
  document.getElementById("customer-name").value = "Sample Customer Corp";
  document.getElementById("style").value = "Classic Athletic Shoe";
  document.getElementById("quantity").value = "2500";
  document.getElementById("order-amount").value = "125000.00";

  showToast("PO data extracted successfully", "success");
}

// Form Handlers
function initializeFormHandlers() {
  const newOrderForm = document.getElementById("new-order-form");

  newOrderForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(this);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        showToast("Order created successfully", "success");
        closeNewOrderModal();
        loadOrdersData();
        loadDashboardData();
      } else {
        throw new Error("Failed to create order");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      showToast("Failed to create order", "error");
    }
  });
}

// Action Handlers
function handleDocumentAction(action) {
  switch (action) {
    case "upload-po":
      openNewOrderModal();
      break;
    case "bom-files":
      showToast("BOM files feature coming soon", "info");
      break;
    case "qc-reports":
      navigateToPage("quality");
      break;
    case "dispatch-docs":
      showToast("Dispatch docs feature coming soon", "info");
      break;
  }
}

function viewOrder(orderId) {
  showToast("Order details modal coming soon", "info");
}

function editOrder(orderId) {
  showToast("Edit order modal coming soon", "info");
}

function viewDocument(documentId) {
  showToast("Document viewer coming soon", "info");
}

function downloadDocument(documentId) {
  showToast("Document download coming soon", "info");
}

function viewQcReport(reportId) {
  showToast("QC report details coming soon", "info");
}

function editQcReport(reportId) {
  showToast("Edit QC report coming soon", "info");
}

function retryQc(reportId) {
  showToast("QC retry functionality coming soon", "info");
}

function advanceStage(orderId) {
  showToast("Stage advancement coming soon", "info");
}

function editProductionOrder(orderId) {
  showToast("Edit production order coming soon", "info");
}

// Utility Functions
function showToast(message, type = "info") {
  // Simple toast notification
  const toast = document.createElement("div");
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        background-color: ${
          type === "error"
            ? "#ef4444"
            : type === "success"
            ? "#22c55e"
            : "#4285f4"
        };
        color: white;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Search and Filter Functions
document.addEventListener("DOMContentLoaded", function () {
  // Search functionality
  const searchInputs = document.querySelectorAll(
    '[id$="-search"], [id$="search-orders"], [id$="search-documents"]'
  );
  searchInputs.forEach((input) => {
    input.addEventListener("input", debounce(handleSearch, 300));
  });

  // Filter functionality
  const filterSelects = document.querySelectorAll('[id$="-filter"]');
  filterSelects.forEach((select) => {
    select.addEventListener("change", handleFilter);
  });
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const targetTable = e.target.id.includes("orders")
    ? "orders-tbody"
    : "documents-tbody";
  const tbody = document.getElementById(targetTable);
  const rows = tbody.querySelectorAll("tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}

function handleFilter(e) {
  const filterValue = e.target.value;
  const filterId = e.target.id;

  // Implement specific filtering logic based on filter type
  if (filterId.includes("stage")) {
    filterByStage(filterValue);
  } else if (filterId.includes("document-type")) {
    filterByDocumentType(filterValue);
  } else if (filterId.includes("qc-status")) {
    filterByQcStatus(filterValue);
  }
}

function filterByStage(stage) {
  const tbody = document.getElementById("orders-tbody");
  const rows = tbody.querySelectorAll("tr");

  rows.forEach((row) => {
    if (!stage) {
      row.style.display = "";
      return;
    }

    const stageBadge = row.querySelector('.badge[class*="stage-"]');
    if (stageBadge && stageBadge.textContent.includes(stage)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

function filterByDocumentType(type) {
  const tbody = document.getElementById("documents-tbody");
  const rows = tbody.querySelectorAll("tr");

  rows.forEach((row) => {
    if (!type) {
      row.style.display = "";
      return;
    }

    const typeCell = row.cells[2];
    if (typeCell && typeCell.textContent.includes(type.replace("_", " "))) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

function filterByQcStatus(status) {
  const tbody = document.getElementById("qc-reports-tbody");
  const rows = tbody.querySelectorAll("tr");

  rows.forEach((row) => {
    if (!status) {
      row.style.display = "";
      return;
    }

    const statusBadge = row.querySelector('.badge[class*="qc-"]');
    if (statusBadge && statusBadge.textContent.includes(status)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}
