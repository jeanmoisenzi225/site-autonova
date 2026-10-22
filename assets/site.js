/* Site vitrine d'Autonova Group : menu, coordonnées, horaires du jour et
   envoi du formulaire « Être recontacté » à l'appli (BACKLOG 53, EPIC-15). */
(function () {
  "use strict";
  var config = window.SITE_CONFIG || {};
  var TO_FILL = "[à compléter]";

  /* ---------- Menu (tablette et téléphone) ---------- */
  var toggle = document.querySelector(".menu-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      // Le menu s'ouvre juste sous l'en-tête, où qu'il soit à l'écran.
      var header = document.querySelector(".site-header");
      document.documentElement.style.setProperty("--menu-top", Math.max(0, header.getBoundingClientRect().bottom) + "px");
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) toggle.click();
    });
  }

  /* ---------- Coordonnées, depuis config.js ---------- */
  function digits(phone) {
    var d = String(phone || "").replace(/[^\d]/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    if (d.length === 10) d = "225" + d;
    return d;
  }
  var links = {
    tel: config.phone ? "tel:+" + digits(config.phone) : "",
    whatsapp: config.whatsapp ? "https://wa.me/" + digits(config.whatsapp) : "",
    mail: config.email ? "mailto:" + config.email : "",
    map: config.mapUrl || "",
    app: config.appUrl || "",
  };
  document.querySelectorAll("[data-fill]").forEach(function (el) {
    el.textContent = config[el.getAttribute("data-fill")] || TO_FILL;
  });
  document.querySelectorAll("[data-link]").forEach(function (el) {
    var href = links[el.getAttribute("data-link")];
    // Coordonnée pas encore renseignée : le lien mène à la page Contact.
    el.setAttribute("href", href || "contact.html");
    if (el.getAttribute("data-link") === "whatsapp" || el.getAttribute("data-link") === "map" || el.getAttribute("data-link") === "app") {
      if (href) { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
    }
  });

  /* ---------- Ouvert / fermé (Abidjan = UTC toute l'année) ---------- */
  var status = document.querySelector("[data-open-status]");
  if (status) {
    var now = new Date();
    var day = now.getUTCDay();
    var minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    var open = day !== 0 && minutes >= 8 * 60 && minutes < 18 * 60;
    var label = status.querySelector("[data-open-label]");
    var dot = status.querySelector(".open-dot");
    if (open) {
      label.innerHTML = "<strong>Ouvert</strong> · ferme à 18 h";
    } else {
      var next = day === 6 && minutes >= 18 * 60 ? "lundi à 8 h" : day === 0 ? "demain à 8 h" : minutes < 8 * 60 ? "à 8 h" : "demain à 8 h";
      label.innerHTML = "<strong>Fermé</strong> · ouvre " + next;
      if (dot) dot.classList.add("is-closed");
    }
  }

  /* ---------- Onglets de la page Contact ---------- */
  var tabs = document.querySelectorAll("[data-tab]");
  function showTab(name) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-tab") === name;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
  }
  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { showTab(tab.getAttribute("data-tab")); });
    });
    showTab(location.hash === "#candidature" ? "candidat" : "client");
  }

  /* ---------- Envoi des formulaires ---------- */
  var today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input[type="date"]').forEach(function (el) { el.min = today; });

  function clearErrors(form) {
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".field-error").forEach(function (el) { el.remove(); });
    var box = form.querySelector(".form-error");
    if (box) { box.hidden = true; box.textContent = ""; }
  }

  function showFieldErrors(form, fieldErrors) {
    var first = null;
    Object.keys(fieldErrors || {}).forEach(function (name) {
      var input = form.elements[name === "consent" ? "consent" : name];
      if (!input || !fieldErrors[name] || !fieldErrors[name][0]) return;
      input.setAttribute("aria-invalid", "true");
      var msg = document.createElement("span");
      msg.className = "field-error";
      msg.textContent = fieldErrors[name][0];
      (input.closest(".field") || input.closest(".consent") || input.parentNode).appendChild(msg);
      if (!first) first = input;
    });
    if (first) first.focus();
  }

  document.querySelectorAll("form[data-kind]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors(form);
      var box = form.querySelector(".form-error");
      var data = { kind: form.getAttribute("data-kind") };
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        data[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
      });
      if (!config.apiUrl || !config.garageSlug) {
        box.textContent = "Le formulaire n'est pas encore relié à l'appli. Appelez-nous ou écrivez-nous sur WhatsApp.";
        box.hidden = false;
        return;
      }
      var button = form.querySelector('button[type="submit"]');
      var label = button.textContent;
      button.disabled = true;
      button.textContent = "Envoi en cours…";
      fetch(config.apiUrl.replace(/\/$/, "") + "/api/public/garages/" + encodeURIComponent(config.garageSlug) + "/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
        })
        .then(function (r) {
          if (r.ok) {
            var success = document.getElementById(form.getAttribute("data-success"));
            form.hidden = true;
            if (success) { success.hidden = false; success.focus(); }
            return;
          }
          if (r.status === 400 && r.body.details && r.body.details.fieldErrors) {
            box.textContent = "Vérifiez les champs signalés en rouge.";
            showFieldErrors(form, r.body.details.fieldErrors);
          } else {
            box.textContent = r.body.error || "L'envoi n'a pas abouti. Réessayez dans un instant, ou appelez-nous.";
          }
          box.hidden = false;
        })
        .catch(function () {
          box.textContent = "Pas de connexion au serveur. Vérifiez votre connexion internet et réessayez, ou appelez-nous.";
          box.hidden = false;
        })
        .then(function () {
          button.disabled = false;
          button.textContent = label;
        });
    });
  });

  document.querySelectorAll("[data-again]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var success = btn.closest(".form-success");
      var form = document.querySelector('form[data-success="' + success.id + '"]');
      success.hidden = true;
      form.reset();
      form.hidden = false;
      var first = form.querySelector("input, select, textarea");
      if (first) first.focus();
    });
  });
})();
