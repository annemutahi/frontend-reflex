const API_BASE = "https://reflex-sprint-awqy.onrender.com/api"; // adjust to your actual API root

const riderList = document.getElementById("rider-list");
const message = document.getElementById("message");

let currentRider = null; // keep track so pickUpDelivery can re-render

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

// ---- Init ----
loadRiders();