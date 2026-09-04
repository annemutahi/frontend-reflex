/* =====================================================================
   DISPATCHER.JS — the only script on the dispatch desk.

   Same back-office words as the retailer page: the backend is the back
   room, the endpoints are the counters, this file walks to them.
   --------------------------------------------------------------------- */

/* THE TEAM'S LIVE BACKEND. Do not change unless the backend moves. */
var API_BASE = "https://reflex-sprint-awqy.onrender.com/api";

/* TODO: replace with the real logged-in dispatcher's id once auth lands.
   Every assignment POST needs it. */
var DISPATCHER_ID = 1;

var ENDPOINT_PENDING = API_BASE + "/dispatcher/pending/";
var ENDPOINT_RIDERS  = API_BASE + "/riders/";
var ENDPOINT_ASSIGN  = API_BASE + "/dispatcher/assign/";

(function () {
  var listEl = document.getElementById("open-list");
  var countEl = document.getElementById("open-count");
  var assignArea = document.getElementById("assign-area");
  var successBox = document.getElementById("success-box");
  var errorBox = document.getElementById("error-box");
  var banner = document.getElementById("demo-banner");

  var deliveries = [];
  var riders = [];
  var selectedDelivery = null;
  var selectedRider = null;
  var demoMode = false;

  /* ---------- honest demo fallback ---------- */

  function seed() {
    return {
      deliveries: [
        { request_id: 2, customer_name: "Grace Njeri", customer_phone: "+254733555666",
          customer_address: "Thika, Section 9, Block C Flat 12",
          item_description: "Two boxes of Amoxil 500mg, pharmacy order",
          delivery_status: "PENDING" },
        { request_id: 1, customer_name: "Peter Otieno", customer_phone: "+254722333444",
          customer_address: "Ruai, Kangundo Road, House 45B",
          item_description: "Samsung 43 inch TV, one carton, sealed",
          delivery_status: "PENDING" }
      ],
      riders: [
        { rider_id: 1, rider_name: "Brian Kiptoo", rider_phone: "+254711000003" },
        { rider_id: 2, rider_name: "Jane Achieng", rider_phone: "+254711000004" }
      ]
    };
  }

  /* ---------- the walks to the counter ---------- */

  function loadAll() {
    return Promise.all([
      fetch(ENDPOINT_PENDING, { headers: { Accept: "application/json" } }).then(function (r) {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json();
      }),
      fetch(ENDPOINT_RIDERS, { headers: { Accept: "application/json" } }).then(function (r) {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json();
      })
    ]).then(function (parts) {
      demoMode = false;
      deliveries = Array.isArray(parts[0]) ? parts[0] : [];
      riders = Array.isArray(parts[1]) ? parts[1] : [];
    }).catch(function () {
      demoMode = true;
      var s = seed();
      deliveries = s.deliveries;
      riders = s.riders;
    });
  }

  function postAssignment(deliveryRequestId, riderId) {
    if (demoMode) {
      /* practice mode: remove the card locally, label stays on */
      deliveries = deliveries.filter(function (d) { return d.request_id !== deliveryRequestId; });
      return Promise.resolve({});
    }
    return fetch(ENDPOINT_ASSIGN, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        delivery_request: deliveryRequestId,
        dispatcher: DISPATCHER_ID,
        rider: riderId
      })
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.message || j.error || j.detail || ("bad status " + r.status));
        });
      }
      return r.json();
    });
  }

  /* ---------- drawing ---------- */

  function esc(value) {
    var d = document.createElement("div");
    d.textContent = value == null ? "" : String(value);
    return d.innerHTML;
  }

  function ref(d) { return "REF-" + String(d.request_id).padStart(3, "0"); }

  function statusLabel(s) {
    switch ((s || "").toLowerCase()) {
      case "pending":
      case "requested": return "Pending";
      case "assigned":  return "Assigned";
      case "picked":
      case "picked_up": return "Picked Up";
      case "delivered": return "Delivered";
      case "failed":    return "Failed";
      case "cancelled": return "Cancelled";
      default:          return s || "Pending";
    }
  }

  function statusClass(s) {
    switch ((s || "").toLowerCase()) {
      case "pending":
      case "requested": return "st-pending";
      case "assigned":  return "st-assigned";
      case "picked":
      case "picked_up": return "st-picked";
      case "delivered": return "st-delivered";
      case "failed":    return "st-failed";
      case "cancelled": return "st-cancelled";
      default:          return "st-pending";
    }
  }

  function renderList() {
    banner.hidden = !demoMode;
    countEl.textContent = deliveries.length + " OPEN REQUEST" + (deliveries.length === 1 ? "" : "S");

    if (!deliveries.length) {
      listEl.innerHTML = '<div class="empty">No open requests right now. The list asks again every five seconds.</div>';
      return;
    }

    listEl.innerHTML = deliveries.map(function (d) {
      return (
        '<div class="req-card">' +
          '<div class="request-top">' +
            '<span class="request-ref">' + esc(ref(d)) + "</span>" +
            '<span class="badge ' + statusClass(d.delivery_status) + '">' + esc(statusLabel(d.delivery_status)) + "</span>" +
          "</div>" +
          '<div class="request-who">' + esc(d.customer_name) + " &middot; " + esc(d.customer_address) + "</div>" +
          '<div class="request-item-desc">' + esc(d.item_description) + "</div>" +
          '<div class="req-actions">' +
            '<button data-id="' + esc(d.request_id) + '" class="ghost view-btn">View &amp; assign</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    var btns = listEl.querySelectorAll(".view-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        var id = Number(this.getAttribute("data-id"));
        selectDelivery(id);
      });
    }
  }

  function selectDelivery(id) {
    selectedDelivery = null;
    selectedRider = null;
    for (var i = 0; i < deliveries.length; i++) {
      if (deliveries[i].request_id === id) selectedDelivery = deliveries[i];
    }
    if (!selectedDelivery) return;
    errorBox.hidden = true;

    var d = selectedDelivery;
    var html =
      '<div class="detail-box">' +
        "<p><strong>" + esc(ref(d)) + "</strong> &middot; " + esc(d.customer_name) + "</p>" +
        '<p class="mono">' + esc(d.customer_phone) + "</p>" +
        "<p>" + esc(d.customer_address) + "</p>" +
        "<p>" + esc(d.item_description) + "</p>" +
      "</div>" +
      '<p class="kicker mono">RIDERS ON DUTY</p>' +
      '<div class="rider-choice" id="rider-choice"></div>' +
      '<button id="assign-btn" disabled>Assign delivery</button>';
    assignArea.innerHTML = html;

    var choice = document.getElementById("rider-choice");
    choice.innerHTML = riders.map(function (r) {
      return '<button data-id="' + esc(r.rider_id) + '">' + esc(r.rider_name) + "</button>";
    }).join("") || '<div class="empty">No riders in the system yet.</div>';

    var rbtns = choice.querySelectorAll("button");
    for (var i = 0; i < rbtns.length; i++) {
      rbtns[i].addEventListener("click", function () {
        var all = choice.querySelectorAll("button");
        for (var j = 0; j < all.length; j++) all[j].classList.remove("selected");
        this.classList.add("selected");
        selectedRider = { rider_id: Number(this.getAttribute("data-id")), rider_name: this.textContent };
        document.getElementById("assign-btn").disabled = false;
      });
    }

    document.getElementById("assign-btn").addEventListener("click", doAssign);
  }

  function doAssign() {
    if (!selectedDelivery || !selectedRider) return;
    var btn = document.getElementById("assign-btn");
    var d = selectedDelivery;
    var r = selectedRider;
    btn.disabled = true;
    btn.textContent = "Assigning…";
    errorBox.hidden = true;
    successBox.hidden = true;

    postAssignment(d.request_id, r.rider_id).then(function () {
      successBox.textContent = ref(d) + " has been assigned to " + r.rider_name + ".";
      successBox.hidden = false;
      setTimeout(function () { successBox.hidden = true; }, 6000);
      assignArea.innerHTML = '<div class="empty">Handed over. Pick the next request on the left.</div>';
      selectedDelivery = null;
      selectedRider = null;
      refresh();
    }).catch(function (err) {
      errorBox.textContent = "Could not assign: " + (err.message || err);
      errorBox.hidden = false;
    }).then(function () {
      if (btn) { btn.disabled = true; btn.textContent = "Assign delivery"; }
    });
  }

  function refresh() {
    loadAll().then(renderList).catch(function () {
      listEl.innerHTML = '<div class="empty">Could not read the open requests.</div>';
    });
  }

  refresh();
  setInterval(refresh, 5000);
})();
