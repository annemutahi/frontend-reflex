const API_BASE = "https://reflex-sprint-awqy.onrender.com/api"; // adjust to your actual API root

const riderList = document.getElementById("rider-list");
const message = document.getElementById("message");

let currentRider = null; // keep track so pickUpDelivery/markDelivered can re-render
let activeScanner = null; // keep track so we can stop a running scanner before starting another

// ---- Load riders from backend and build buttons ----
async function loadRiders() {
    const res = await fetch(`${API_BASE}/riders/`);
    const riders = await res.json();

    riderList.innerHTML = "";
    riders.forEach(rider => {
        const button = document.createElement("button");
        button.textContent = rider.rider_name;
        button.classList.add("rider-button");

        button.addEventListener("click", () => {
            currentRider = rider;
            showRiderDeliveries(rider);
        });

        riderList.appendChild(button);
    });
}

// ---- Load and render a rider's deliveries from backend ----
async function showRiderDeliveries(rider) {
    message.innerHTML = "";

    const heading = document.createElement("h2");
    heading.textContent = `Welcome, ${rider.rider_name}`;
    message.appendChild(heading);

    const deliveryHeading = document.createElement("h3");
    deliveryHeading.textContent = "My Deliveries";
    message.appendChild(deliveryHeading);

    const res = await fetch(`${API_BASE}/rider/assigned/?rider_id=${rider.rider_id}`);
    const riderDeliveries = await res.json();

    riderDeliveries.forEach(delivery => {
        const deliveryCard = document.createElement("div");
        deliveryCard.classList.add("delivery-card");

        deliveryCard.innerHTML = `
            <h3>${delivery.customer_name}</h3>

            <p>
                <strong>Phone:</strong>
                <a href="tel:${delivery.customer_phone}">${delivery.customer_phone}</a>
            </p>

            <p><strong>Address:</strong> ${delivery.customer_address}</p>
            <p><strong>Item:</strong> ${delivery.item_description}</p>
            <p><strong>Status:</strong> ${delivery.delivery_status}</p>

            <div class="qr-code" id="qr-${delivery.request_id}"></div>
            <p class="confirmation-code">${delivery.confirmation_code}</p>

            ${
                delivery.delivery_status === "ASSIGNED"
                    ? `<button class="pickup-button" onclick="pickUpDelivery('${delivery.request_id}')">Pick Up</button>`
                    : ""
            }
            ${
                delivery.delivery_status === "PICKED"
                    ? `<button class="scan-button" onclick="startScan('${delivery.request_id}')">Scan to Confirm Delivery</button>
                       <div id="scanner-${delivery.request_id}" class="scanner-container"></div>
                       <button class="manual-entry-button" onclick="promptManualCode('${delivery.request_id}')">Enter code manually</button>`
                    : ""
            }
        `;

        message.appendChild(deliveryCard);

        new QRCode(document.getElementById(`qr-${delivery.request_id}`), {
            text: delivery.confirmation_code,
            width: 150,
            height: 150
        });
    });
}

// ---- Mark picked up via backend, then re-render from fresh data ----
async function pickUpDelivery(deliveryId) {
    const res = await fetch(`${API_BASE}/requests/${deliveryId}/picked/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Could not update delivery status.");
        return;
    }

    alert("Delivery picked up successfully.");

    if (currentRider) {
        showRiderDeliveries(currentRider); // re-fetch and re-render, no stale local state
    }
}

// ---- QR scanning to confirm delivery ----
async function startScan(deliveryId) {
    // Stop any existing scanner first (only one can run at a time)
    if (activeScanner) {
        await activeScanner.stop().catch(() => {});
        activeScanner = null;
    }

    const containerId = `scanner-${deliveryId}`;
    const scanner = new Html5Qrcode(containerId);
    activeScanner = scanner;

    scanner.start(
        { facingMode: "environment" }, // rear camera
        { fps: 10, qrbox: 200 },
        (decodedText) => {
            // Scan succeeded — stop camera, then confirm with backend
            scanner.stop().then(() => {
                activeScanner = null;
                markDelivered(deliveryId, decodedText);
            }).catch(() => {
                activeScanner = null;
                markDelivered(deliveryId, decodedText);
            });
        },
        (errorMessage) => {
            // fires continuously while no QR is in frame — ignore
        }
    ).catch(err => {
        alert("Could not access camera: " + err);
    });
}

// ---- Fallback: manual code entry if camera/scan fails ----
function promptManualCode(deliveryId) {
    const code = prompt("Enter the confirmation code shown on the delivery:");
    if (code) {
        markDelivered(deliveryId, code.trim());
    }
}

// ---- Confirm delivery via backend, then re-render from fresh data ----
async function markDelivered(deliveryId, scannedCode) {
    const res = await fetch(`${API_BASE}/requests/${deliveryId}/delivered/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: scannedCode })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Could not confirm delivery.");
        return;
    }

    alert("Delivery confirmed and marked as delivered.");

    if (currentRider) {
        showRiderDeliveries(currentRider); // re-fetch and re-render, no stale local state
    }
}

// ---- Init ----
loadRiders();