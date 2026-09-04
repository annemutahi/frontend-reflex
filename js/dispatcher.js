// ============================================================
// Reflex Delivery — Dispatcher Dashboard
// Wired to live backend endpoints (replaces mock data arrays)
// ============================================================

const API_BASE = "http://127.0.0.1:8000/api"; // e.g. "https://api.yourdomain.com" — leave "" if same-origin

// TODO: replace with the real logged-in dispatcher's id once dispatcher
// auth/session is wired up. Every assignment POST needs this.
const DEMO_DISPATCHER_ID = 1;

const ENDPOINTS = {
    pending: `${API_BASE}/dispatcher/pending/`,
    riders: `${API_BASE}/riders/`,
    assign: `${API_BASE}/dispatcher/assign/`
};

const POLL_INTERVAL_MS = 5000;


// Elements

const deliveryList = document.getElementById("deliveryList");
const requestCount = document.getElementById("requestCount");

const assignmentModal = document.getElementById("assignmentModal");
const deliveryDetails = document.getElementById("deliveryDetails");

const riderList = document.getElementById("riderList");
const assignButton = document.getElementById("assignButton");

const closeModal = document.getElementById("closeModal");

const successMessage = document.getElementById("successMessage");
const successText = document.getElementById("successText");


// State (replaces the old hardcoded `deliveries` / `riders` arrays)

let deliveries = [];
let riders = [];

let selectedDelivery = null; // full delivery_request object from API
let selectedRider = null;    // full rider object from API

let pollTimer = null;


// ---------- API calls ----------

async function fetchPendingDeliveries() {
    const res = await fetch(ENDPOINTS.pending);
    if (!res.ok) {
        throw new Error(`Failed to load pending requests: ${res.status}`);
    }
    return res.json();
}

async function fetchRiders() {
    const res = await fetch(ENDPOINTS.riders);
    if (!res.ok) {
        throw new Error(`Failed to load riders: ${res.status}`);
    }
    return res.json();
}

async function postAssignment(deliveryRequestId, riderId) {
    const res = await fetch(ENDPOINTS.assign, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            delivery_request: deliveryRequestId,
            dispatcher: DEMO_DISPATCHER_ID,
            rider: riderId
        })
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Assignment failed: ${res.status} ${errBody}`);
    }

    return res.json();
}


// ---------- Rendering ----------

function displayDeliveries() {

    deliveryList.innerHTML = "";

    deliveries.forEach(delivery => {

        const card = document.createElement("div");

        card.classList.add("delivery-card");

        card.innerHTML = `
            <div class="delivery-info">

                <h3>${delivery.customer_name}</h3>

                <p>
                    <strong>📍 Address:</strong>
                    ${delivery.customer_address}
                </p>

                <p>
                    <strong>📦 Item:</strong>
                    ${delivery.item_description}
                </p>

            </div>

            <div class="delivery-meta">

                <div class="delivery-id">
                    REF-${String(delivery.request_id).padStart(3, "0")}
                </div>

                <span class="badge ${delivery.delivery_status.toLowerCase()}">
                    ${delivery.delivery_status}
                </span>

                <br>
                <button
                    class="view-button"
                    onclick="openDelivery(${delivery.request_id})"
                >
                    View & Assign
                </button>

            </div>
        `;

        deliveryList.appendChild(card);
    });

    // This view only ever shows PENDING requests (backend filters that),
    // so every item currently rendered counts as an open request.
    const openRequests = deliveries.length;

    requestCount.textContent =
        `${openRequests} open request${openRequests !== 1 ? "s" : ""}`;
}

function displayRiders() {

    riderList.innerHTML = "";

    // NOTE: rider model has no `available` field yet, so every rider
    // returned by /riders/ is shown as selectable for now.
    riders.forEach(rider => {

        const riderCard = document.createElement("div");

        riderCard.classList.add("rider-card");

        riderCard.innerHTML = `
            <div>
                <div class="rider-name">
                    ${rider.rider_name}
                </div>

                <div class="rider-phone">
                    ${rider.rider_phone}
                </div>
            </div>

            <span class="rider-status">
                Available
            </span>
        `;

        riderCard.addEventListener("click", () => {

            document
                .querySelectorAll(".rider-card")
                .forEach(card => {
                    card.classList.remove("selected");
                });

            riderCard.classList.add("selected");

            selectedRider = rider;

            assignButton.disabled = false;
        });

        riderList.appendChild(riderCard);
    });
}


// ---------- Modal / selection ----------

function openDelivery(requestId) {

    selectedDelivery = deliveries.find(
        delivery => delivery.request_id === requestId
    );

    if (!selectedDelivery) return;

    selectedRider = null;
    assignButton.disabled = true;

    deliveryDetails.innerHTML = `
        <p>
            <strong>Request:</strong>
            REF-${String(selectedDelivery.request_id).padStart(3, "0")}
        </p>

        <p>
            <strong>Customer:</strong>
            ${selectedDelivery.customer_name}
        </p>

        <p>
            <strong>Phone:</strong>
            ${selectedDelivery.customer_phone}
        </p>

        <p>
            <strong>Address:</strong>
            ${selectedDelivery.customer_address}
        </p>

        <p>
            <strong>Item:</strong>
            ${selectedDelivery.item_description}
        </p>
    `;

    displayRiders();

    assignmentModal.classList.remove("hidden");
}


// ---------- Assigning ----------

assignButton.addEventListener("click", async () => {

    if (!selectedDelivery || !selectedRider) {
        return;
    }

    const deliveryId = selectedDelivery.request_id;
    const riderName = selectedRider.rider_name;

    assignButton.disabled = true;
    assignButton.textContent = "Assigning...";

    try {
        await postAssignment(deliveryId, selectedRider.rider_id);

        assignmentModal.classList.add("hidden");

        // Backend already flipped delivery_status to ASSIGNED, so just
        // refresh from the server rather than mutating local state.
        await loadDashboard();

        successText.textContent =
            `REF-${String(deliveryId).padStart(3, "0")} has been assigned to ${riderName}.`;

        successMessage.classList.remove("hidden");

        setTimeout(() => {
            successMessage.classList.add("hidden");
        }, 4000);

    } catch (err) {
        console.error(err);
        alert("Could not assign rider. Please try again.");
    } finally {
        assignButton.disabled = false;
        assignButton.textContent = "Assign Rider";
        selectedDelivery = null;
        selectedRider = null;
    }
});


// ---------- Modal close ----------

closeModal.addEventListener("click", () => {
    assignmentModal.classList.add("hidden");
});

assignmentModal.addEventListener("click", event => {
    if (event.target === assignmentModal) {
        assignmentModal.classList.add("hidden");
    }
});


// ---------- Load + polling ----------

async function loadDashboard() {
    try {
        const [pendingData, riderData] = await Promise.all([
            fetchPendingDeliveries(),
            fetchRiders()
        ]);

        deliveries = pendingData;
        riders = riderData;

        displayDeliveries();

    } catch (err) {
        console.error("Dashboard load failed:", err);
        requestCount.textContent = "Unable to load requests";
    }
}

function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadDashboard, POLL_INTERVAL_MS);
}


// ---------- Initial load ----------

loadDashboard();
startPolling();