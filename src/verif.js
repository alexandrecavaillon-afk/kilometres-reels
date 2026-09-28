
/* =====================================================================
   Vérification des affectations médecins ↔ établissements
   ===================================================================== */
const VCOL = {ok:"#34c759", bad:"#ff9500", nv:"#8e8e93", doc:"#0071e3", etab:"#ff3b30", prop:"#34c759"};
const V = {file:"", rows:[], docs:[], dPlaces:[], ePlaces:[], M:null, tab:"trajets", filter:"bad", selDoc:null, open:null,
  metric:"time", capMode:"same", capN:2, tolPct:15, tolKm:5, tolPctMin:20, tolMin:8, ready:false, statusCol:false};
let IMPORT_TARGET = "multi";

/* ---------- Import et choix des colonnes ---------- */
const VROLES = [
  {id:"etabLoc", label:"Établissement : code postal ou adresse", req:true,
    re:/(établissement|etablissement|ehpad|client|structure|site|clinique|hôpital|hopital)/i, need:/(cp|code|postal|adresse|ville|commune|localisation|lieu)/i},
  {id:"etabName", label:"Établissement : nom", re:/(établissement|etablissement|ehpad|client|structure|raison sociale)/i, not:/(cp|code|postal|adresse|ville|commune|localisation|lieu|statut)/i},
  {id:"docLoc", label:"Médecin : code postal ou adresse", req:true,
    re:/(médecin|medecin|praticien|docteur|dr\b|intervenant)/i, need:/(cp|code|postal|adresse|ville|commune|localisation|lieu)/i},
  {id:"docName", label:"Médecin : nom", re:/(médecin|medecin|praticien|docteur|intervenant)/i, not:/(cp|code|postal|adresse|ville|commune|localisation|lieu)/i},
  {id:"km", label:"Distance déclarée (km)", re:/(distance|km|kilom)/i, not:/(vol|oiseau)/i},
  {id:"min", label:"Temps déclaré (min)", re:/(temps|durée|duree|minutes|\bmin\b)/i, not:/(moyen)/i},
  {id:"status", label:"Statut", re:/(statut|status|étape|etape|stade)/i},
];
function findHeaderRow(rows){
  let best = -1, bestScore = 0;
  for (let r = 0; r < Math.min(rows.length, 40); r++){
    const cells = rows[r].filter(Boolean);
    const kw = cells.filter(h => /(cp|code|postal|adresse|médecin|medecin|praticien|établissement|etablissement|ehpad|client|distance|temps|durée|statut|km)/i.test(h) && !/^[\d.,\s]+$/.test(h)).length;
    const txt = cells.filter(h => /[a-zà-ÿ]{3}/i.test(h)).length;
    if (kw >= 2 && kw * 3 + txt > bestScore){ best = r; bestScore = kw * 3 + txt; }
  }
  return best;
}
let VM = null;
function openVerifMapper(sheets, title){
  sheets = sheets.map(cleanSheet).filter(s => s.rows.length);
  if (!sheets.length) throw new Error("le fichier ne contient aucune donnée");
  const vis = sheets.filter(s => !s.hidden); if (vis.length) sheets = vis;
  VM = {sheets, title, si:0, map:{}};
  $("#vSheetSel").innerHTML = sheets.map((s, k) => `<option value="${k}">${esc(s.name)} (${s.rows.length} lignes)</option>`).join("");
  $("#vSheetRow").classList.toggle("hidden", sheets.length < 2);
  vLoadSheet(0);
  $("#vMapper").classList.remove("hidden");
}
function vLoadSheet(si){
  VM.si = si;
  const s = VM.sheets[si];
  VM.hr = findHeaderRow(s.rows);
  const H = VM.hr >= 0 ? s.rows[VM.hr] : null;
  VM.map = {};
  const used = new Set();
  for (const role of VROLES){
    let k = -1;
    if (H) k = H.findIndex((h, j) => h && !used.has(j) && role.re.test(h) && (!role.need || role.need.test(h)) && (!role.not || !role.not.test(h)));
    VM.map[role.id] = k;
    if (k >= 0) used.add(k);
  }
  if (!H){ // pas de titres : deux premières colonnes = établissement puis médecin
    VM.map.etabLoc = 0; VM.map.docLoc = s.letters.length > 1 ? 1 : -1;
  }
  vRenderMapper();
}
function vRenderMapper(){
  const s = VM.sheets[VM.si], H = VM.hr >= 0 ? s.rows[VM.hr] : null, ex = s.rows[VM.hr + 1] || [];
  const lab = k => H && H[k] ? `${s.letters[k]} · ${H[k]}` : `Colonne ${s.letters[k]}` + (ex[k] ? ` (ex. ${ex[k].slice(0, 24)})` : "");
  $("#vRoles").innerHTML = VROLES.map(r => `<div class="f"><label class="l" for="vr_${r.id}">${esc(r.label)}${r.req ? "" : " · facultatif"}</label>
    <select id="vr_${r.id}" data-role="${r.id}"><option value="-1">${r.req ? "Choisir une colonne" : "Aucune"}</option>${s.letters.map((_, k) => `<option value="${k}"${VM.map[r.id] === k ? " selected" : ""}>${esc(lab(k))}</option>`).join("")}</select></div>`).join("");
  vUpdateMapper();
}
function vExtract(){
  const s = VM.sheets[VM.si], data = s.rows.slice(VM.hr + 1), m = VM.map;
  const val = (r, id) => m[id] >= 0 ? (r[m[id]] || "").trim() : "";
  const pad = v => scopeHasFR() && /^\d{4}$/.test(v) ? "0" + v : v;
  const num = v => { if (!v) return null; const n = parseFloat(String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : null; };
  return data.map(r => ({etabQ:pad(val(r, "etabLoc")), etabName:val(r, "etabName"), docQ:pad(val(r, "docLoc")), docName:val(r, "docName"),
    km:num(val(r, "km")), min:num(val(r, "min")), status:val(r, "status")})).filter(x => x.etabQ && x.docQ);
}
function vUpdateMapper(){
  const ok = VM.map.etabLoc >= 0 && VM.map.docLoc >= 0;
  const rows = ok ? vExtract() : [];
  $("#vMapTitle").textContent = `${VM.title} : ${plural(rows.length, "affectation")}`;
  $("#vPrev").innerHTML = rows.slice(0, 3).map(r => `<li><b>${esc(r.etabName || r.etabQ)}</b> ← ${esc(r.docName || r.docQ)}${r.km != null ? ` · ${nf1.format(r.km)} km` : ""}${r.min != null ? ` · ${Math.round(r.min)} min` : ""}</li>`).join("") + (rows.length > 3 ? `<li>et ${rows.length - 3} autres</li>` : "");
  $("#vGo").disabled = !rows.length;
  $("#vGo").textContent = !ok ? "Indiquez les colonnes de localisation" : rows.length ? `Vérifier ${plural(rows.length, "affectation")}` : "Aucune ligne exploitable";
}
function openVerif(){ IMPORT_TARGET = "verif"; showImportMsg(""); openSheet("#verifSheet"); }

/* ---------- Calcul ---------- */
async function runVerif(){
  const rows = vExtract();
  if (!rows.length) return;
  closeSheet("#verifSheet");
  if (S.busy){ S.abort = true; while (S.busy) await sleep(50); }
  S.abort = false; S.mode = "verif"; S.open = null;
  V.file = VM.title; V.ready = false; V.selDoc = null; V.open = null; V.tab = "trajets"; V.filter = "bad";
  V.statusCol = VM.map.status >= 0;
  V.rows = rows.map((r, i) => ({...r, i, eLabel:r.etabName || "Établissement " + r.etabQ, dId:(r.docName ? r.docName + "|" : "") + r.docQ, dLabel:r.docName || "Médecin " + r.docQ}));
  showExplore(); layerRoute.clearLayers(); layerPts.clearLayers();
  $("#list").innerHTML = ""; $("#footInfo").textContent = "";
  setBusy(true);
  try {
    // 1. Localisation des codes postaux / adresses
    const qs = [...new Set(V.rows.flatMap(r => [r.etabQ, r.docQ]))];
    const place = new Map();
    let done = 0, next = 0;
    const worker = async () => {
      while (next < qs.length && !S.abort){
        const q = qs[next++];
        try { place.set(q, await geocode(q)); } catch (e){ place.set(q, null); }
        done++; setStatus(`Localisation : ${done} sur ${qs.length}`, done, qs.length);
      }
    };
    await Promise.all(Array.from({length:6}, worker));
    if (S.abort){ setStatus("Calcul arrêté."); return; }
    V.rows.forEach(r => { r.ePt = place.get(r.etabQ) || null; r.dPt = place.get(r.docQ) || null; });
    // 2. Médecins
    const docs = new Map();
    V.rows.forEach(r => {
      if (!docs.has(r.dId)) docs.set(r.dId, {id:r.dId, label:r.dLabel, q:r.docQ, pt:r.dPt, rows:[]});
      docs.get(r.dId).rows.push(r);
    });
    V.docs = [...docs.values()];
    // 3. Matrice des temps et distances (lieux uniques)
    V.dPlaces = [...new Set(V.docs.filter(d => d.pt).map(d => d.q))];
    V.ePlaces = [...new Set(V.rows.filter(r => r.ePt).map(r => r.etabQ))];
    const dIdx = new Map(V.dPlaces.map((q, k) => [q, k])), eIdx = new Map(V.ePlaces.map((q, k) => [q, k]));
    V.docs.forEach(d => { d.pi = d.pt ? dIdx.get(d.q) : -1; });
    V.rows.forEach(r => { r.ei = r.ePt ? eIdx.get(r.etabQ) : -1; r.di = r.dPt ? dIdx.get(r.docQ) : -1; });
    const nD = V.dPlaces.length, nE = V.ePlaces.length;
    const T = Array.from({length:nD}, () => new Float64Array(nE).fill(NaN));
    const D = Array.from({length:nD}, () => new Float64Array(nE).fill(NaN));
    const SD = 25, SE = 74, jobs = [];
    for (let a = 0; a < nD; a += SD) for (let b = 0; b < nE; b += SE) jobs.push([a, Math.min(nD, a + SD), b, Math.min(nE, b + SE)]);
    const pt = q => place.get(q);
    for (let k = 0; k < jobs.length; k++){
      if (S.abort){ setStatus("Calcul arrêté."); return; }
      setStatus(`Calcul des trajets par la route : ${k + 1} sur ${jobs.length}`, k, jobs.length);
      const [a0, a1, b0, b1] = jobs[k];
      const src = V.dPlaces.slice(a0, a1), dst = V.ePlaces.slice(b0, b1);
      const coords = [...src, ...dst].map(q => cstr(pt(q))).join(";");
      const r = await osrm(`/table/v1/driving/${coords}?sources=${src.map((_, i) => i).join(";")}&destinations=${dst.map((_, i) => src.length + i).join(";")}&annotations=distance,duration`);
      for (let i = 0; i < src.length; i++) for (let j = 0; j < dst.length; j++){
        const t = r.durations[i][j], d = r.distances[i][j];
        T[a0 + i][b0 + j] = t == null ? NaN : t; D[a0 + i][b0 + j] = d == null ? NaN : d;
      }
    }
    V.M = {T, D};
    setStatus("Analyse des affectations…");
    await sleep(30);
    vCompute();
    V.ready = true;
    setStatus("");
    vRender(); drawMap();
  } catch (e){
    setStatus("La vérification n'a pas abouti : " + e.message + ". Réessayez dans un instant.", null, null, true);
  } finally { setBusy(false); }
}

const vCost = (di, ei, metric = V.metric) => { if (di < 0 || ei < 0) return NaN; return (metric === "time" ? V.M.T : V.M.D)[di][ei]; };
function vCompute(){
  // Contrôle de chaque trajet
  for (const r of V.rows){
    r.newKm = r.newMin = null; r.why = "";
    if (!r.ePt || !r.dPt){ r.res = "nv"; r.why = "Localisation introuvable : " + [!r.ePt && r.etabQ, !r.dPt && r.docQ].filter(Boolean).join(", ") + (/^\d{5}$/.test(!r.ePt ? r.etabQ : r.docQ) ? " (code CEDEX ?)" : ""); continue; }
    const t = V.M.T[r.di][r.ei], d = V.M.D[r.di][r.ei];
    if (isNaN(t)){ r.res = "nv"; r.why = "Aucun itinéraire par la route"; continue; }
    r.newKm = d / 1000; r.newMin = t / 60;
    if (crow(r.ePt, r.dPt) < 1000){ r.res = "nv"; r.why = "Même commune : non vérifiable avec le seul code postal"; continue; }
    const issues = [];
    if (r.km != null){ const dk = r.newKm - r.km; if (Math.abs(dk) > V.tolKm && Math.abs(dk) > r.km * V.tolPct / 100) issues.push(`distance ${dk > 0 ? "+" : "−"}${nf1.format(Math.abs(dk))} km`); }
    if (r.min != null){ const dm = r.newMin - r.min; if (Math.abs(dm) > V.tolMin && Math.abs(dm) > r.min * V.tolPctMin / 100) issues.push(`temps ${dm > 0 ? "+" : "−"}${Math.round(Math.abs(dm))} min`); }
    if (r.km == null && r.min == null){ r.res = "ok"; r.why = "Recalculé (pas de valeur déclarée)"; }
    else if (issues.length){ r.res = "bad"; r.why = "Écart : " + issues.join(", "); }
    else { r.res = "ok"; r.why = "Conforme"; }
  }
  // Médecin le plus proche (sans contrainte)
  const docsOk = V.docs.filter(d => d.pi >= 0);
  for (const r of V.rows){
    r.best = null; r.curCost = vCost(r.di, r.ei);
    if (r.ei < 0) continue;
    let b = null, bc = Infinity;
    for (const d of docsOk){ const c = vCost(d.pi, r.ei); if (!isNaN(c) && c < bc){ bc = c; b = d; } }
    r.best = b; r.bestCost = bc;
  }
  // Réaffectation optimale (méthode hongroise) avec capacité par médecin
  V.optMsg = "";
  const act = V.rows.filter(r => r.ei >= 0 && r.dPt);
  const cap = new Map(docsOk.map(d => [d.id, 0]));
  if (V.capMode === "same") act.forEach(r => cap.set(r.dId, (cap.get(r.dId) || 0) + 1));
  else docsOk.forEach(d => cap.set(d.id, V.capN));
  let total = 0; cap.forEach(v => { total += v; });
  if (total < act.length){ V.optMsg = `Capacité insuffisante : ${docsOk.length} médecins × ${V.capN} = ${total} places pour ${act.length} établissements. Réglage « même charge qu'aujourd'hui » utilisé.`; act.forEach(r => cap.set(r.dId, 0)); docsOk.forEach(d => cap.set(d.id, 0)); act.forEach(r => cap.set(r.dId, cap.get(r.dId) + 1)); }
  const slots = [];
  docsOk.forEach(d => { for (let k = 0; k < (cap.get(d.id) || 0); k++) slots.push(d); });
  V.rows.forEach(r => { r.prop = null; r.propCost = NaN; });
  if (act.length && slots.length >= act.length){
    const BIG = 1e7;
    const a = act.map(r => { const row = new Float64Array(slots.length); slots.forEach((d, j) => { const c = vCost(d.pi, r.ei); row[j] = isNaN(c) ? BIG : c; }); return row; });
    const ans = hungarian(a);
    act.forEach((r, k) => { const d = slots[ans[k]]; r.prop = d; r.propCost = vCost(d.pi, r.ei); });
  }
  const sum = f => V.rows.reduce((s, r) => s + (isNaN(f(r)) ? 0 : f(r)), 0);
  V.totCur = sum(r => r.prop ? r.curCost : NaN);
  V.totOpt = sum(r => r.prop ? r.propCost : NaN);
  V.changes = V.rows.filter(r => r.prop && r.prop.id !== r.dId).sort((x, y) => (y.curCost - y.propCost) - (x.curCost - x.propCost));
  V.closer = V.rows.filter(r => r.best && r.best.id !== r.dId && r.best.pi !== r.di && r.curCost - r.bestCost > (V.metric === "time" ? 300 : 5000));
  V.docs.forEach(d => { d.tot = d.rows.reduce((s, r) => s + (isNaN(r.curCost) ? 0 : r.curCost), 0); d.max = Math.max(0, ...d.rows.map(r => isNaN(r.curCost) ? 0 : r.curCost)); });
}
function hungarian(a){
  const n = a.length, m = a[0].length, INF = 1e18;
  const u = new Float64Array(n + 1), v = new Float64Array(m + 1), p = new Int32Array(m + 1), way = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++){
    p[0] = i; let j0 = 0;
    const minv = new Float64Array(m + 1).fill(INF), used = new Uint8Array(m + 1);
    do {
      used[j0] = 1; const i0 = p[j0], ai = a[i0 - 1]; let delta = INF, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]){
        const cur = ai[j - 1] - u[i0] - v[j];
        if (cur < minv[j]){ minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta){ delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++){ if (used[j]){ u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const ans = new Int32Array(n);
  for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
  return ans;
}

/* ---------- Affichage ---------- */
const vFmt = (c, metric = V.metric) => isNaN(c) || c == null ? "—" : metric === "time" ? dur(c) : km(c);
const vFmtBoth = r => r.newKm == null ? "—" : `${km(r.newKm * 1000)} · ${dur(r.newMin * 60)}`;
const hours = s => { const h = s / 3600; return h >= 10 ? nf0.format(Math.round(h)) + " h" : nf1.format(h) + " h"; };
function vCounts(){ const c = {ok:0, bad:0, nv:0}; V.rows.forEach(r => { c[r.res]++; }); return c; }
function vRender(){
  if (!V.ready) return;
  const c = vCounts();
  $("#vFile").textContent = V.file;
  const gain = V.totCur - V.totOpt, unit = V.metric === "time" ? hours : m => nf0.format(Math.round(m / 1000)) + " km";
  $("#vStats").innerHTML = `<div class="vtile ok"><b>${c.ok}</b><span>trajets conformes</span></div><div class="vtile bad"><b>${c.bad}</b><span>écarts</span></div><div class="vtile nv"><b>${c.nv}</b><span>non vérifiables</span></div>`
    + `<div class="vtile gain"><b>${gain > 0 ? "−" + unit(gain) : "0"}</b><span>${V.metric === "time" ? "de trajet" : "parcourus"} avec ${V.changes.length} réaffectations</span></div>`;
  $$("#vTabs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === V.tab)));
  const L0 = $("#list");
  if (V.tab === "trajets"){
    const list = V.rows.filter(r => V.filter === "all" || r.res === V.filter);
    L0.innerHTML = `<li class="vfilter"><div class="seg" id="vFilter">${[["bad", "Écarts", c.bad], ["ok", "Conformes", c.ok], ["nv", "Non vérifiables", c.nv], ["all", "Tous", V.rows.length]].map(([k, l, n]) => `<button type="button" data-f="${k}" aria-pressed="${V.filter === k}">${l} ${n}</button>`).join("")}</div></li>`
      + list.map(vRowHTML).join("") + (list.length ? "" : `<li class="empty">Aucune ligne.</li>`);
  } else if (V.tab === "medecins"){
    const docs = V.docs.slice().sort((a, b) => b.max - a.max);
    L0.innerHTML = `<li class="hint" style="list-style:none;margin:8px 10px">Classés du trajet le plus long au plus court. Cliquez sur un médecin pour voir ses établissements et les plus proches de lui.</li>` + docs.map(vDocHTML).join("");
  } else {
    L0.innerHTML = `<li class="vsum">${V.optMsg ? `<p class="warn">${esc(V.optMsg)}</p>` : ""}
      <p><b>${V.changes.length} réaffectations</b> proposées, ${V.capMode === "same" ? "en gardant le même nombre d'établissements par médecin" : `avec au plus ${V.capN} établissements par médecin`}.</p>
      <p>${V.metric === "time" ? "Temps" : "Distance"} total aller : <b>${V.metric === "time" ? hours(V.totCur) : km(V.totCur)}</b> aujourd'hui → <b>${V.metric === "time" ? hours(V.totOpt) : km(V.totOpt)}</b> (${V.totCur > 0 ? "−" + Math.round((1 - V.totOpt / V.totCur) * 100) + " %" : "—"}).</p>
      <p class="hint">${V.closer.length} établissements ont un autre médecin plus proche que le leur (écart de plus de ${V.metric === "time" ? "5 min" : "5 km"}).</p></li>`
      + V.changes.map(vPropHTML).join("") + (V.changes.length ? "" : `<li class="empty">Les affectations actuelles sont déjà les meilleures possibles avec ce réglage.</li>`);
  }
  $("#footInfo").textContent = `${plural(V.rows.length, "affectation")} · ${plural(V.docs.length, "médecin")}`;
  setBusy(S.busy);
  if (V.open != null) vFillRow();
  if (V.selDoc) vFillDoc();
}
function vBadge(res){ return `<span class="vdot" style="background:${VCOL[res]}"></span>`; }
function vRowHTML(r){
  const open = V.open === r.i;
  return `<li class="item${open ? " open" : ""}" data-vi="${r.i}"><button type="button" aria-expanded="${open}">
    ${vBadge(r.res)}
    <span class="who"><b>${esc(r.eLabel)}</b><small>${V.statusCol && r.status ? `<span class="badge">${esc(r.status)}</span>` : ""}${esc(r.dLabel)} · déclaré ${r.km != null ? nf1.format(r.km) + " km" : "—"} · ${r.min != null ? Math.round(r.min) + " min" : "—"}</small></span>
    <span class="fig"><span class="big">${r.newKm == null ? "—" : km(r.newKm * 1000)}</span><span class="sm">${r.newMin == null ? "" : dur(r.newMin * 60)}</span></span></button>${open ? `<div class="det" id="vdet"></div>` : ""}</li>`;
}
function vFillRow(){
  const r = V.rows[V.open], box = $("#vdet"); if (!r || !box) return;
  const bestTxt = r.best ? (r.best.id === r.dId || r.best.pi === r.di ? "C'est déjà le médecin le plus proche." : `Plus proche : <b>${esc(r.best.label)}</b>, ${vFmt(r.bestCost)} (au lieu de ${vFmt(r.curCost)}).`) : "";
  const propTxt = r.prop && r.prop.id !== r.dId ? `Réaffectation proposée : <b>${esc(r.prop.label)}</b>, ${vFmt(r.propCost)}.` : "";
  box.innerHTML = `<p style="color:${r.res === "bad" ? "var(--warn)" : "var(--muted)"}">${esc(r.why)}</p>
    ${r.newKm != null ? `<p>Recalculé : ${vFmtBoth(r)} (itinéraire le plus rapide, sans trafic)</p>` : ""}
    <p>${[r.ePt && esc(r.ePt.label), r.dPt && esc(r.dPt.label)].filter(Boolean).join(" ← ")}</p>
    ${bestTxt ? `<p>${bestTxt}</p>` : ""}${propTxt ? `<p>${propTxt}</p>` : ""}
    ${r.ePt && r.dPt ? `<div class="btns"><button class="btn sec" type="button" data-route="${r.i}">Voir le trajet</button></div>` : ""}`;
}
function vDocHTML(d){
  const sel = V.selDoc === d.id;
  const worst = d.rows.some(r => r.best && r.best.id !== d.id && r.best.pi !== d.pi && r.curCost - r.bestCost > 300);
  return `<li class="item${sel ? " open" : ""}" data-vd="${esc(d.id)}"><button type="button" aria-expanded="${sel}">
    <span class="rk" style="background:${VCOL.doc}">${d.rows.length}</span>
    <span class="who"><b>${esc(d.label)}</b><small>${d.pt ? esc(d.pt.label) : "localisation introuvable"}${worst ? ` · <span style="color:var(--warn)">un établissement a un médecin plus proche</span>` : ""}</small></span>
    <span class="fig"><span class="big">${vFmt(d.max)}</span><span class="sm">le plus loin</span></span></button>${sel ? `<div class="det" id="vddet"></div>` : ""}</li>`;
}
function vFillDoc(){
  const d = V.docs.find(x => x.id === V.selDoc), box = $("#vddet"); if (!d || !box) return;
  const mine = d.rows.slice().sort((a, b) => (b.curCost || 0) - (a.curCost || 0));
  let near = [];
  if (d.pi >= 0){
    const seen = new Set();
    near = V.rows.filter(r => r.ei >= 0).map(r => ({r, c:vCost(d.pi, r.ei)})).filter(x => !isNaN(x.c)).sort((a, b) => a.c - b.c)
      .filter(x => { const k = x.r.i; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  }
  box.innerHTML = `<p><b>Ses établissements</b></p><ol class="mini">${mine.map(r => `<li>${vBadge(r.res)}<span>${esc(r.eLabel)}</span><span>${vFmt(r.curCost)}${r.best && r.best.id !== d.id && r.best.pi !== d.pi && r.curCost - r.bestCost > 300 ? ` <em>· ${esc(r.best.label)} est à ${vFmt(r.bestCost)}</em>` : ""}</span></li>`).join("")}</ol>
    <p style="margin-top:12px"><b>Établissements les plus proches de lui</b></p><ol class="mini">${near.map(x => `<li><span class="vdot" style="background:${x.r.dId === d.id ? VCOL.doc : VCOL.etab}"></span><span>${esc(x.r.eLabel)}</span><span>${vFmt(x.c)} · ${x.r.dId === d.id ? "déjà à lui" : "suivi par " + esc(x.r.dLabel) + " (" + vFmt(x.r.curCost) + ")"}</span></li>`).join("")}</ol>`;
}
function vPropHTML(r){
  const open = V.open === r.i, g = r.curCost - r.propCost;
  return `<li class="item${open ? " open" : ""}" data-vi="${r.i}"><button type="button" aria-expanded="${open}">
    <span class="rk" style="background:${g > 0 ? VCOL.prop : VCOL.nv}">${g > 0 ? "↓" : "="}</span>
    <span class="who"><b>${esc(r.eLabel)}</b><small>${esc(r.dLabel)} (${vFmt(r.curCost)}) → <span class="to">${esc(r.prop.label)}</span> (${vFmt(r.propCost)})</small></span>
    <span class="fig"><span class="big">${g > 0 ? "−" : g < 0 ? "+" : ""}${vFmt(Math.abs(g))}</span><span class="sm">par trajet</span></span></button>${open ? `<div class="det" id="vdet"></div>` : ""}</li>`;
}

/* ---------- Carte ---------- */
function drawVerifMap(fit = true){
  layerPts.clearLayers(); layerRoute.clearLayers();
  if (!V.ready) return;
  const pts = [], sel = V.selDoc, openRow = V.open != null ? V.rows[V.open] : null;
  const faded = !!sel || !!openRow;
  const line = (a, b, o) => L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {interactive:false, ...o}).addTo(layerPts);
  // Traits des affectations
  for (const r of V.rows){
    if (!r.ePt || !r.dPt) continue;
    const mine = sel ? r.dId === sel : openRow ? r === openRow : true;
    if (V.tab === "props" && !sel && !openRow){
      if (r.prop && r.prop.id !== r.dId){
        line(r.dPt, r.ePt, {color:VCOL.bad, weight:1.5, opacity:.6, dashArray:"4 5"});
        line(r.prop.pt, r.ePt, {color:VCOL.prop, weight:2.5, opacity:.9});
      }
      continue;
    }
    line(r.dPt, r.ePt, {color:r.res === "bad" ? VCOL.bad : "#8e8e93", weight:mine && faded ? 3 : 1.2, opacity:faded ? (mine ? .95 : .08) : .45});
    if (openRow === r && r.prop && r.prop.id !== r.dId) line(r.prop.pt, r.ePt, {color:VCOL.prop, weight:3, opacity:.95, dashArray:"6 6"});
  }
  // Établissements (rouge)
  for (const r of V.rows){
    if (!r.ePt) continue;
    const hl = sel ? r.dId === sel : openRow ? r === openRow : true;
    L.circleMarker([r.ePt.lat, r.ePt.lon], {radius:hl && faded ? 6 : 4.5, color:"#fff", weight:1.5, fillColor:VCOL.etab, fillOpacity:faded && !hl ? .35 : 1})
      .bindTooltip(`${esc(r.eLabel)} · ${esc(r.dLabel)} · ${vFmt(r.curCost)}`).on("click", () => vOpenRow(r.i, true)).addTo(layerPts);
    pts.push([r.ePt.lat, r.ePt.lon]);
  }
  // Médecins (bleu)
  for (const d of V.docs){
    if (!d.pt) continue;
    const hl = sel ? d.id === sel : openRow ? d.id === openRow.dId || (openRow.prop && openRow.prop.id === d.id) : true;
    L.circleMarker([d.pt.lat, d.pt.lon], {radius:5 + Math.min(8, Math.sqrt(d.rows.length) * 2), color:"#fff", weight:2, fillColor:VCOL.doc, fillOpacity:faded && !hl ? .35 : 1})
      .bindTooltip(`${esc(d.label)} · ${plural(d.rows.length, "établissement")}`).on("click", () => vSelDoc(d.id, true)).addTo(layerPts);
    pts.push([d.pt.lat, d.pt.lon]);
  }
  if (!fit) return;
  let focus = pts;
  if (sel){ const d = V.docs.find(x => x.id === sel); focus = [d.pt, ...d.rows.map(r => r.ePt)].filter(Boolean).map(p => [p.lat, p.lon]); }
  else if (openRow) focus = [openRow.ePt, openRow.dPt, openRow.prop && openRow.prop.pt].filter(Boolean).map(p => [p.lat, p.lon]);
  if (focus.length > 1) map.fitBounds(focus, {...panelPadding(), maxZoom:12});
  else if (focus.length) map.setView(focus[0], 11);
}
function vOpenRow(i, fromMap){
  if (fromMap && V.tab === "medecins") V.tab = "trajets";
  if (fromMap && V.tab === "trajets" && V.filter !== "all" && V.rows[i].res !== V.filter) V.filter = "all";
  V.open = V.open === i && !fromMap ? null : i; V.selDoc = null;
  vRender(); drawMap();
  const li = $(`.item[data-vi="${i}"]`); if (li) li.scrollIntoView({block:"nearest", behavior:"smooth"});
}
function vSelDoc(id, fromMap){
  V.tab = "medecins"; V.open = null;
  V.selDoc = V.selDoc === id && !fromMap ? null : id;
  vRender(); drawMap();
  const li = $(`.item[data-vd="${CSS.escape(id)}"]`); if (li) li.scrollIntoView({block:"nearest", behavior:"smooth"});
}
async function vShowRoute(i){
  const r = V.rows[i];
  try {
    const res = (await osrm(`/route/v1/driving/${cstr(r.dPt)};${cstr(r.ePt)}?overview=full&geometries=geojson`)).routes[0];
    drawRoute(res.geometry);
  } catch (e){ /* trajet indisponible */ }
}

/* ---------- Export Excel (plusieurs onglets) ---------- */
function xlsxBook(sheets){
  const x = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const cell = (v, r, c) => {
    const ref = colLetter(c) + (r + 1), st = r === 0 ? ' s="1"' : "";
    if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
    if (v == null || v === "") return "";
    return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
  };
  const ws = sh => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sh.widths.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sh.rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, r, c)).join("")}</row>`).join("")}</sheetData><autoFilter ref="A1:${colLetter(sh.rows[0].length - 1)}${sh.rows.length}"/></worksheet>`;
  const nm = s => x(s.slice(0, 31).replace(/[\\/?*[\]:']/g, " "));
  return zipStore([
    {name:"[Content_Types].xml", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, k) => `<Override PartName="/xl/worksheets/sheet${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:"_rels/.rels", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:"xl/workbook.xml", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, k) => `<sheet name="${nm(s.name)}" sheetId="${k + 1}" r:id="rId${k + 1}"/>`).join("")}</sheets><definedNames>${sheets.map((s, k) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${k}" hidden="1">'${nm(s.name)}'!$A$1:$${colLetter(s.rows[0].length - 1)}$${s.rows.length}</definedName>`).join("")}</definedNames></workbook>`},
    {name:"xl/_rels/workbook.xml.rels", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>'},
    ...sheets.map((s, k) => ({name:`xl/worksheets/sheet${k + 1}.xml`, data:ws(s)}))
  ]);
}
function exportVerif(){
  const k1 = v => v == null || isNaN(v) ? "" : Math.round(v * 10) / 10, m0 = v => v == null || isNaN(v) ? "" : Math.round(v);
  const RES = {ok:"Conforme", bad:"Écart", nv:"Non vérifiable"};
  const cMin = c => isNaN(c) ? "" : Math.round(c / 60), cKm = c => isNaN(c) ? "" : Math.round(c / 100) / 10;
  const bestT = r => r.best ? V.M.T[r.best.pi][r.ei] : NaN, bestD = r => r.best ? V.M.D[r.best.pi][r.ei] : NaN;
  const propT = r => r.prop ? V.M.T[r.prop.pi][r.ei] : NaN, propD = r => r.prop ? V.M.D[r.prop.pi][r.ei] : NaN;
  const curT = r => r.ei >= 0 && r.di >= 0 ? V.M.T[r.di][r.ei] : NaN;
  const s1 = [["N°", ...(V.statusCol ? ["Statut"] : []), "Établissement", "Localisation établissement", "Médecin", "Localisation médecin", "Km déclarés", "Min déclarées", "Km recalculés", "Min recalculées", "Écart km", "Écart min", "Résultat", "Détail", "Médecin le plus proche", "Son temps (min)", "Sa distance (km)", "Médecin proposé", "Temps proposé (min)", "Distance proposée (km)", "Gain (min)"]];
  V.rows.forEach(r => s1.push([r.i + 1, ...(V.statusCol ? [r.status] : []), r.eLabel, r.ePt ? r.ePt.label : r.etabQ, r.dLabel, r.dPt ? r.dPt.label : r.docQ, r.km ?? "", r.min ?? "",
    k1(r.newKm), m0(r.newMin), r.newKm != null && r.km != null ? k1(r.newKm - r.km) : "", r.newMin != null && r.min != null ? m0(r.newMin - r.min) : "", RES[r.res], r.why,
    r.best ? r.best.label : "", cMin(bestT(r)), cKm(bestD(r)), r.prop ? r.prop.label : "", cMin(propT(r)), cKm(propD(r)), r.prop ? m0((curT(r) - propT(r)) / 60) : ""]));
  const s2 = [["Établissement", "Localisation", "Médecin actuel", "Temps actuel (min)", "Km actuels", "Médecin proposé", "Temps proposé (min)", "Km proposés", "Gain (min)"]];
  V.changes.forEach(r => s2.push([r.eLabel, r.ePt ? r.ePt.label : r.etabQ, r.dLabel, cMin(curT(r)), cKm(V.M.D[r.di][r.ei]), r.prop.label, cMin(propT(r)), cKm(propD(r)), m0((curT(r) - propT(r)) / 60)]));
  const s3 = [["Médecin", "Localisation", "Nb établissements", "Temps total aller actuel (min)", "Trajet le plus long (min)", "Nb établissements après optimisation", "Temps total aller après optimisation (min)"]];
  V.docs.forEach(d => {
    const after = V.rows.filter(r => r.prop && r.prop.id === d.id);
    s3.push([d.label, d.pt ? d.pt.label : d.q, d.rows.length, cMin(d.rows.reduce((s, r) => s + (isNaN(curT(r)) ? 0 : curT(r)), 0)), cMin(d.rows.reduce((m, r) => Math.max(m, isNaN(curT(r)) ? 0 : curT(r)), 0)), after.length, cMin(after.reduce((s, r) => s + (isNaN(propT(r)) ? 0 : propT(r)), 0))]);
  });
  const blob = xlsxBook([
    {name:"Vérification", rows:s1, widths:[6, ...(V.statusCol ? [22] : []), 26, 30, 22, 30, 11, 11, 12, 12, 10, 10, 14, 40, 22, 12, 12, 22, 12, 12, 10]},
    {name:"Propositions", rows:s2, widths:[26, 30, 22, 14, 11, 22, 14, 11, 10]},
    {name:"Médecins", rows:s3, widths:[24, 30, 12, 18, 16, 18, 20]}]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "verification-affectations.xlsx"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* ---------- Événements ---------- */
$$(".open-verif").forEach(b => b.addEventListener("click", openVerif));
$("#vFile2").addEventListener("change", e => { IMPORT_TARGET = "verif"; importFile(e.target.files[0]); e.target.value = ""; });
$("#vSheetSel").addEventListener("change", () => vLoadSheet(+$("#vSheetSel").value));
$("#vRoles").addEventListener("change", e => { const s = e.target.closest("select"); if (!s) return; VM.map[s.dataset.role] = +s.value; vUpdateMapper(); });
$("#vGo").addEventListener("click", runVerif);
$("#vTabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; V.tab = b.dataset.t; V.open = null; V.selDoc = null; vRender(); drawMap(); });
$("#vNew").addEventListener("click", openVerif);
$("#list").addEventListener("click", e => {
  if (S.mode !== "verif") return;
  const f = e.target.closest("#vFilter button"); if (f){ V.filter = f.dataset.f; V.open = null; vRender(); drawMap(false); return; }
  const rt = e.target.closest("[data-route]"); if (rt){ vShowRoute(+rt.dataset.route); return; }
  if (e.target.closest(".det")) return;
  const li = e.target.closest(".item[data-vi]"); if (li){ vOpenRow(+li.dataset.vi); return; }
  const ld = e.target.closest(".item[data-vd]"); if (ld) vSelDoc(ld.dataset.vd);
});
$("#vSet").addEventListener("change", () => {
  V.metric = $("#vMetric").value; V.capMode = $("#vCap").value; V.capN = Math.max(1, parseInt($("#vCapN").value, 10) || 2);
  V.tolPct = +$("#vTolPct").value || 0; V.tolKm = +$("#vTolKm").value || 0; V.tolPctMin = +$("#vTolPctMin").value || 0; V.tolMin = +$("#vTolMin").value || 0;
  $("#vCapN").disabled = V.capMode !== "max";
  if (V.ready){ vCompute(); vRender(); drawMap(false); }
});
