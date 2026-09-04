/* =====================================================================
   RETAILER.JS — the only script on the retailer page.

   Plain words, once: the backend is a back office. Your page never walks
   into it. It stands at the counter and asks for things or hands things
   over. That counter is what people call "the API", and each named counter
   is an "endpoint". This file is the person walking to the counter.

   ---------------------------------------------------------------------
   ANNE'S ENDPOINTS GO HERE.
   When Anne sends the endpoints, change ONLY the next two lines.
   --------------------------------------------------------------------- */
var ENDPOINT_LIST   = "http://127.0.0.1:8000/api/requests/mine/";    /* the ask-for-the-list counter */
var ENDPOINT_CREATE = "http://127.0.0.1:8000/api/requests/create/";  /* the hand-over counter */
/* Relative on purpose: no computer name, no port number. The page asks
   the place that served it. That works on Anne's localhost today and on
   the deployed address later, with nothing to change, and it removes the
   browser's same-place problem whenever Django serves this page. */

/* ---------------------------------------------------------------------
   FIELD NAMES.
   The left side is what Anne's backend expects. If she says her backend
   wants different names, change the right-hand quotes only.
   --------------------------------------------------------------------- */
var FIELD_NAMES = {
  backend_customer_name:  "customer_name",
  backend_customer_phone: "customer_phone",
  backend_address:        "customer_address",   /* Anne's name for the address */
  backend_item:           "item_description"
};

/* =====================================================================
   Everything below this line just works. You never need to edit it.
   ===================================================================== */

