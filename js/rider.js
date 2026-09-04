/* =====================================================================
   RIDER.JS — the only script on the rider desk.

   Same back-office words as the other desks: the backend is the back
   room, the endpoints are the counters, this file walks to them.
   ===================================================================== */

/* THE TEAM'S LIVE BACKEND. Do not change unless the backend moves. */
var API_BASE = "https://reflex-sprint-awqy.onrender.com/api";

(function () {
  var choiceEl = document.getElementById("rider-choice");
  var myPanel = document.getElementById("my-panel");
  var myList = document.getElementById("my-list");
  var welcome = document.getElementById("welcome");
  var successBox = document.getElementById("success-box");
  var errorBox = document.getElementById("error-box");
  var banner = document.getElementById("demo-banner");

  var currentRider = null;
  var myDeliveries = [];
  var demoMode = false;
  var scannerActive = false;

  /* ---------- honest demo fallback ---------- */

  function seedRiders() {
    return [
      { rider_id: 1, rider_name: "Brian Kiptoo", rider_phone: "+254711000003" },
      { rider_id: 2, rider_name: "Jane Achieng", rider_phone: "+254711000004" }
    ];
  }

  function seedDeliveries() {
    return [
      { request_id: 3, customer_name: "Samuel Kariuki", customer_phone: "+254744777888",
        customer_address: "Juja, Gate C, Student Hostels",
        item_description: "Hammer drill and a box of masonry bits",
        delivery_status: "PICKED", confirmation_code: "RFX-CODE-4417" },
      { request_id: 2, customer_name: "Grace Njeri", customer_phone: "+254733555666",
        customer_address: "Thika, Section 9, Block C Flat 12",
        item_description: "Two boxes of Amoxil 500mg, pharmacy order",
        delivery_status: "ASSIGNED", confirmation_code: "RFX-CODE-2210" }
    ];
  }

  /* ---------- the walks to the counter ---------- */

  function loadRiders() {
    return fetch(API_BASE + "/riders/", { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json();
      })
      .then(function (data) {
        demoMode = false;
        return Array.isArray(data) ? data : [];
      })
      .catch(function () {
        demoMode = true;
        return seedRiders();
      });
  }

  function loadMine(riderId) {
    if (demoMode) return Promise.resolve(seedDeliveries());
    return fetch(API_BASE + "/rider/assigned/?rider_id=" + riderId,
      { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json();
      })
      .then(function (data) { return Array.isArray(data) ? data : []; });
  }

  function patchPicked(id) {
    if (demoMode) {
      myDeliveries.forEach(function (d) {
        if (d.request_id === id) d.delivery_status = "PICKED";
      });
      return Promise.resolve({});
    }
    return fetch(API_BASE + "/requests/" + id + "/picked/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" }
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.error || j.message || j.detail || ("bad status " + r.status));
        });
      }
      return r.json();
    });
  }

  function patchDelivered(id, code) {
    if (demoMode) {
      var target = null;
      myDeliveries.forEach(function (d) { if (d.request_id === id) target = d; });
      if (!target || target.confirmation_code !== code) {
        return Promise.reject(new Error("That code does not match this delivery."));
      }
      target.delivery_status = "DELIVERED";
      return Promise.resolve({});
    }
    return fetch(API_BASE + "/requests/" + id + "/delivered/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code })
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.error || j.message || j.detail || ("bad status " + r.status));
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

  function renderRiderChoice(riders) {
    banner.hidden = !demoMode;
    if (!riders.length) {
      choiceEl.innerHTML = '<div class="empty">No riders in the system yet.</div>';
      return;
    }
    choiceEl.innerHTML = riders.map(function (r) {
      var sel = currentRider && currentRider.rider_id === r.rider_id ? " selected" : "";
      return '<button data-id="' + esc(r.rider_id) + '" class="' + sel.trim() + '">' +
        esc(r.rider_name) + "</button>";
    }).join("");
    var btns = choiceEl.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        var id = Number(this.getAttribute("data-id"));
        loadRiders().then(function (riders) {
          for (var j = 0; j < riders.length; j++) {
            if (riders[j].rider_id === id) currentRider = riders[j];
          }
          myPanel.hidden = false;
          welcome.textContent = "Welcome, " + currentRider.rider_name + ".";
          renderRiderChoice(riders);
          refreshMine();
        });
      });
    }
  }

  function renderMine() {
    if (!myDeliveries.length) {
      myList.innerHTML = '<div class="empty">Nothing assigned to you yet. This list asks again every five seconds.</div>';
      return;
    }

    myList.innerHTML = myDeliveries.map(function (d) {
      var st = (d.delivery_status || "").toLowerCase();
      var actions = "";
      if (st === "assigned" || st === "requested") {
        actions = '<div class="req-actions"><button class="pick-btn" data-id="' + esc(d.request_id) + '">Pick up</button></div>';
      } else if (st === "picked" || st === "picked_up") {
        actions =
          '<div class="req-actions">' +
            '<button class="scan-btn" data-id="' + esc(d.request_id) + '">Scan to confirm</button> ' +
            '<button class="ghost manual-btn" data-id="' + esc(d.request_id) + '">Enter code manually</button>' +
          "</div>" +
          '<div class="scanner-box" id="scanner-' + esc(d.request_id) + '" hidden></div>';
      }
      return (
        '<div class="req-card">' +
          '<div class="request-top">' +
            '<span class="request-ref">' + esc(ref(d)) + "</span>" +
            '<span class="badge ' + statusClass(d.delivery_status) + '">' + esc(statusLabel(d.delivery_status)) + "</span>" +
          "</div>" +
          '<div class="request-who">' + esc(d.customer_name) +
            ' &middot; <a class="tel" href="tel:' + esc(d.customer_phone) + '">' + esc(d.customer_phone) + "</a></div>" +
          '<div class="request-item-desc">' + esc(d.customer_address) + "</div>" +
          '<div class="request-item-desc">' + esc(d.item_description) + "</div>" +
          '<div class="code-card">' +
            '<div id="qr-' + esc(d.request_id) + '"></div>' +
            '<div class="code-text">' + esc(d.confirmation_code || "no code yet") + "</div>" +
            '<div class="code-note">THE CUSTOMER&rsquo;S PROOF CODE &mdash; SCAN IT OR TYPE IT</div>' +
          "</div>" +
          actions +
        "</div>"
      );
    }).join("");

    /* draw QR codes only if the helper library managed to load */
    if (typeof window.QRCode === "function") {
      myDeliveries.forEach(function (d) {
        var el = document.getElementById("qr-" + d.request_id);
        if (el && d.confirmation_code) {
          try { window.QRCode(el, { text: d.confirmation_code, width: 140, height: 140 }); }
          catch (e) { /* text code below still works */ }
        }
      });
    }

    wireButtons();
  }

  function wireButtons() {
    var picks = myList.querySelectorAll(".pick-btn");
    var scans = myList.querySelectorAll(".scan-btn");
    var manuals = myList.querySelectorAll(".manual-btn");
    var i;

    for (i = 0; i < picks.length; i++) {
      picks[i].addEventListener("click", function () {
        var id = Number(this.getAttribute("data-id"));
        errorBox.hidden = true;
        patchPicked(id).then(function () {
          successBox.textContent = "Picked up. The shop can see it.";
          successBox.hidden = false;
          setTimeout(function () { successBox.hidden = true; }, 6000);
          refreshMine();
        }).catch(function (err) {
          errorBox.textContent = "Could not pick up: " + (err.message || err);
          errorBox.hidden = false;
        });
      });
    }

    for (i = 0; i < scans.length; i++) {
      scans[i].addEventListener("click", function () {
        var id = Number(this.getAttribute("data-id"));
        startScan(id);
      });
    }

    for (i = 0; i < manuals.length; i++) {
      manuals[i].addEventListener("click", function () {
        var id = Number(this.getAttribute("data-id"));
        var code = prompt("Enter the confirmation code shown on the delivery:");
        if (code) confirmDelivery(id, code.trim());
      });
    }
  }

  /* ---------- scanning ---------- */

  function startScan(id) {
    errorBox.hidden = true;
    if (typeof window.Html5Qrcode !== "function") {
      errorBox.textContent = "Camera scanning is not available here. Use “Enter code manually”.";
      errorBox.hidden = false;
      return;
    }
    var box = document.getElementById("scanner-" + id);
    if (!box) return;
    box.hidden = false;
    scannerActive = true;
    var scanner = new window.Html5Qrcode("scanner-" + id);
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 200 },
      function (decoded) {
        scanner.stop().catch(function () {});
        scannerActive = false;
        confirmDelivery(id, decoded.trim());
      },
      function () { /* no code in frame yet — keep looking */ }
    ).catch(function (err) {
      scannerActive = false;
      box.hidden = true;
      errorBox.textContent = "Could not open the camera: " + err + " Use “Enter code manually”.";
      errorBox.hidden = false;
    });
  }

  function confirmDelivery(id, code) {
    errorBox.hidden = true;
    patchDelivered(id, code).then(function () {
      successBox.textContent = "Delivered. Proof recorded.";
      successBox.hidden = false;
      setTimeout(function () { successBox.hidden = true; }, 6000);
      refreshMine();
    }).catch(function (err) {
      errorBox.textContent = "Not confirmed: " + (err.message || err);
      errorBox.hidden = false;
    });
  }

  /* ---------- refresh loops ---------- */

  function refreshMine() {
    if (!currentRider) return;
    loadMine(currentRider.rider_id).then(function (data) {
      myDeliveries = data;
      renderMine();
    }).catch(function () {
      myList.innerHTML = '<div class="empty">Could not read your deliveries.</div>';
    });
  }

  loadRiders().then(renderRiderChoice);
  setInterval(function () {
    if (scannerActive) return;   /* never redraw under a live camera */
    if (!currentRider) { loadRiders().then(renderRiderChoice); return; }
    refreshMine();
  }, 5000);
})();
