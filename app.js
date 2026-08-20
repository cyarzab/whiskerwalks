(() => {
  const appHeader = document.getElementById("appHeader");
  const feedEl = document.getElementById("feed");
  const emptyState = document.getElementById("emptyState");
  const statWalks = document.getElementById("statWalks");
  const statCats = document.getElementById("statCats");
  const statStreak = document.getElementById("statStreak");
  const offlineBanner = document.getElementById("offlineBanner");

  const tabDiary = document.getElementById("tabDiary");
  const tabMap = document.getElementById("tabMap");
  const mapView = document.getElementById("mapView");
  const mapEmpty = document.getElementById("mapEmpty");

  const openFormBtn = document.getElementById("openForm");
  const sheetBackdrop = document.getElementById("sheetBackdrop");
  const entryForm = document.getElementById("entryForm");
  const cancelForm = document.getElementById("cancelForm");

  const photoInput = document.getElementById("photoInput");
  const photoFile = document.getElementById("photoFile");
  const photoPreview = document.getElementById("photoPreview");
  const photoPlaceholder = document.getElementById("photoPlaceholder");

  const catName = document.getElementById("catName");
  const sillyNameBtn = document.getElementById("sillyNameBtn");
  const ratingPicker = document.getElementById("ratingPicker");
  const locationField = document.getElementById("location");
  const useLocationBtn = document.getElementById("useLocation");
  const notesField = document.getElementById("notes");

  const detailBackdrop = document.getElementById("detailBackdrop");
  const detailPhoto = document.getElementById("detailPhoto");
  const detailName = document.getElementById("detailName");
  const detailRating = document.getElementById("detailRating");
  const detailMeta = document.getElementById("detailMeta");
  const detailNotes = document.getElementById("detailNotes");
  const closeDetail = document.getElementById("closeDetail");
  const deleteEntryBtn = document.getElementById("deleteEntry");

  let pendingPhotoBlob = null;
  let currentDetailId = null;
  let currentRating = 0;
  let entries = [];
  let leafletMap = null;
  let mapMarkersLayer = null;

  /* ---------- Header height -> CSS var, for full-screen cards ---------- */
  function syncHeaderHeight() {
    document.documentElement.style.setProperty("--header-h", `${appHeader.offsetHeight}px`);
  }
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("orientationchange", syncHeaderHeight);

  /* ---------- Offline indicator ---------- */
  function updateOnlineStatus() {
    offlineBanner.hidden = navigator.onLine;
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  /* ---------- View tabs: Diary <-> Map ---------- */
  function setView(view) {
    const isMap = view === "map";
    tabDiary.classList.toggle("active", !isMap);
    tabMap.classList.toggle("active", isMap);
    feedEl.hidden = isMap;
    emptyState.hidden = isMap || entries.length > 0;
    mapView.hidden = !isMap;
    if (isMap) {
      requestAnimationFrame(() => {
        initMapIfNeeded();
        renderMapMarkers();
        if (leafletMap) leafletMap.invalidateSize();
      });
    }
  }
  tabDiary.addEventListener("click", () => setView("diary"));
  tabMap.addEventListener("click", () => setView("map"));

  /* ---------- Form sheet open/close ---------- */
  function resetForm() {
    entryForm.reset();
    pendingPhotoBlob = null;
    photoPreview.hidden = true;
    photoPreview.src = "";
    photoPlaceholder.hidden = false;
    currentRating = 0;
    updateRatingPicker();
  }

  openFormBtn.addEventListener("click", () => {
    resetForm();
    sheetBackdrop.hidden = false;
  });

  cancelForm.addEventListener("click", () => {
    sheetBackdrop.hidden = true;
  });

  sheetBackdrop.addEventListener("click", (e) => {
    if (e.target === sheetBackdrop) sheetBackdrop.hidden = true;
  });

  /* ---------- Friendliness rating picker ---------- */
  function updateRatingPicker() {
    [...ratingPicker.children].forEach((btn) => {
      const val = parseInt(btn.dataset.value, 10);
      btn.classList.toggle("selected", val <= currentRating);
    });
  }

  ratingPicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".rating-paw");
    if (!btn) return;
    const val = parseInt(btn.dataset.value, 10);
    // tapping the already-topmost selected paw clears the rating
    currentRating = currentRating === val ? 0 : val;
    updateRatingPicker();
  });

  /* ---------- Silly name generator ---------- */
  const SILLY_ADJECTIVES = [
    "Sir", "Duchess", "Captain", "Baron", "Professor", "Agent", "Doctor",
    "Mayor", "Sergeant", "Lady", "Count", "Chief", "Detective", "General"
  ];
  const SILLY_NAMES = [
    "Whiskerton", "Biscuit", "Mochi", "Noodle", "Pumpernickel", "Sir Fluffington",
    "Beans", "Waffles", "Gravy", "Tater Tot", "Marmalade", "Pickles", "Bandit",
    "Sprinkles", "Muffin", "Chowder", "Doodle", "Pretzel", "Nugget", "Boots"
  ];
  const SILLY_TITLES = [
    "the Magnificent", "of the Alley", "the Fearless", "of Third Street",
    "the Snack Thief", "the Windowsill King", "the Puddle Avoider",
    "of the Neighborhood Watch", "the Unbothered", "the Dramatic"
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateSillyName() {
    const useTitle = Math.random() < 0.55;
    let name = `${pick(SILLY_ADJECTIVES)} ${pick(SILLY_NAMES)}`;
    if (useTitle) name += ` ${pick(SILLY_TITLES)}`;
    return name;
  }

  sillyNameBtn.addEventListener("click", () => {
    catName.value = generateSillyName();
    catName.focus();
  });

  /* ---------- Fun save sound (synthesized, no audio file needed) ---------- */
  let audioCtx = null;
  function playSaveSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();

      const now = audioCtx.currentTime;
      // a bright little two-note "meow-chirp" chime
      const notes = [
        { freq: 660, start: 0, dur: 0.11 },
        { freq: 880, start: 0.09, dur: 0.16 },
      ];
      notes.forEach(({ freq, start, dur }) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + start + dur);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.22, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
    } catch (err) {
      // Web Audio unsupported or blocked — saving still works fine without sound.
    }
  }

  /* ---------- Photo capture + compression ---------- */
  photoInput.addEventListener("click", () => photoFile.click());

  photoFile.addEventListener("change", async () => {
    const file = photoFile.files[0];
    if (!file) return;
    const compressed = await compressImage(file, 1000, 0.8);
    pendingPhotoBlob = compressed;
    photoPreview.src = URL.createObjectURL(compressed);
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
  });

  function compressImage(file, maxDim, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Geolocation ---------- */
  useLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Location isn't available on this device.");
      return;
    }
    useLocationBtn.textContent = "…";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        locationField.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        locationField.dataset.lat = latitude;
        locationField.dataset.lng = longitude;
        useLocationBtn.textContent = "📍";
      },
      () => {
        alert("Couldn't get your location — you can type it in instead.");
        useLocationBtn.textContent = "📍";
      },
      { timeout: 8000 }
    );
  });

  /* ---------- Save entry ---------- */
  entryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const now = Date.now();
    const name = catName.value.trim() || generateSillyName();
    const entry = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      friendliness: currentRating,
      location: locationField.value.trim(),
      lat: locationField.dataset.lat ? parseFloat(locationField.dataset.lat) : null,
      lng: locationField.dataset.lng ? parseFloat(locationField.dataset.lng) : null,
      notes: notesField.value.trim(),
      photo: pendingPhotoBlob || null,
      createdAt: now,
    };
    await CatDB.add(entry);
    sheetBackdrop.hidden = true;
    delete locationField.dataset.lat;
    delete locationField.dataset.lng;
    playSaveSound();
    await loadEntries();
  });

  /* ---------- Rendering ---------- */
  function dayKey(ts) {
    const d = new Date(ts);
    return d.toDateString();
  }

  function formatDayLabel(ts) {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(ts) === dayKey(today.getTime())) return "Today";
    if (dayKey(ts) === dayKey(yesterday.getTime())) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function pawPips(rating, max = 5) {
    let html = "";
    for (let i = 1; i <= max; i++) {
      html += `<span class="paw-pip${i <= rating ? " filled" : ""}">🐾</span>`;
    }
    return html;
  }

  function render(list) {
    feedEl.innerHTML = "";
    emptyState.hidden = list.length > 0 || !mapView.hidden;
    if (list.length === 0) return;

    for (const entry of list) {
      feedEl.appendChild(renderCard(entry));
    }
  }

  function renderCard(entry) {
    const card = document.createElement("div");
    card.className = "entry-card";
    card.addEventListener("click", () => openDetail(entry));

    const photoWrap = document.createElement("div");
    photoWrap.className = "entry-photo-wrap" + (entry.photo ? "" : " no-photo");
    if (entry.photo) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(entry.photo);
      img.alt = entry.name;
      photoWrap.appendChild(img);
    } else {
      photoWrap.textContent = "🐱";
    }

    const dayBadge = document.createElement("div");
    dayBadge.className = "entry-day-badge";
    dayBadge.innerHTML = `<span>🐾</span><span>${formatDayLabel(entry.createdAt)}</span>`;

    const info = document.createElement("div");
    info.className = "entry-info";
    info.innerHTML = `
      <p class="entry-name">${escapeHTML(entry.name)}</p>
      ${entry.friendliness ? `<div class="entry-rating">${pawPips(entry.friendliness)}</div>` : ""}
      ${entry.location ? `<p class="entry-loc">${escapeHTML(entry.location)}</p>` : ""}
      <p class="entry-time">${formatTime(entry.createdAt)}</p>
    `;

    card.appendChild(photoWrap);
    card.appendChild(dayBadge);
    card.appendChild(info);
    return card;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------- Detail sheet ---------- */
  function openDetail(entry) {
    currentDetailId = entry.id;
    if (entry.photo) {
      detailPhoto.src = URL.createObjectURL(entry.photo);
      detailPhoto.hidden = false;
    } else {
      detailPhoto.hidden = true;
    }
    detailName.textContent = entry.name;
    detailRating.innerHTML = entry.friendliness ? pawPips(entry.friendliness) : "";
    detailMeta.textContent = [formatDayLabel(entry.createdAt), formatTime(entry.createdAt), entry.location]
      .filter(Boolean)
      .join(" · ");
    detailNotes.textContent = entry.notes || "No notes for this one.";
    detailBackdrop.hidden = false;
  }

  closeDetail.addEventListener("click", () => { detailBackdrop.hidden = true; });
  detailBackdrop.addEventListener("click", (e) => {
    if (e.target === detailBackdrop) detailBackdrop.hidden = true;
  });

  deleteEntryBtn.addEventListener("click", async () => {
    if (!currentDetailId) return;
    if (confirm("Delete this sighting? This can't be undone.")) {
      await CatDB.delete(currentDetailId);
      detailBackdrop.hidden = true;
      await loadEntries();
    }
  });

  /* ---------- Map of all cat sightings ---------- */
  function initMapIfNeeded() {
    if (leafletMap || typeof L === "undefined") return;
    leafletMap = L.map("mapCanvas", { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(leafletMap);
    mapMarkersLayer = L.layerGroup().addTo(leafletMap);
  }

  function pawDivIcon() {
    return L.divIcon({
      className: "",
      html: '<div class="paw-marker">🐾</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14],
    });
  }

  function renderMapMarkers() {
    if (!leafletMap || !mapMarkersLayer) return;
    mapMarkersLayer.clearLayers();

    const located = entries.filter((e) => typeof e.lat === "number" && typeof e.lng === "number");
    mapEmpty.hidden = located.length > 0;

    if (located.length === 0) return;

    const bounds = [];
    for (const entry of located) {
      const marker = L.marker([entry.lat, entry.lng], { icon: pawDivIcon() });
      const ratingStr = entry.friendliness ? pawPips(entry.friendliness) : "";
      marker.bindPopup(
        `<strong>${escapeHTML(entry.name)}</strong><br>${ratingStr}<br>${escapeHTML(entry.location || "")}`
      );
      marker.addTo(mapMarkersLayer);
      bounds.push([entry.lat, entry.lng]);
    }
    if (bounds.length === 1) {
      leafletMap.setView(bounds[0], 14);
    } else {
      leafletMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  /* ---------- Stats ---------- */
  function computeStats(list) {
    const days = new Set(list.map((e) => dayKey(e.createdAt)));
    const cats = new Set(list.map((e) => e.name.trim().toLowerCase()).filter(Boolean));

    // streak: consecutive days ending today or yesterday
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // if no walk today, streak can still count from yesterday backward
    if (!days.has(dayKey(cursor.getTime()))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (days.has(dayKey(cursor.getTime()))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return { walks: days.size, cats: cats.size, streak };
  }

  function updateStats(list) {
    const { walks, cats, streak } = computeStats(list);
    statWalks.textContent = walks;
    statCats.textContent = cats;
    statStreak.textContent = streak;
  }

  /* ---------- Load ---------- */
  async function loadEntries() {
    entries = await CatDB.getAll();
    render(entries);
    updateStats(entries);
    if (!mapView.hidden) renderMapMarkers();
  }

  syncHeaderHeight();
  loadEntries();

  /* ---------- Service worker ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