(function () {
  var listEl = document.getElementById("request-list");
  var banner = document.getElementById("demo-banner");
  var form = document.getElementById("request-form");
  var successBox = document.getElementById("success-box");
  var errorEl = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-btn");

  /* ---------- honest demo fallback ----------
   * If the backend cannot be reached (double-clicking the file, backend
   * switched off), the page stores labelled practice records in the
   * browser and shows the amber stripe. The moment a real backend answers,
   * the stripe hides itself. Nothing here ever pretends to be live data.
   */
  var DEMO_KEY = "reflex_demo_deliveries";
  var demoMode = false;

  function seed() {
    return [
      { id: 2, reference: "RFX-000002", customer_name: "Grace Njeri",
        customer_phone: "+254733555666", address: "Thika, Section 9, Block C Flat 12",
        item_description: "Two boxes of Amoxil 500mg, pharmacy order",
        status: "pending", created_at: new Date(Date.now() - 25 * 60000).toISOString() },
      { id: 1, reference: "RFX-000001", customer_name: "Peter Otieno",
        customer_phone: "+254722333444", address: "Ruai, Kangundo Road, House 45B",
        item_description: "Samsung 43 inch TV, one carton, sealed",
        status: "assigned", created_at: new Date(Date.now() - 90 * 60000).toISOString() }
    ];
  }

  function readDemo() {
    try {
      var raw = localStorage.getItem(DEMO_KEY);
      if (!raw) { localStorage.setItem(DEMO_KEY, JSON.stringify(seed())); return seed(); }
      return JSON.parse(raw);
    } catch (e) { return seed(); }
  }

  function writeDemo(list) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function nextRef(list) {
    var max = 0;
    for (var i = 0; i < list.length; i++) {
      var m = /(\d+)$/.exec(list[i].reference || "");
      if (m && parseInt(m[1], 10) > max) max = parseInt(m[1], 10);
    }
    return "RFX-" + ("000000" + (max + 1)).slice(-6);
  }

  /* ---------- the two walks to the counter ---------- */

  function fetchList() {
    return fetch(ENDPOINT_LIST, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json();
      })
      .then(function (data) {
        demoMode = false;
        return Array.isArray(data) ? data : (data.results || data.deliveries || []);
      })
      .catch(function () {
        demoMode = true;
        return readDemo();
      });
  }

  function fetchCreate(fields) {
    var payload = {};
    payload[FIELD_NAMES.backend_customer_name]  = fields.customer_name;
    payload[FIELD_NAMES.backend_customer_phone] = fields.customer_phone;
    payload[FIELD_NAMES.backend_address]        = fields.address;
    payload[FIELD_NAMES.backend_item]           = fields.item_description;
    payload["delivery_status"]                  = "pending";  /* Anne asked for this; new = pending */

    return fetch(ENDPOINT_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var message = j.message || j.error || j.detail;
          if (!message) {
            Object.keys(j).some(function (key) {
              if (Array.isArray(j[key]) && j[key].length) {
                message = key + ": " + j[key][0];
                return true;
              }
              return false;
            });
          }
          var error = new Error(message || ("bad status " + r.status));
          error.httpStatus = r.status;
          throw error;
        });
      }
      demoMode = false;
      return r.json();
    }).catch(function (error) {
      /* A response from the API (including a 400 validation error) is real
       * feedback, not an offline failure. Show it instead of creating a
       * misleading demo request. */
      if (error && error.httpStatus) throw error;
      demoMode = true;
      var list = readDemo();
      var row = {
        id: Date.now(),
        reference: nextRef(list),
        customer_name: fields.customer_name,
        customer_phone: fields.customer_phone,
        address: fields.address,
        item_description: fields.item_description,
        status: "pending",
        created_at: new Date().toISOString()
      };
      list.unshift(row);
      writeDemo(list);
      return row;
    });
  }

  /* ---------- drawing the page ---------- */

  function esc(value) {
    var d = document.createElement("div");
    d.textContent = value == null ? "" : String(value);
    return d.innerHTML;
  }

  function when(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

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

  function render(items) {
    banner.hidden = !demoMode;

    if (!items || items.length === 0) {
      listEl.innerHTML = '<div class="empty">Nothing in the record yet. Log the first delivery on the left.</div>';
      return;
    }

    listEl.innerHTML = items.map(function (d) {
      return (
        '<div class="request-item">' +
          '<div class="request-top">' +
            '<span class="request-ref">' + esc(d.reference || ("#" + d.id)) + "</span>" +
            '<span class="badge ' + statusClass(d.status) + '">' + esc(statusLabel(d.status)) + "</span>" +
          "</div>" +
          '<div class="request-who">' + esc(d.customer_name) + " &middot; " + esc(d.address) + "</div>" +
          '<div class="request-item-desc">' + esc(d.item_description) + "</div>" +
          '<div class="request-when">LOGGED ' + esc(when(d.created_at)) + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function refresh() {
    fetchList().then(render).catch(function () {
      listEl.innerHTML = '<div class="empty">Could not read the record.</div>';
    });
  }

  /* ---------- the one clickable thing ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    successBox.hidden = true;

    var fields = {
      customer_name: form.customer_name.value.trim(),
      customer_phone: form.customer_phone.value.trim(),
      address: form.address.value.trim(),
      item_description: form.item_description.value.trim()
    };

    var missing = [];
    if (!fields.customer_name) missing.push("customer name");
    if (!fields.customer_phone) missing.push("customer phone");
    if (!fields.address) missing.push("drop-off address");
    if (!fields.item_description) missing.push("what is in the box");
    if (missing.length) {
      errorEl.textContent = "Fill in: " + missing.join(", ") + ".";
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging…";

    fetchCreate(fields).then(function (row) {
      form.reset();
      var ref = row && row.reference ? " " + row.reference : "";
      var st0 = row && (row.status || row.delivery_status);
      successBox.textContent =
        "Logged." + ref + " Status: " + statusLabel(st0) +
        ". It stays Pending until a dispatcher assigns a rider.";
      successBox.hidden = false;
      setTimeout(function () { successBox.hidden = true; }, 8000);
      refresh();
    }).catch(function (err) {
      errorEl.textContent = "Could not log it: " + (err.message || err);
      errorEl.hidden = false;
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log it";
    });
  });

  refresh();
  setInterval(refresh, 5000);   /* the list asks again every 5 seconds, so statuses move by themselves */
})();
