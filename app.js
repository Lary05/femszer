// Import Firebase v9 Modular SDK from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, serverTimestamp, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDy7TnagYknwJ5AfJg7pgBT4Or4mvYZT2s",
    authDomain: "femszer.firebaseapp.com",
    projectId: "femszer",
    storageBucket: "femszer.firebasestorage.app",
    messagingSenderId: "314204827772",
    appId: "1:314204827772:web:25ac87bb127880eda459f9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const jelenletRef = collection(db, "jelenlet_naplo");
const dolgozokRef = collection(db, "dolgozok");
const tavolletekRef = collection(db, "tavolletek");

// -------------------------------------------------------------------------
// 🚨 KÁRTYÁK UID KÓDJAI (EZT TÖLTSD KI A FÉNYKÉP ALAPJÁN!) 🚨
// -------------------------------------------------------------------------
const cardMapping = {
    1: "UID_1_IDE_JON", 2: "UID_2_IDE_JON", 3: "UID_3_IDE_JON", 4: "UID_4_IDE_JON", 5: "UID_5_IDE_JON",
    // A 6-os kártya hiányzik
    7: "UID_7_IDE_JON", 8: "UID_8_IDE_JON", 9: "UID_9_IDE_JON", 10: "UID_10_IDE_JON",
    11: "UID_11_IDE_JON", 12: "UID_12_IDE_JON", 13: "UID_13_IDE_JON", 14: "UID_14_IDE_JON", 15: "UID_15_IDE_JON",
    16: "UID_16_IDE_JON", 17: "UID_17_IDE_JON", 18: "UID_18_IDE_JON", 19: "UID_19_IDE_JON", 20: "UID_20_IDE_JON",
    21: "UID_21_IDE_JON", 22: "UID_22_IDE_JON", 23: "UID_23_IDE_JON", 24: "UID_24_IDE_JON", 25: "UID_25_IDE_JON",
    26: "UID_26_IDE_JON", 27: "UID_27_IDE_JON", 28: "UID_28_IDE_JON", 29: "UID_29_IDE_JON", 30: "UID_30_IDE_JON",
    31: "UID_31_IDE_JON", 32: "UID_32_IDE_JON", 33: "UID_33_IDE_JON", 34: "UID_34_IDE_JON", 35: "UID_35_IDE_JON",
    36: "UID_36_IDE_JON", 37: "UID_37_IDE_JON", 38: "UID_38_IDE_JON", 39: "UID_39_IDE_JON", 40: "UID_40_IDE_JON"
};

// Segédfüggvény UID -> Kártyaszám fordításhoz
function getCardNumberByUid(uid) {
    if (!uid) return "-";
    const entry = Object.entries(cardMapping).find(([k, v]) => v === uid);
    return entry ? `${entry[0]}. kártya` : uid; // Ha nincs a listában (pl. régi kártya), magát a kódot írja ki
}

function populateAvailableCards(selectId, currentUid = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>Válassz szabad kártyát...</option>';
    if(selectId === 'edit-emp-nfc') {
        select.innerHTML += '<option value="">Nincs kártya kiadva</option>';
    }

    // Aktív kártyák kigyűjtése
    const activeUids = allEmployees.filter(e => e.status === "Aktív" && e.nfc).map(e => e.nfc);

    for (let i = 1; i <= 40; i++) {
        if (i === 6) continue; // 6-os kártya kihagyása
        const uid = cardMapping[i];
        
        // Ha a kártya szabad, VAGY ez az ember jelenlegi kártyája, akkor bekerül a listába
        if (!activeUids.includes(uid) || uid === currentUid) {
            const opt = document.createElement('option');
            opt.value = uid;
            opt.textContent = `${i}. kártya`;
            if (uid === currentUid) opt.selected = true;
            select.appendChild(opt);
        }
    }
}
// -------------------------------------------------------------------------


function getTodayString() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
}

window.addEventListener('error', (e) => {
    console.error("Kritikus hiba:", e.error || e.message);
});

// DÁTUM KONVERTER (n8n Timestamp védelem)
function toDbDate(d) { return d ? d.replace(/-/g, '.') : ""; }
function fromDbDate(d) { return d ? d.replace(/\./g, '-') : ""; }

// OKOS MUNKAIDŐ ÉS TÚLÓRA KEREKÍTÉS LOGIKA (SMART ROUNDING)
function calculateSmartHours(arr, dep) {
    if (!arr || !dep || dep === "-") return "";
    const [arrH, arrM] = arr.split(':').map(Number);
    const [depH, depM] = dep.split(':').map(Number);

    const depTotalMins = (depH * 60) + depM;
    const limitMins = (14 * 60) + 45; // 14:45 kerekítési határ
    const overtimeStartMins = (16 * 60) + 0; // 16:00

    let baseText = "";
    if (depTotalMins <= limitMins) baseText = "7ó 0p";
    else baseText = "8ó 0p";

    if (depTotalMins > overtimeStartMins) {
        const overtimeMins = depTotalMins - overtimeStartMins;
        const otH = Math.floor(overtimeMins / 60);
        const otM = overtimeMins % 60;
        return `${baseText} (+${otH}ó ${String(otM).padStart(2, '0')}p túlóra)`;
    }

    return baseText;
}

// UI LOGIC & ROUTING
const menuAttendance = document.getElementById('menu-attendance');
const menuEmployees = document.getElementById('menu-employees');
const menuAbsences = document.getElementById('menu-absences');
const menuWarnings = document.getElementById('menu-warnings');
const menuExports = document.getElementById('menu-exports');
const menuGuide = document.getElementById('menu-guide');

const viewAttendance = document.getElementById('view-attendance');
const viewEmployees = document.getElementById('view-employees');
const viewAbsences = document.getElementById('view-absences');
const viewWarnings = document.getElementById('view-warnings');
const viewExports = document.getElementById('view-exports');
const viewGuide = document.getElementById('view-guide');
const headerTitle = document.getElementById('header-title');

const activeClassBase = ["flex", "items-center", "gap-3", "px-4", "py-3", "rounded-lg", "shadow-lg", "transition-all"];
const activeClassColor = ["bg-blue-600", "text-white", "shadow-blue-500/30"];
const inactiveClassBase = ["flex", "items-center", "gap-3", "px-4", "py-3", "rounded-lg", "hover:bg-gray-800", "hover:text-white", "transition-all", "group"];
const inactiveClassColor = ["text-gray-400"];

function switchView(activeMenu, activeView, title) {
    [menuAttendance, menuEmployees, menuAbsences, menuWarnings, menuExports, menuGuide].forEach(m => {
        if (m) {
            m.className = ""; m.classList.add(...inactiveClassBase, ...inactiveClassColor);
            m.querySelector('i').classList.add("group-hover:text-blue-400", "transition-colors"); m.querySelector('i').classList.remove("text-white");
        }
    });
    if (activeMenu) {
        activeMenu.className = ""; activeMenu.classList.add(...activeClassBase, ...activeClassColor);
        activeMenu.querySelector('i').classList.remove("group-hover:text-blue-400", "transition-colors", "text-amber-500");
    }
    [viewAttendance, viewEmployees, viewAbsences, viewWarnings, viewExports, viewGuide].forEach(v => { if (v) { v.classList.remove('block'); v.classList.add('hidden'); } });
    if (activeView) { activeView.classList.remove('hidden'); activeView.classList.add('block'); headerTitle.textContent = title; }

    if (window.updateWarningIcon) window.updateWarningIcon();
}

if (menuAttendance) menuAttendance.addEventListener('click', (e) => { e.preventDefault(); switchView(menuAttendance, viewAttendance, "Mai Napi Jelenlét"); });
if (menuEmployees) menuEmployees.addEventListener('click', (e) => { e.preventDefault(); switchView(menuEmployees, viewEmployees, "Dolgozók Kezelése"); });
if (menuAbsences) menuAbsences.addEventListener('click', (e) => { e.preventDefault(); switchView(menuAbsences, viewAbsences, "Távollétek Kezelése"); });
if (menuWarnings) menuWarnings.addEventListener('click', (e) => { e.preventDefault(); switchView(menuWarnings, viewWarnings, "HR Figyelmeztetések"); fetchAndRenderWarnings(); });
if (menuExports) menuExports.addEventListener('click', (e) => { e.preventDefault(); switchView(menuExports, viewExports, "Exportálások"); });
if (menuGuide) menuGuide.addEventListener('click', (e) => { e.preventDefault(); switchView(menuGuide, viewGuide, "Rendszer Súgó"); });

// HR FIGYELMEZTETÉSEK LOGIKA
window.currentWarningCount = 0;

window.updateWarningIcon = function () {
    const icon = document.getElementById('menu-warning-icon');
    const menu = document.getElementById('menu-warnings');
    if (!icon || !menu) return;

    if (menu.classList.contains('bg-blue-600')) {
        icon.className = "fas fa-exclamation-triangle text-lg w-6 text-center text-white transition-colors";
    } else {
        if (window.currentWarningCount > 0) {
            icon.className = "fas fa-exclamation-triangle text-lg w-6 text-center text-amber-500 animate-pulse transition-colors";
        } else {
            icon.className = "fas fa-exclamation-triangle text-lg w-6 text-center text-gray-400 group-hover:text-blue-400 transition-colors";
        }
    }
};

async function fetchAndRenderWarnings() {
    const tbody = document.getElementById('warnings-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-gray-500"><i class="fas fa-circle-notch fa-spin"></i> Adatok elemzése...</td></tr>`;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const startStr = `${y}-${m}-01`;
    const todayStr = getTodayString();

    try {
        const activeEmp = allEmployees.filter(e => e.status === "Aktív");
        const [snapJ, snapT] = await Promise.all([
            getDocs(query(jelenletRef, where("date", ">=", toDbDate(startStr)), where("date", "<", toDbDate(todayStr)))),
            getDocs(query(tavolletekRef, where("datum", ">=", startStr), where("datum", "<", todayStr)))
        ]);

        const jelArr = []; snapJ.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); jelArr.push({ id: d.id, ...data }); });
        const tavArr = []; snapT.forEach(d => tavArr.push(d.data()));
        let warnings = [];

        activeEmp.forEach(emp => {
            const todayNum = now.getDate();
            for (let d = 1; d < todayNum; d++) {
                const dateStr = `${y}-${m}-${String(d).padStart(2, '0')}`;
                const dateObj = new Date(y, now.getMonth(), d);
                const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                const att = jelArr.find(j => j.name === emp.name && j.date === dateStr);
                const tav = tavArr.find(t => t.dolgozoId === emp.id && t.datum === dateStr);

                if (att) {
                    if (att.departure === "-") warnings.push({ empId: emp.id, docId: att.id, name: emp.name, date: dateStr, arr: att.arrival, dep: "", hasAbsence: tav ? 'true':'false', detail: `Érkezés: ${att.arrival}`, type: "Hiányzó távozás", color: "bg-amber-100 text-amber-800" });
                    else if (att.arrival === "-") warnings.push({ empId: emp.id, docId: att.id, name: emp.name, date: dateStr, arr: "", dep: att.departure, hasAbsence: tav ? 'true':'false', detail: `Távozás: ${att.departure}`, type: "Hiányzó érkezés", color: "bg-amber-100 text-amber-800" });
                } else if (!tav && !isWknd) {
                    warnings.push({ empId: emp.id, docId: null, name: emp.name, date: dateStr, arr: "", dep: "", hasAbsence: 'false', detail: "Nincs adat", type: "Igazolatlan hiányzás", color: "bg-red-100 text-red-800" });
                }
            }
        });

        warnings.sort((a, b) => b.date.localeCompare(a.date));
        tbody.innerHTML = "";
        window.currentWarningCount = warnings.length;

        if (warnings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-gray-500 font-medium">Minden adat rendben van a hónapban! 🎉</td></tr>`;
        } else {
            warnings.forEach(w => {
                const editBtn = `<button onclick="window.handleAttEditClick(null, '${w.empId}', '${w.name}', '${w.date}', '${w.hasAbsence}', '${w.arr}', '${w.dep}', '${w.docId || ''}')" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded shadow-sm border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors text-xs font-bold w-full"><i class="fas fa-edit"></i> Pótlás</button>`;
                
                tbody.innerHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="py-3 px-4 font-medium text-gray-800">${w.name}</td>
                    <td class="py-3 px-4 text-gray-600">${w.date.replace(/-/g, '.')} <span class="text-xs text-gray-400 ml-2">(${w.detail})</span></td>
                    <td class="py-3 px-4"><span class="px-2.5 py-1 rounded-md text-xs font-bold border ${w.color}">${w.type}</span></td>
                    <td class="py-3 px-4 text-center w-32">${editBtn}</td>
                </tr>`;
            });
        }
        window.updateWarningIcon();

    } catch (err) { }
}

// EMPLOYEE LOGIC
let allEmployees = [];
let showArchivedEmployees = false;

function openModal() { 
    populateAvailableCards('emp-nfc'); // Megnyitáskor feltölti a kártyákat
    document.getElementById('modal-overlay').classList.remove('hidden', 'opacity-0'); 
    document.getElementById('modal-employee').classList.remove('hidden'); 
    document.getElementById('modal-employee-content').classList.remove('opacity-0', 'scale-95'); 
    document.getElementById('modal-employee-content').classList.add('opacity-100', 'scale-100'); 
}

function closeModal() { 
    document.getElementById('modal-overlay').classList.add('opacity-0'); 
    document.getElementById('modal-employee-content').classList.remove('opacity-100', 'scale-100'); 
    document.getElementById('modal-employee-content').classList.add('opacity-0', 'scale-95'); 
    setTimeout(() => { 
        document.getElementById('modal-overlay').classList.add('hidden'); 
        document.getElementById('modal-employee').classList.add('hidden'); 
        document.getElementById('form-employee').reset(); 
    }, 300); 
}
document.getElementById('btn-new-employee')?.addEventListener('click', openModal); 
document.getElementById('btn-close-modal')?.addEventListener('click', closeModal); 
document.getElementById('btn-cancel-modal')?.addEventListener('click', closeModal);

document.getElementById('form-employee')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('emp-name').value.trim();
    const nfc = document.getElementById('emp-nfc').value; // Dropdown value
    const city = document.getElementById('emp-city').value.trim();
    const distance = document.getElementById('emp-distance').value ? Number(document.getElementById('emp-distance').value) : 0;

    if (!name || !nfc) return;

    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';
    btn.disabled = true;

    try {
        await addDoc(dolgozokRef, { name: name, nfc: nfc, city: city, distance: distance, status: "Aktív", createdAt: serverTimestamp() });
        closeModal();
        Swal.fire('Sikeres mentés!', 'Az Új dolgozó hozzáadva.', 'success');
    } catch (err) { } finally { btn.innerHTML = orig; btn.disabled = false; }
});

window.openEditEmployeeModal = function (empId) {
    const emp = allEmployees.find(e => e.id === empId);
    if (!emp) return;

    populateAvailableCards('edit-emp-nfc', emp.nfc); // Legördülő feltöltése

    document.getElementById('edit-emp-id').value = emp.id;
    document.getElementById('edit-emp-name').value = emp.name;
    document.getElementById('edit-emp-old-nfc').value = emp.nfc || "";
    document.getElementById('edit-emp-city').value = emp.city || "";
    document.getElementById('edit-emp-distance').value = emp.distance || "";

    document.getElementById('modal-overlay').classList.remove('hidden', 'opacity-0');
    document.getElementById('modal-edit-employee').classList.remove('hidden');
    requestAnimationFrame(() => { 
        document.getElementById('modal-edit-employee-content').classList.remove('opacity-0', 'scale-95'); 
        document.getElementById('modal-edit-employee-content').classList.add('opacity-100', 'scale-100'); 
    });
};

function closeEditModal() { 
    document.getElementById('modal-overlay').classList.add('opacity-0'); 
    document.getElementById('modal-edit-employee-content').classList.remove('opacity-100', 'scale-100'); 
    document.getElementById('modal-edit-employee-content').classList.add('opacity-0', 'scale-95'); 
    setTimeout(() => { 
        document.getElementById('modal-overlay').classList.add('hidden'); 
        document.getElementById('modal-edit-employee').classList.add('hidden'); 
        document.getElementById('form-edit-employee').reset(); 
    }, 300); 
}
document.getElementById('btn-close-edit-modal')?.addEventListener('click', closeEditModal); 
document.getElementById('btn-cancel-edit-modal')?.addEventListener('click', closeEditModal);

document.getElementById('form-edit-employee')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-emp-id').value;
    const name = document.getElementById('edit-emp-name').value.trim();
    const newNfc = document.getElementById('edit-emp-nfc').value;
    const oldNfc = document.getElementById('edit-emp-old-nfc').value;
    const city = document.getElementById('edit-emp-city').value.trim();
    const distance = document.getElementById('edit-emp-distance').value ? Number(document.getElementById('edit-emp-distance').value) : 0;

    if (!id || !name) return;

    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mentés...';
    btn.disabled = true;

    try {
        const emp = allEmployees.find(e => e.id === id);
        const oldCards = emp.korabbiKartyak || [];
        if (newNfc !== oldNfc && oldNfc) oldCards.push({ card: oldNfc, date: new Date().toISOString() });
        await updateDoc(doc(db, "dolgozok", id), { name: name, nfc: newNfc, city: city, distance: distance, korabbiKartyak: oldCards });
        closeEditModal();
    } catch (err) { } finally { btn.innerHTML = orig; btn.disabled = false; }
});

// GLOBÁLIS ARCHIVÁLÁS ÉS VISSZAÁLLÍTÁS FUNKCIÓK
window.archiveEmployee = async function(empId) {
    window.event.stopPropagation();
    const result = await Swal.fire({ title: 'Archiválás', text: "Biztosan archiválod? A kártyája felszabadul.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', confirmButtonText: 'Igen' }); 
    if (result.isConfirmed) { 
        const emp = allEmployees.find(e => e.id === empId); 
        const oldCards = emp.korabbiKartyak || []; 
        if (emp.nfc) oldCards.push({ card: emp.nfc, date: new Date().toISOString() }); 
        await updateDoc(doc(db, "dolgozok", empId), { status: "Archivált", archivalasDatuma: serverTimestamp(), nfc: "", korabbiKartyak: oldCards }); 
    }
}

window.restoreEmployee = async function(empId) {
    window.event.stopPropagation();
    const result = await Swal.fire({ title: 'Visszaállítás', icon: 'question', showCancelButton: true, confirmButtonText: 'Igen' }); 
    if (result.isConfirmed) await updateDoc(doc(db, "dolgozok", empId), { status: "Aktív", archivalasDatuma: null });
}


document.getElementById('toggle-archived')?.addEventListener('change', (e) => { showArchivedEmployees = e.target.checked; renderEmployeesTable(allEmployees); });

function renderEmployeesTable(docs) {
    const tbody = document.getElementById("employees-table-body"); if (!tbody) return; tbody.innerHTML = "";
    const targetStatus = showArchivedEmployees ? "Archivált" : "Aktív"; const filteredDocs = docs.filter(doc => doc.status === targetStatus);
    if (filteredDocs.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-gray-500">Még nincsenek ${targetStatus.toLowerCase()} dolgozók.</td></tr>`; return; }

    filteredDocs.forEach(d => {
        const tr = document.createElement("tr"); tr.className = "cursor-pointer hover:bg-gray-50 transition-colors";
        tr.onclick = (e) => { if (!e.target.closest("button")) openWorkerProfile(d.id, d.name, getCardNumberByUid(d.nfc), d.status); };
        const isActive = d.status === "Aktív";
        const statusClass = isActive ? "text-green-700 bg-green-50 border-green-200" : "text-gray-700 bg-gray-100 border-gray-200";
        const statusDot = isActive ? `<span class="w-2 h-2 rounded-full bg-green-500 status-active"></span>` : `<span class="w-2 h-2 rounded-full bg-gray-400"></span>`;
        const initials = d.name.substring(0, 2).toUpperCase();

        let actionButtons = isActive ?
            `<button class="text-gray-400 hover:text-blue-500 mx-1" onclick="window.openEditEmployeeModal('${d.id}'); window.event.stopPropagation();"><i class="fas fa-edit"></i></button><button class="text-gray-400 hover:text-amber-500 mx-1" onclick="window.archiveEmployee('${d.id}')"><i class="fas fa-archive"></i></button>` :
            `<button class="text-gray-400 hover:text-emerald-500 mx-1" onclick="window.restoreEmployee('${d.id}')"><i class="fas fa-undo"></i></button>`;

        const cityDist = `${d.city || '-'} <span class="text-gray-400 text-xs ml-1">(${d.distance || 0} km)</span>`;
        const nfcDisplay = getCardNumberByUid(d.nfc);

        tr.innerHTML = `<td class="py-4 px-6 border-b border-gray-50"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">${initials}</div><span class="font-medium text-gray-800">${d.name}</span></div></td><td class="py-4 px-6 border-b border-gray-50 font-semibold text-sm text-gray-700">${cityDist}</td><td class="py-4 px-6 border-b border-gray-50"><span class="font-bold text-sm text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">${nfcDisplay}</span></td><td class="py-4 px-6 border-b border-gray-50"><div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${statusClass} shadow-sm">${statusDot}${d.status}</div></td><td class="py-4 px-6 border-b border-gray-50 text-center">${actionButtons}</td>`;
        tbody.appendChild(tr);
    });
}

function populateEmployeeSelect(docs) {
    const s1 = document.getElementById('abs-employee');
    if (s1) s1.innerHTML = '<option value="" disabled selected>Válassz dolgozót...</option>';
    docs.filter(d => d.status === "Aktív").forEach(d => {
        const o1 = document.createElement('option'); o1.value = d.id; o1.textContent = d.name; o1.dataset.name = d.name; if (s1) s1.appendChild(o1);
    });
}

function setupEmployeesListener() {
    onSnapshot(query(dolgozokRef), (snapshot) => {
        const dataList = []; snapshot.forEach(docSnap => dataList.push({ id: docSnap.id, ...docSnap.data() }));
        dataList.sort((a, b) => a.name.localeCompare(b.name));
        allEmployees = dataList; renderEmployeesTable(dataList); populateEmployeeSelect(dataList); fetchAndRenderAttendance();
        const mInput = document.getElementById('att-monthly-all-month'); if (mInput && mInput.value && currentAttendanceMode === 'monthly-all') renderMonthlyAllTable(mInput.value);
        fetchAndRenderWarnings();
    });
}

// ATTENDANCE LOGIC ÉS TÖMEGES SZERKESZTŐ MÓD
let currentDate = new Date();
let currentAttendanceMode = 'daily';

window.isEditModeActive = false;
window.isBulkModeActive = false;
window.selectedCells = [];
window.isBulkEditSubmit = false;

function formatDateStr(dateObj) { const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0'); const d = String(dateObj.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function updateAttendanceDateUI() { if (document.getElementById('attendance-date')) document.getElementById('attendance-date').value = formatDateStr(currentDate); }

const btnViewDaily = document.getElementById('btn-view-daily'); const btnViewWeekly = document.getElementById('btn-view-weekly'); const btnViewMonthlyAll = document.getElementById('btn-view-monthly-all');
const attendanceDailyWrapper = document.getElementById('attendance-daily-wrapper'); const attendanceWeeklyWrapper = document.getElementById('attendance-weekly-wrapper'); const attendanceMonthlyAllWrapper = document.getElementById('attendance-monthly-all-wrapper');
const attendanceDateNav = document.getElementById('attendance-date-nav');

const btnToggleEditMode = document.getElementById('btn-toggle-edit-mode');
const btnToggleBulkMode = document.getElementById('btn-toggle-bulk-mode');
const btnBulkEditAction = document.getElementById('btn-bulk-edit-action');
const bulkEditCount = document.getElementById('bulk-edit-count');

if (btnToggleEditMode) {
    btnToggleEditMode.addEventListener('click', async () => {
        if (!window.isEditModeActive) {
            const res = await Swal.fire({ title: 'Szerkesztő Mód', text: "Aktiválod a szerkesztő módot a jelenlétek átírásához?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#eab308', confirmButtonText: 'Igen' });
            if (res.isConfirmed) {
                window.isEditModeActive = true;
                btnToggleEditMode.innerHTML = `<i class="fas fa-edit"></i> <span>Szerkesztő Mód: BE</span>`;
                btnToggleEditMode.className = "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all text-white bg-amber-500 shadow-md animate-pulse";
                if (btnToggleBulkMode) { btnToggleBulkMode.classList.remove('hidden'); btnToggleBulkMode.classList.add('flex'); }
                applyEditModeStyles();
            }
        } else {
            window.isEditModeActive = false; window.isBulkModeActive = false; window.selectedCells = [];
            btnToggleEditMode.innerHTML = `<i class="fas fa-edit"></i> <span>Szerkesztő Mód: KI</span>`;
            btnToggleEditMode.className = "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 shadow-sm";
            if (btnToggleBulkMode) {
                btnToggleBulkMode.classList.add('hidden'); btnToggleBulkMode.classList.remove('flex');
                btnToggleBulkMode.innerHTML = `<i class="fas fa-check-square"></i> <span>Kijelölés: KI</span>`;
                btnToggleBulkMode.className = "hidden items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-sm";
            }
            if (btnBulkEditAction) { btnBulkEditAction.classList.add('hidden'); btnBulkEditAction.classList.remove('flex'); }
            applyEditModeStyles(); fetchAndRenderAttendance();
            if (currentAttendanceMode === 'monthly-all') renderMonthlyAllTable();
        }
    });
}

if (btnToggleBulkMode) {
    btnToggleBulkMode.addEventListener('click', () => {
        window.isBulkModeActive = !window.isBulkModeActive;
        if (window.isBulkModeActive) {
            btnToggleBulkMode.innerHTML = `<i class="fas fa-check-double"></i> <span>Kijelölés: BE</span>`;
            btnToggleBulkMode.className = "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all text-white bg-blue-600 shadow-md";
        } else {
            btnToggleBulkMode.innerHTML = `<i class="fas fa-check-square"></i> <span>Kijelölés: KI</span>`;
            btnToggleBulkMode.className = "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-sm";
            window.selectedCells.forEach(c => { if (c.el) c.el.classList.remove('outline', 'outline-4', 'outline-blue-500', '-outline-offset-2', 'bg-blue-100/50'); });
            window.selectedCells = []; updateBulkActionBtn();
        }
    });
}

function updateBulkActionBtn() {
    if (window.selectedCells.length > 0) {
        btnBulkEditAction.classList.remove('hidden'); btnBulkEditAction.classList.add('flex');
        bulkEditCount.textContent = window.selectedCells.length;
    } else {
        btnBulkEditAction.classList.add('hidden'); btnBulkEditAction.classList.remove('flex');
    }
}

function applyEditModeStyles() {
    const wrappers = [attendanceDailyWrapper, attendanceWeeklyWrapper, attendanceMonthlyAllWrapper];
    wrappers.forEach(w => {
        if (w) {
            if (window.isEditModeActive) w.classList.add('bg-slate-100', 'border-amber-300', 'border-2');
            else w.classList.remove('bg-slate-100', 'border-amber-300', 'border-2');
        }
    });
}

window.handleAttEditClick = function (el, empId, empName, dateStr, hasAbsence, arr, dep, docId) {
    if (hasAbsence === 'true') { Swal.fire('Nem lehetséges!', 'Ezen a napon távollét van rögzítve. Először át kell írni a távollétet a Távollétek Kezelése fülön!', 'error'); return; }

    if (window.isBulkModeActive) {
        const cellIndex = window.selectedCells.findIndex(c => c.empId === empId && c.dateStr === dateStr);
        if (cellIndex > -1) {
            window.selectedCells.splice(cellIndex, 1);
            if (el) el.classList.remove('outline', 'outline-4', 'outline-blue-500', '-outline-offset-2', 'bg-blue-100/50');
        } else {
            window.selectedCells.push({ empId, empName, dateStr, arr, dep, docId, el });
            if (el) el.classList.add('outline', 'outline-4', 'outline-blue-500', '-outline-offset-2', 'bg-blue-100/50');
        }
        updateBulkActionBtn();
        return;
    }

    window.isBulkEditSubmit = false;
    document.getElementById('bulk-edit-info').classList.add('hidden'); document.getElementById('single-edit-info').classList.remove('hidden');
    document.getElementById('edit-att-emp-id').value = empId; document.getElementById('edit-att-emp-name').value = empName;
    document.getElementById('edit-att-date').value = dateStr; document.getElementById('edit-att-arrival').value = arr || "";
    document.getElementById('edit-att-departure').value = dep === "-" ? "" : (dep || ""); document.getElementById('edit-att-doc-id').value = docId || "";

    document.getElementById('modal-overlay').classList.remove('hidden', 'opacity-0'); document.getElementById('modal-edit-attendance').classList.remove('hidden');
    requestAnimationFrame(() => { document.getElementById('modal-edit-attendance-content').classList.remove('opacity-0', 'scale-95'); document.getElementById('modal-edit-attendance-content').classList.add('opacity-100', 'scale-100'); });
}

if (btnBulkEditAction) {
    btnBulkEditAction.addEventListener('click', () => {
        window.isBulkEditSubmit = true;
        document.getElementById('edit-att-arrival').value = ""; document.getElementById('edit-att-departure').value = "";
        document.getElementById('bulk-edit-info').classList.remove('hidden'); document.getElementById('single-edit-info').classList.add('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden', 'opacity-0'); document.getElementById('modal-edit-attendance').classList.remove('hidden');
        requestAnimationFrame(() => { document.getElementById('modal-edit-attendance-content').classList.remove('opacity-0', 'scale-95'); document.getElementById('modal-edit-attendance-content').classList.add('opacity-100', 'scale-100'); });
    });
}

function closeEditAttModal() {
    document.getElementById('modal-overlay').classList.add('opacity-0'); document.getElementById('modal-edit-attendance-content').classList.remove('opacity-100', 'scale-100'); document.getElementById('modal-edit-attendance-content').classList.add('opacity-0', 'scale-95');
    setTimeout(() => { document.getElementById('modal-overlay').classList.add('hidden'); document.getElementById('modal-edit-attendance').classList.add('hidden'); document.getElementById('form-edit-attendance').reset(); }, 300);
}
document.getElementById('btn-close-edit-att-modal')?.addEventListener('click', closeEditAttModal);
document.getElementById('btn-cancel-edit-att-modal')?.addEventListener('click', closeEditAttModal);

document.getElementById('form-edit-attendance')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const arrival = document.getElementById('edit-att-arrival').value; let departure = document.getElementById('edit-att-departure').value; if (!departure) departure = "-";
    const btn = e.target.querySelector('button[type="submit"]'); const orig = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        if (window.isBulkEditSubmit) {
            const batchPromises = window.selectedCells.map(c => {
                if (c.docId) return updateDoc(doc(db, "jelenlet_naplo", c.docId), { arrival: arrival, departure: departure, status: departure === "-" ? "Jelen van" : "Eltávozott" });
                else return addDoc(jelenletRef, { name: c.empName, date: toDbDate(c.dateStr), arrival: arrival, departure: departure, status: departure === "-" ? "Jelen van" : "Eltávozott", timestamp: serverTimestamp() });
            });
            await Promise.all(batchPromises);
            window.selectedCells = []; updateBulkActionBtn();
            Swal.fire('Mentve!', 'A kijelölt napok sikeresen frissítve.', 'success');
        } else {
            const empName = document.getElementById('edit-att-emp-name').value; const dateStr = document.getElementById('edit-att-date').value; const docId = document.getElementById('edit-att-doc-id').value;
            if (docId) await updateDoc(doc(db, "jelenlet_naplo", docId), { arrival: arrival, departure: departure, status: departure === "-" ? "Jelen van" : "Eltávozott" });
            else await addDoc(jelenletRef, { name: empName, date: toDbDate(dateStr), arrival: arrival, departure: departure, status: departure === "-" ? "Jelen van" : "Eltávozott", timestamp: serverTimestamp() });
            Swal.fire('Mentve!', 'Az időpont sikeresen frissítve.', 'success');
        }
        closeEditAttModal(); fetchAndRenderAttendance();
        if (currentAttendanceMode === 'monthly-all') { const mInput = document.getElementById('att-monthly-all-month'); if (mInput && mInput.value) renderMonthlyAllTable(mInput.value); else renderMonthlyAllTable(); }
        fetchAndRenderWarnings();
    } catch (err) { Swal.fire('Hiba!', 'Sikertelen mentés.', 'error'); } finally { btn.innerHTML = orig; btn.disabled = false; }
});

if (btnViewDaily) {
    function resetSwitcherStyles() {
        [btnViewDaily, btnViewWeekly, btnViewMonthlyAll].forEach(btn => { if (btn) btn.className = "flex-1 xl:flex-none px-6 py-2 rounded-lg text-gray-500 hover:text-gray-700 font-medium transition-all focus:outline-none text-sm"; });
        if (attendanceDailyWrapper) attendanceDailyWrapper.classList.add('hidden'); if (attendanceWeeklyWrapper) attendanceWeeklyWrapper.classList.add('hidden'); if (attendanceMonthlyAllWrapper) attendanceMonthlyAllWrapper.classList.add('hidden');
    }
    btnViewDaily.addEventListener('click', () => { currentAttendanceMode = 'daily'; resetSwitcherStyles(); btnViewDaily.className = "flex-1 xl:flex-none px-6 py-2 rounded-lg bg-white text-blue-600 font-bold shadow-sm transition-all focus:outline-none text-sm"; attendanceDailyWrapper.classList.remove('hidden'); document.getElementById('label-prev-nav').textContent = "Előző"; document.getElementById('label-next-nav').textContent = "Következő"; document.getElementById('label-attendance-date').textContent = "Dátum kiválasztása"; attendanceDateNav.classList.remove('opacity-0', 'pointer-events-none'); fetchAndRenderAttendance(); applyEditModeStyles(); });
    btnViewWeekly.addEventListener('click', () => { currentAttendanceMode = 'weekly'; resetSwitcherStyles(); btnViewWeekly.className = "flex-1 xl:flex-none px-6 py-2 rounded-lg bg-white text-blue-600 font-bold shadow-sm transition-all focus:outline-none text-sm"; attendanceWeeklyWrapper.classList.remove('hidden'); document.getElementById('label-prev-nav').textContent = "Előző hét"; document.getElementById('label-next-nav').textContent = "Következő hét"; document.getElementById('label-attendance-date').textContent = "Hét kiválasztása"; attendanceDateNav.classList.remove('opacity-0', 'pointer-events-none'); fetchAndRenderAttendance(); applyEditModeStyles(); });
    if (btnViewMonthlyAll) { btnViewMonthlyAll.addEventListener('click', () => { currentAttendanceMode = 'monthly-all'; resetSwitcherStyles(); btnViewMonthlyAll.className = "flex-1 xl:flex-none px-6 py-2 rounded-lg bg-white text-blue-600 font-bold shadow-sm transition-all focus:outline-none text-sm"; attendanceMonthlyAllWrapper.classList.remove('hidden'); attendanceDateNav.classList.add('opacity-0', 'pointer-events-none'); const mInput = document.getElementById('att-monthly-all-month'); if (mInput && mInput.value) renderMonthlyAllTable(mInput.value); applyEditModeStyles(); }); }
}

document.getElementById('btn-prev-day')?.addEventListener('click', () => { const step = currentAttendanceMode === 'weekly' ? 7 : 1; currentDate.setDate(currentDate.getDate() - step); updateAttendanceDateUI(); fetchAndRenderAttendance(); });
document.getElementById('btn-next-day')?.addEventListener('click', () => { const step = currentAttendanceMode === 'weekly' ? 7 : 1; currentDate.setDate(currentDate.getDate() + step); updateAttendanceDateUI(); fetchAndRenderAttendance(); });
document.getElementById('attendance-date')?.addEventListener('change', (e) => { if (e.target.value) { currentDate = new Date(e.target.value); fetchAndRenderAttendance(); } });

async function fetchAndRenderAttendance() {
    const targetDateStr = formatDateStr(currentDate);
    const tbodyDaily = document.getElementById("attendance-table-body"); const tbodyWeekly = document.getElementById("attendance-table-weekly-body");
    if (currentAttendanceMode === 'daily' && tbodyDaily) tbodyDaily.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-gray-400"><i class="fas fa-circle-notch fa-spin"></i> Betöltés...</td></tr>`;
    else if (currentAttendanceMode === 'weekly' && tbodyWeekly) tbodyWeekly.innerHTML = `<tr><td colspan="8" class="py-12 text-center text-gray-400"><i class="fas fa-circle-notch fa-spin"></i> Betöltés...</td></tr>`;

    try {
        if (currentAttendanceMode === 'daily') {
            const qAtt = query(jelenletRef, where("date", "==", toDbDate(targetDateStr)));
            const snapAtt = await getDocs(qAtt);
            const dailyAtt = []; snapAtt.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); dailyAtt.push({ id: d.id, ...data }); });

            const qAbs = query(tavolletekRef, where("datum", "==", targetDateStr)); const snapAbs = await getDocs(qAbs); const dailyAbs = []; snapAbs.forEach(d => dailyAbs.push({ id: d.id, ...d.data() }));
            renderAttendanceTable(dailyAtt, dailyAbs, targetDateStr);
        } else if (currentAttendanceMode === 'weekly') {
            const dObj = new Date(currentDate); let dayOfWeek = dObj.getDay(); if (dayOfWeek === 0) dayOfWeek = 7;
            const startOfWeek = new Date(dObj); startOfWeek.setDate(dObj.getDate() - dayOfWeek + 1); const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
            const startStr = formatDateStr(startOfWeek); const endStr = formatDateStr(endOfWeek);

            const qAtt = query(jelenletRef, where("date", ">=", toDbDate(startStr)), where("date", "<=", toDbDate(endStr)));
            const snapAtt = await getDocs(qAtt);
            const weekAtt = []; snapAtt.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); weekAtt.push({ id: d.id, ...data }); });

            const qAbs = query(tavolletekRef, where("datum", ">=", startStr), where("datum", "<=", endStr)); const snapAbs = await getDocs(qAbs); const weekAbs = []; snapAbs.forEach(d => weekAbs.push({ id: d.id, ...d.data() }));
            renderWeeklyAttendanceTable(weekAtt, weekAbs, startOfWeek);
        }
    } catch (err) {
        console.error("HIBA A JELENLÉT LEKÉRDEZÉSKOR:", err);
        if (currentAttendanceMode === 'daily' && tbodyDaily) tbodyDaily.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-red-500">Hiba a betöltéskor: ${err.message}</td></tr>`;
        else if (currentAttendanceMode === 'weekly' && tbodyWeekly) tbodyWeekly.innerHTML = `<tr><td colspan="8" class="py-12 text-center text-red-500">Hiba a betöltéskor: ${err.message}</td></tr>`;
    }
}

function renderAttendanceTable(attData, absData, targetDateStr) {
    const tbody = document.getElementById("attendance-table-body"); if (!tbody) return; tbody.innerHTML = "";
    const activeEmp = allEmployees.filter(e => e.status === "Aktív").sort((a, b) => a.name.localeCompare(b.name));
    if (activeEmp.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">Nincs aktív dolgozó.</td></tr>`; return; }

    const isPast = targetDateStr < formatDateStr(new Date());
    activeEmp.forEach(emp => {
        try {
            const tr = document.createElement("tr");
            tr.className = "cursor-pointer hover:bg-gray-50 transition-colors";

            const absence = absData.find(a => a.dolgozoId === emp.id);
            const att = attData.find(a => a.name === emp.name);

            tr.onclick = (e) => {
                if (e.target.closest("button")) return;
                if (window.isEditModeActive) {
                    handleAttEditClick(tr, emp.id, emp.name, targetDateStr, absence ? 'true' : 'false', att ? att.arrival : "", att ? att.departure : "", att ? att.id : null);
                } else {
                    openWorkerProfile(emp.id, emp.name, getCardNumberByUid(emp.nfc), emp.status);
                }
            };

            const initials = emp.name.substring(0, 2).toUpperCase();
            let arrivalText = "-"; let departureText = "-"; let statusHtml = "";

            if (absence) {
                const colorClass = absenceColors[absence.tipus] || absenceColors["Alapértelmezett"];
                statusHtml = `<span class="px-3 py-1 bg-white rounded-full text-sm font-medium border ${colorClass}">${absence.tipus}</span>`;
                if (att) { arrivalText = att.arrival; departureText = att.departure || "-"; }
            } else if (att) {
                arrivalText = att.arrival; departureText = att.departure && att.departure !== "-" ? att.departure : "-";
                if (departureText === "-") statusHtml = `<span class="px-2.5 py-1 rounded-full text-sm text-green-700 bg-green-50 border border-green-200">Jelen van</span>`;
                else statusHtml = `<span class="px-2.5 py-1 rounded-full text-sm text-gray-700 bg-gray-100 border border-gray-200">Eltávozott</span>`;
            } else {
                if (isPast) statusHtml = `<span class="px-2.5 py-1 rounded-full text-sm text-red-700 bg-red-50 border border-red-200">Hiányzik</span>`;
                else statusHtml = `<span class="px-2.5 py-1 rounded-full text-sm text-gray-500 bg-gray-50 border border-gray-200">Nincs adat</span>`;
            }
            tr.innerHTML = `<td class="py-4 px-6 border-b border-gray-50 font-medium"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-sm">${initials}</div><span>${emp.name}</span></div></td><td class="py-4 px-6 border-b border-gray-50">${arrivalText}</td><td class="py-4 px-6 border-b border-gray-50">${departureText}</td><td class="py-4 px-6 border-b border-gray-50">${statusHtml}</td>`;

            if (window.isBulkModeActive && window.selectedCells.some(c => c.empId === emp.id && c.dateStr === targetDateStr)) {
                tr.classList.add('outline', 'outline-4', 'outline-blue-500', '-outline-offset-2', 'bg-blue-100/50');
            }

            tbody.appendChild(tr);
        } catch (e) { console.error("Hiba a napi sor renderelésekor", e); }
    });
}

function renderWeeklyAttendanceTable(weeklyAttendance, weeklyAbsences, startOfWeekObj) {
    const tbody = document.getElementById("attendance-table-weekly-body"); if (!tbody) return; tbody.innerHTML = "";
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeekObj); d.setDate(d.getDate() + i);
        const span = document.getElementById(`th-week-${i + 1}`); if (span) span.textContent = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`;
    }
    const activeEmp = allEmployees.filter(e => e.status === "Aktív"); if (activeEmp.length === 0) return;
    const attMap = {}; const absMap = {};
    weeklyAttendance.forEach(a => { const e = allEmployees.find(e => e.name === a.name); if (e) { if (!attMap[e.id]) attMap[e.id] = {}; attMap[e.id][a.date] = a; } });
    weeklyAbsences.forEach(a => { if (!absMap[a.dolgozoId]) absMap[a.dolgozoId] = {}; absMap[a.dolgozoId][a.datum] = a; });

    activeEmp.forEach(d => {
        try {
            const tr = document.createElement("tr"); tr.className = "cursor-pointer hover:bg-blue-50 transition-colors group";
            tr.onclick = () => { if (!window.isEditModeActive) openWorkerProfile(d.id, d.name, getCardNumberByUid(d.nfc), d.status); };
            const initials = d.name.substring(0, 2).toUpperCase();
            let html = `<td class="py-3 px-4 border-b border-gray-50 bg-white sticky left-0 z-10 border-r border-gray-100"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">${initials}</div><span class="font-bold text-gray-800 text-xs">${d.name}</span></div></td>`;
            for (let i = 0; i < 7; i++) {
                const dateObj = new Date(startOfWeekObj); dateObj.setDate(dateObj.getDate() + i); const dateStr = formatDateStr(dateObj);
                const isWeekend = (i === 5 || i === 6); const isToday = dateStr === formatDateStr(new Date());
                const att = attMap[d.id] && attMap[d.id][dateStr]; const abs = absMap[d.id] && absMap[d.id][dateStr];
                let cellBg = isWeekend ? "bg-gray-50" : ""; if (isToday) cellBg = "bg-amber-50 ring-1 ring-inset ring-amber-400";

                let extraClass = "";
                if (window.isBulkModeActive && window.selectedCells.some(c => c.empId === d.id && c.dateStr === dateStr)) {
                    extraClass = "outline outline-4 outline-blue-500 -outline-offset-2 bg-blue-100/50";
                }
                const clickLogic = `if(window.isEditModeActive) { event.stopPropagation(); window.handleAttEditClick(this, '${d.id}', '${d.name.replace(/'/g, "\\'")}', '${dateStr}', '${!!abs}', '${att ? att.arrival : ''}', '${att ? att.departure : ''}', '${att ? att.id : ''}'); }`;

                let cellContent = "";
                if (abs) {
                    const colorClass = absenceColors[abs.tipus] || absenceColors["Alapértelmezett"];
                    cellContent = `<div class="flex items-center justify-center h-full w-full"><span class="block text-center px-1 py-1.5 rounded text-[10px] font-bold border ${colorClass} uppercase truncate max-w-[80px] w-full">${abs.tipus}</span></div>`;
                } else if (att) {
                    const arr = att.arrival; const dep = att.departure || "-";
                    let t = `<span class="text-green-600 font-bold">${arr}</span>`; if (dep !== "-") t += ` | <span class="text-gray-600">${dep}</span>`;
                    const workedHours = calculateSmartHours(arr, dep);
                    cellContent = `<div class="flex items-center justify-center h-full w-full"><div class="bg-white px-1.5 py-0.5 rounded border border-gray-100 text-[10px] w-full">${t}<br><span class="font-black text-gray-800">${workedHours}</span></div></div>`;
                } else {
                    if (dateObj < new Date() && !isWeekend) cellContent = `<div class="flex items-center justify-center h-full w-full"><span class="text-[9px] text-red-300 font-bold uppercase">Hiányzik</span></div>`;
                    else cellContent = `<div class="flex items-center justify-center h-full w-full"><span class="text-gray-300">-</span></div>`;
                }
                html += `<td class="py-2 px-1 text-center border-b border-gray-50 border-r border-gray-100 ${cellBg} ${extraClass} min-w-[100px] align-middle" onclick="${clickLogic}">${cellContent}</td>`;
            }
            tr.innerHTML = html; tbody.appendChild(tr);
        } catch (e) { console.error("Hiba a heti sor renderelésekor", e); }
    });
}

// TÁVOLLÉTEK LOGIKA ÉS SZERKESZTÉS/TÖRLÉS
const absenceSettings = {
    "Szabadság": { color: "bg-green-100 text-green-800 border-green-200", short: "SZ" },
    "Táppénz": { color: "bg-yellow-100 text-yellow-800 border-yellow-200", short: "T" },
    "Betegszabadság": { color: "bg-orange-100 text-orange-800 border-orange-200", short: "BSZ" },
    "Fizetett ünnep": { color: "bg-blue-100 text-blue-800 border-blue-200", short: "FÜ" },
    "Fizetés nélküli szabadság": { color: "bg-purple-100 text-purple-800 border-purple-200", short: "FN" },
    "Igazolt nem fizetett távollét": { color: "bg-gray-100 text-gray-800 border-gray-200", short: "NF" },
    "Igazolt fizetett távollét": { color: "bg-cyan-100 text-cyan-800 border-cyan-200", short: "IF" },
    "Kiküldetés": { color: "bg-indigo-100 text-indigo-800 border-indigo-200", short: "K" },
    "Alapértelmezett": { color: "bg-gray-100 text-gray-800 border-gray-200", short: "Egyéb" }
};
const absenceColors = new Proxy(absenceSettings, { get: function (target, prop) { if (target[prop]) return target[prop].color; return target["Alapértelmezett"].color; } });

const formAbsence = document.getElementById('form-absence');
if (formAbsence) {
    formAbsence.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectEmp = document.getElementById('abs-employee');
        const start = new Date(document.getElementById('abs-date-start').value); const end = new Date(document.getElementById('abs-date-end').value);
        const tipus = document.getElementById('abs-type').value;
        if (start > end) { alert("Hibás dátumok!"); return; }
        const btn = formAbsence.querySelector('button[type="submit"]'); const orig = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

        try {
            let curr = new Date(start);
            while (curr <= end) { await addDoc(tavolletekRef, { dolgozoId: selectEmp.value, dolgozoNeve: selectEmp.options[selectEmp.selectedIndex].dataset.name, datum: curr.toISOString().split('T')[0], tipus: tipus, createdAt: serverTimestamp() }); curr.setDate(curr.getDate() + 1); }
            formAbsence.reset();
            fetchAndRenderWarnings(); // Frissíti a figyelmeztetéseket ha kell
        } catch (err) { alert("Hiba!"); } finally { btn.innerHTML = orig; btn.disabled = false; }
    });
}

function groupAbsences(tavData) {
    if (!tavData || tavData.length === 0) return [];
    const groupedMap = {};
    tavData.forEach(item => {
        const key = `${item.dolgozoId}_${item.tipus}`;
        if (!groupedMap[key]) groupedMap[key] = { dolgozoId: item.dolgozoId, dolgozoNeve: item.dolgozoNeve, tipus: item.tipus, dates: [] };
        groupedMap[key].dates.push(item.datum);
    });
    const result = [];
    Object.values(groupedMap).forEach(group => {
        const sorted = group.dates.sort((a, b) => new Date(a) - new Date(b)); let start = sorted[0], end = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            const d1 = new Date(end); const d2 = new Date(sorted[i]);
            if (Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) === 1) end = sorted[i];
            else { result.push({ dolgozoId: group.dolgozoId, dolgozoNeve: group.dolgozoNeve, tipus: group.tipus, start: start, end: end }); start = sorted[i]; end = sorted[i]; }
        }
        result.push({ dolgozoId: group.dolgozoId, dolgozoNeve: group.dolgozoNeve, tipus: group.tipus, start: start, end: end });
    });
    return result.sort((a, b) => new Date(b.start) - new Date(a.start));
}

let allAbsencesRaw = [];
let searchAbsenceText = "";
let showPastAbsences = false;
let activeTypeFilters = [];

document.getElementById('absences-search')?.addEventListener('input', (e) => { searchAbsenceText = e.target.value.toLowerCase(); renderAbsencesTable(allAbsencesRaw); });
document.getElementById('toggle-past-absences')?.addEventListener('change', (e) => { showPastAbsences = e.target.checked; renderAbsencesTable(allAbsencesRaw); });

const menuAbsBtn = document.getElementById('menu-absences');
if (menuAbsBtn) {
    menuAbsBtn.addEventListener('click', () => {
        activeTypeFilters = [];
        document.getElementById('absences-search').value = "";
        searchAbsenceText = "";
        generateFilterButtons();
        renderAbsencesTable(allAbsencesRaw);
    });
}

function generateFilterButtons() {
    const container = document.getElementById('absence-type-filters');
    if (!container) return;
    container.innerHTML = "";

    const types = Object.keys(absenceSettings).filter(k => k !== "Alapértelmezett");

    types.forEach(type => {
        const btn = document.createElement('button');
        const isActive = activeTypeFilters.includes(type);

        if (isActive) {
            btn.className = `px-3 py-1 text-xs font-bold rounded-full border-2 transition-all ${absenceSettings[type].color}`;
        } else {
            btn.className = `px-3 py-1 text-xs font-medium rounded-full border-2 border-gray-200 text-gray-500 bg-white hover:bg-gray-50 transition-all`;
        }
        btn.textContent = type;

        btn.onclick = () => {
            if (isActive) {
                activeTypeFilters = activeTypeFilters.filter(t => t !== type);
            } else {
                activeTypeFilters.push(type);
            }
            generateFilterButtons();
            renderAbsencesTable(allAbsencesRaw);
        };
        container.appendChild(btn);
    });
}

function renderAbsencesTable(docs) {
    allAbsencesRaw = docs;
    generateFilterButtons();

    const tbody = document.getElementById("absences-table-body"); if (!tbody) return; tbody.innerHTML = "";
    const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);

    const filtered = groupAbsences(docs).filter(abs => {
        const isPast = new Date(abs.end) < todayObj;
        if (showPastAbsences && !isPast) return false;
        if (!showPastAbsences && isPast) return false;
        if (activeTypeFilters.length > 0 && !activeTypeFilters.includes(abs.tipus)) return false;
        if (searchAbsenceText) { if (!abs.dolgozoNeve.toLowerCase().includes(searchAbsenceText) && !abs.tipus.toLowerCase().includes(searchAbsenceText)) return false; }
        return true;
    });

    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-gray-500">Nincs a szűrésnek megfelelő adat.</td></tr>`; return; }

    filtered.forEach(g => {
        const tr = document.createElement("tr"); tr.className = "cursor-pointer hover:bg-gray-50 transition-colors";
        const emp = allEmployees.find(e => e.id === g.dolgozoId) || { nfc: "-", status: "Ismeretlen" };
        tr.onclick = (e) => { if (e.target.closest("button")) return; openWorkerProfile(g.dolgozoId, g.dolgozoNeve, getCardNumberByUid(emp.nfc), emp.status); };

        const colorClass = absenceColors[g.tipus] || absenceColors["Alapértelmezett"];
        const dispDate = g.start === g.end ? g.start.replace(/-/g, '.') : `${g.start.replace(/-/g, '.')} - ${g.end.replace(/-/g, '.')}`;
        tr.innerHTML = `<td class="py-4 px-6 border-b border-gray-50 font-medium">${g.dolgozoNeve}</td><td class="py-4 px-6 border-b border-gray-50">${dispDate}</td><td class="py-4 px-6 border-b border-gray-50"><span class="px-3 py-1 rounded-full text-sm border ${colorClass}">${g.tipus}</span></td><td class="py-4 px-6 border-b border-gray-50 text-center"><button class="text-gray-400 hover:text-blue-500 mx-1 btn-edit-absence" data-empid="${g.dolgozoId}" data-empname="${g.dolgozoNeve}" data-start="${g.start}" data-end="${g.end}" data-type="${g.tipus}"><i class="fas fa-edit"></i></button><button class="text-gray-400 hover:text-red-500 mx-1 btn-delete-absence" data-empid="${g.dolgozoId}" data-start="${g.start}" data-end="${g.end}" data-type="${g.tipus}"><i class="fas fa-trash-alt"></i></button></td>`;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-delete-absence').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const { empid, start, end, type } = e.currentTarget.dataset;
            const result = await Swal.fire({ title: 'Törlés', text: "Biztosan törlöd?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Igen' });
            if (result.isConfirmed) {
                try {
                    const qDel = query(tavolletekRef, where("dolgozoId", "==", empid));
                    const snap = await getDocs(qDel); const p = [];
                    snap.forEach(d => { const data = d.data(); if (data.tipus === type && data.datum >= start && data.datum <= end) p.push(deleteDoc(d.ref)); });
                    await Promise.all(p); Swal.fire('Törölve!', '', 'success');
                    fetchAndRenderWarnings();
                } catch (err) { console.error(err); Swal.fire('Hiba!', 'Sikertelen törlés.', 'error'); }
            }
        });
    });

    document.querySelectorAll('.btn-edit-absence').forEach(btn => { btn.addEventListener('click', (e) => { const { empid, empname, start, end, type } = e.currentTarget.dataset; openEditAbsenceModal(empid, empname, start, end, type); }); });
}

function setupAbsencesListener() { onSnapshot(query(tavolletekRef), (snap) => { const d = []; snap.forEach(doc => d.push({ id: doc.id, ...doc.data() })); d.sort((a, b) => b.datum.localeCompare(a.datum)); renderAbsencesTable(d); }); }

// Edit Absence Modal
const modalEditAbsence = document.getElementById('modal-edit-absence');
const formEditAbsence = document.getElementById('form-edit-absence');
window.openEditAbsenceModal = function (empid, empname, start, end, type) {
    if (!modalEditAbsence) return;
    document.getElementById('edit-abs-employee-id').value = empid; document.getElementById('edit-abs-employee-name').value = empname; document.getElementById('edit-abs-date-start').value = start; document.getElementById('edit-abs-date-end').value = end; document.getElementById('edit-abs-type').value = type; document.getElementById('edit-abs-old-start').value = start; document.getElementById('edit-abs-old-end').value = end; document.getElementById('edit-abs-old-type').value = type;
    document.getElementById('modal-overlay').classList.remove('hidden', 'opacity-0'); modalEditAbsence.classList.remove('hidden'); document.getElementById('modal-edit-absence-content').classList.remove('opacity-0', 'scale-95'); document.getElementById('modal-edit-absence-content').classList.add('opacity-100', 'scale-100');
}
function closeEditAbsModal() { document.getElementById('modal-overlay').classList.add('opacity-0'); document.getElementById('modal-edit-absence-content').classList.add('opacity-0', 'scale-95'); setTimeout(() => { document.getElementById('modal-overlay').classList.add('hidden'); modalEditAbsence.classList.add('hidden'); }, 300); }
document.getElementById('btn-close-edit-abs-modal')?.addEventListener('click', closeEditAbsModal); document.getElementById('btn-cancel-edit-abs-modal')?.addEventListener('click', closeEditAbsModal);

if (formEditAbsence) {
    formEditAbsence.addEventListener('submit', async (e) => {
        e.preventDefault();
        const empid = document.getElementById('edit-abs-employee-id').value; const name = document.getElementById('edit-abs-employee-name').value; const nStart = document.getElementById('edit-abs-date-start').value; const nEnd = document.getElementById('edit-abs-date-end').value; const nType = document.getElementById('edit-abs-type').value;
        const oStart = document.getElementById('edit-abs-old-start').value; const oEnd = document.getElementById('edit-abs-old-end').value; const oType = document.getElementById('edit-abs-old-type').value;
        if (new Date(nStart) > new Date(nEnd)) { alert("Hibás dátum!"); return; }
        const btn = formEditAbsence.querySelector('button[type="submit"]'); const orig = btn.innerHTML; btn.innerHTML = 'Mentés...'; btn.disabled = true;

        try {
            const qDel = query(tavolletekRef, where("dolgozoId", "==", empid));
            const snap = await getDocs(qDel); const p = [];
            snap.forEach(d => { const data = d.data(); if (data.tipus === oType && data.datum >= oStart && data.datum <= oEnd) p.push(deleteDoc(d.ref)); });
            await Promise.all(p);
            let curr = new Date(nStart); const endD = new Date(nEnd);
            while (curr <= endD) { await addDoc(tavolletekRef, { dolgozoId: empid, dolgozoNeve: name, datum: curr.toISOString().split('T')[0], tipus: nType, createdAt: serverTimestamp() }); curr.setDate(curr.getDate() + 1); }
            closeEditAbsModal();
            fetchAndRenderWarnings();
        } catch (err) { console.error(err); alert("Hiba a mentés során!"); } finally { btn.innerHTML = orig; btn.disabled = false; }
    });
}

// HAVI ÖSSZES MÁTRIX TÁBLÁZAT LOGIKA (ÖSSZESÍTŐ SORRAL) ÉS JELMAGYARÁZAT
const monthlyAllMonthInput = document.getElementById('att-monthly-all-month');
if (monthlyAllMonthInput) {
    const now = new Date();
    monthlyAllMonthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthlyAllMonthInput.addEventListener('change', (e) => { if (e.target.value) renderMonthlyAllTable(e.target.value); });
}

async function renderMonthlyAllTable(monthStr) {
    if (!monthStr) {
        const input = document.getElementById('att-monthly-all-month');
        if (!input || !input.value) return;
        monthStr = input.value;
    }

    const loading = document.getElementById('att-monthly-all-loading');
    const thead = document.getElementById('att-monthly-all-thead');
    const tbody = document.getElementById('att-monthly-all-tbody');
    if (!thead || !tbody) return;

    if (loading) loading.classList.remove('hidden');
    thead.innerHTML = ''; tbody.innerHTML = '';

    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    try {
        const activeEmp = allEmployees.filter(e => e.status === "Aktív").sort((a, b) => a.name.localeCompare(b.name));
        if (activeEmp.length === 0) {
            tbody.innerHTML = '<tr><td colspan="99" class="py-12 text-center text-gray-500">Nincs aktív dolgozó.</td></tr>';
            if (loading) loading.classList.add('hidden');
            return;
        }

        const [snapJ, snapT] = await Promise.all([
            getDocs(query(jelenletRef, where("date", ">=", toDbDate(startStr)), where("date", "<=", toDbDate(endStr)))),
            getDocs(query(tavolletekRef, where("datum", ">=", startStr), where("datum", "<=", endStr)))
        ]);

        const jelArr = []; snapJ.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); jelArr.push({ id: d.id, ...data }); });
        const tavArr = []; snapT.forEach(d => tavArr.push(d.data()));

        let headerHtml = '<tr class="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px] uppercase tracking-wider">';
        headerHtml += '<th class="py-3 px-3 font-bold sticky left-0 z-10 bg-gray-50 border-r border-gray-200 min-w-[160px]">Név</th>';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            headerHtml += `<th class="py-3 px-1 font-bold text-center min-w-[60px] ${isWknd ? 'bg-gray-100 text-gray-400' : ''}">${d}</th>`;
        }
        headerHtml += '<th class="py-3 px-2 font-bold text-center bg-blue-50 border-l-2 border-blue-200 min-w-[50px]">Munka</th>';
        headerHtml += '<th class="py-3 px-2 font-bold text-center bg-green-50 min-w-[40px]">SZ</th>';
        headerHtml += '<th class="py-3 px-2 font-bold text-center bg-yellow-50 min-w-[40px]">T</th>';
        headerHtml += '<th class="py-3 px-2 font-bold text-center bg-orange-50 min-w-[40px]">BSZ</th>';
        headerHtml += '<th class="py-3 px-2 font-bold text-center bg-blue-50 min-w-[40px]">FÜ</th>';
        headerHtml += '<th class="py-3 px-2 font-bold text-center bg-purple-50 min-w-[40px]">FN</th>';
        headerHtml += '<th class="py-3 px-2 font-bold text-center bg-cyan-50 min-w-[40px]">IF</th>';
        headerHtml += '</tr>';
        thead.innerHTML = headerHtml;

        const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);

        let grandTotals = { munka: 0, sz: 0, t: 0, bsz: 0, fu: 0, fn: 0, ip: 0 };

        activeEmp.forEach(emp => {
            let stats = { munka: 0, sz: 0, t: 0, bsz: 0, fu: 0, fn: 0, ip: 0 };

            let rowHtml = `<tr class="cursor-pointer hover:bg-blue-50/50 transition-colors border-b border-gray-100 group" onclick="if(!window.isEditModeActive) openWorkerProfile('${emp.id}', '${emp.name.replace(/'/g, "\\'")}', '${getCardNumberByUid(emp.nfc).replace(/'/g, "\\'")}', '${emp.status}')">`;
            const initials = emp.name.split(" ").map(n => n.charAt(0)).join("").toUpperCase().substring(0, 2);
            rowHtml += `<td class="py-2 px-3 font-bold text-gray-800 text-xs sticky left-0 z-10 bg-white border-r border-gray-200"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px]">${initials}</div><span class="truncate">${emp.name}</span></div></td>`;

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dateObj = new Date(year, month - 1, d);
                const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isToday = dateObj.getTime() === todayObj.getTime();
                const isPast = dateObj < todayObj;

                const tav = tavArr.find(t => t.dolgozoId === emp.id && t.datum === dateStr);
                const att = jelArr.find(j => j.name === emp.name && j.date === dateStr);

                let cellBg = isWknd ? 'bg-gray-50' : '';
                if (isToday) cellBg = 'bg-amber-50 ring-1 ring-inset ring-amber-300';

                let extraClass = "";
                if (window.isBulkModeActive && window.selectedCells.some(c => c.empId === emp.id && c.dateStr === dateStr)) {
                    extraClass = "outline outline-4 outline-blue-500 -outline-offset-2 bg-blue-100/50";
                }

                const clickLogic = `if(window.isEditModeActive) { event.stopPropagation(); window.handleAttEditClick(this, '${emp.id}', '${emp.name.replace(/'/g, "\\'")}', '${dateStr}', '${!!tav}', '${att ? att.arrival : ''}', '${att ? att.departure : ''}', '${att ? att.id : ''}'); }`;
                let cellContent = '';

                if (tav) {
                    const s = absenceSettings[tav.tipus] || absenceSettings["Alapértelmezett"];
                    cellContent = `<span class="block px-1 py-0.5 rounded text-[9px] font-black border ${s.color} text-center">${s.short}</span>`;
                    if (tav.tipus === "Szabadság") stats.sz++;
                    else if (tav.tipus === "Táppénz") stats.t++;
                    else if (tav.tipus === "Betegszabadság") stats.bsz++;
                    else if (tav.tipus === "Fizetett ünnep") stats.fu++;
                    else if (tav.tipus === "Fizetés nélküli szabadság") stats.fn++;
                    else if (tav.tipus === "Igazolt fizetett távollét") stats.ip++;
                } else if (att) {
                    stats.munka++;
                    const dep = att.departure && att.departure !== "-" ? att.departure : "";
                    cellContent = `<div class="text-[9px] text-center leading-tight"><span class="text-green-600 font-bold">${att.arrival}</span>${dep ? '<br><span class="text-gray-500">' + dep + '</span>' : ''}</div>`;
                } else {
                    if (isPast && !isWknd) cellContent = '<span class="text-[9px] text-red-300 font-bold">-</span>';
                    else cellContent = '<span class="text-gray-300 text-xs">-</span>';
                }

                rowHtml += `<td class="py-1 px-1.5 text-center border-r border-gray-50 ${cellBg} ${extraClass} align-middle hover:bg-blue-100/50" onclick="${clickLogic}">${cellContent}</td>`;
            }

            grandTotals.munka += stats.munka; grandTotals.sz += stats.sz; grandTotals.t += stats.t; grandTotals.bsz += stats.bsz; grandTotals.fu += stats.fu; grandTotals.fn += stats.fn; grandTotals.ip += stats.ip;

            rowHtml += `<td class="py-1 px-2 text-center font-bold text-sm text-blue-700 bg-blue-50/50 border-l-2 border-blue-200">${stats.munka}</td>`;
            rowHtml += `<td class="py-1 px-2 text-center font-bold text-sm text-green-700 bg-green-50/50">${stats.sz}</td>`;
            rowHtml += `<td class="py-1 px-2 text-center font-bold text-sm text-yellow-700 bg-yellow-50/50">${stats.t}</td>`;
            rowHtml += `<td class="py-1 px-2 text-center font-bold text-sm text-orange-700 bg-orange-50/50">${stats.bsz}</td>`;
            rowHtml += `<td class="py-1 px-2 text-center font-bold text-sm text-blue-700 bg-blue-50/50">${stats.fu}</td>`;
            rowHtml += `<td class="py-1 px-2 text-center font-bold text-sm text-purple-700 bg-purple-50/50">${stats.fn}</td>`;
            rowHtml += `<td class="py-1 px-2 text-center font-bold text-sm text-cyan-700 bg-cyan-50/50">${stats.ip}</td>`;
            rowHtml += '</tr>';
            tbody.innerHTML += rowHtml;
        });

        let totalRowHtml = `<tr class="bg-blue-50/80 border-t-2 border-blue-300">`;
        totalRowHtml += `<td class="py-2 px-3 font-bold text-right text-blue-900 uppercase tracking-wider text-xs sticky left-0 z-10 bg-blue-50/80 border-r border-blue-200">Összesítve:</td>`;
        totalRowHtml += `<td colspan="${daysInMonth}" class="bg-blue-50/80"></td>`;
        totalRowHtml += `<td class="py-2 px-2 text-center font-bold text-xs text-blue-800 bg-blue-100/50 border-l-2 border-blue-300">${grandTotals.munka}</td>`;
        totalRowHtml += `<td class="py-2 px-2 text-center font-bold text-xs text-green-800 bg-green-100/50">${grandTotals.sz}</td>`;
        totalRowHtml += `<td class="py-2 px-2 text-center font-bold text-xs text-yellow-800 bg-yellow-100/50">${grandTotals.t}</td>`;
        totalRowHtml += `<td class="py-2 px-2 text-center font-bold text-xs text-orange-800 bg-orange-100/50">${grandTotals.bsz}</td>`;
        totalRowHtml += `<td class="py-2 px-2 text-center font-bold text-xs text-blue-800 bg-blue-100/50">${grandTotals.fu}</td>`;
        totalRowHtml += `<td class="py-2 px-2 text-center font-bold text-xs text-purple-800 bg-purple-100/50">${grandTotals.fn}</td>`;
        totalRowHtml += `<td class="py-2 px-2 text-center font-bold text-xs text-cyan-800 bg-cyan-100/50">${grandTotals.ip}</td>`;
        totalRowHtml += `</tr>`;
        tbody.innerHTML += totalRowHtml;

        // JELMAGYARÁZAT GENERÁLÁSA A HAVI ÖSSZES NÉZET ALATT
        const legendContainer = document.getElementById('att-monthly-legend');
        if (legendContainer) {
            let legHtml = Object.entries(absenceSettings).filter(([k]) => k !== "Alapértelmezett" && k !== "Kiküldetés").map(([k, v]) => `<div class="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"><span class="w-3 h-3 rounded-sm ${v.color.split(' ').find(c => c.startsWith('bg-'))}"></span><span class="text-[10px] font-bold text-gray-700">${k} (${v.short})</span></div>`).join('');
            legHtml += `<div class="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"><span class="w-3 h-3 rounded-sm bg-green-50 border border-green-200"></span><span class="text-[10px] font-bold text-gray-700">Jelen van</span></div>`;
            legHtml += `<div class="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"><span class="w-3 h-3 rounded-sm bg-red-50 border border-red-200"></span><span class="text-[10px] font-bold text-gray-700">Igazolatlan hiányzás (X)</span></div>`;
            legendContainer.innerHTML = legHtml;
        }

    } catch (err) {
        console.error("Hiba a Havi Összes mátrix generálásakor:", err);
        tbody.innerHTML = '<tr><td colspan="99" class="py-8 text-center text-red-500">Hiba történt az adatok betöltésekor.</td></tr>';
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

// SZÍNES EXCEL EXPORT LOGIKA (STÍLUSOKKAL ÉS STATISZTIKÁVAL)
const btnExportExcel = document.getElementById('btn-export-excel');
if (btnExportExcel) {
    btnExportExcel.addEventListener('click', async () => {
        const mStr = document.getElementById('export-month').value;
        if (!mStr) return;
        const [year, month] = mStr.split('-');
        btnExportExcel.disabled = true;
        const origContent = btnExportExcel.innerHTML;
        btnExportExcel.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Generálás...</span>';

        try {
            const lastDay = new Date(year, month, 0).getDate();
            const startStr = `${year}-${month}-01`;
            const endStr = `${year}-${month}-${lastDay}`;
            const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);

            const activeEmp = allEmployees.filter(e => e.status === "Aktív").sort((a, b) => a.name.localeCompare(b.name));
            const qJel = query(jelenletRef, where("date", ">=", toDbDate(startStr)), where("date", "<=", toDbDate(endStr)));
            const sj = await getDocs(qJel); const jelArr = []; sj.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); jelArr.push(data); });

            const qTav = query(tavolletekRef, where("datum", ">=", startStr), where("datum", "<=", endStr));
            const st = await getDocs(qTav); const tavArr = []; st.forEach(d => tavArr.push(d.data()));

            const matrix = [];

            const borderStyle = { top: { style: 'thin', color: { rgb: "CCCCCC" } }, bottom: { style: 'thin', color: { rgb: "CCCCCC" } }, left: { style: 'thin', color: { rgb: "CCCCCC" } }, right: { style: 'thin', color: { rgb: "CCCCCC" } } };
            const headStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A8A" } }, alignment: { horizontal: "center", vertical: "center" }, border: borderStyle };
            const nameStyle = { font: { bold: true }, alignment: { vertical: "center" }, border: borderStyle };
            const weekendStyle = { fill: { fgColor: { rgb: "F3F4F6" } }, border: borderStyle, alignment: { horizontal: "center", vertical: "center" } };
            const baseCellStyle = { border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

            const excelColors = {
                "Szabadság": { fill: { fgColor: { rgb: "DCFCE7" } }, font: { color: { rgb: "166534" }, bold: true } },
                "Táppénz": { fill: { fgColor: { rgb: "FEF9C3" } }, font: { color: { rgb: "854D0E" }, bold: true } },
                "Betegszabadság": { fill: { fgColor: { rgb: "FFEDD5" } }, font: { color: { rgb: "9A3412" }, bold: true } },
                "Fizetett ünnep": { fill: { fgColor: { rgb: "DBEAFE" } }, font: { color: { rgb: "1E40AF" }, bold: true } },
                "Fizetés nélküli szabadság": { fill: { fgColor: { rgb: "F3E8FF" } }, font: { color: { rgb: "6B21A8" }, bold: true } },
                "Igazolt fizetett távollét": { fill: { fgColor: { rgb: "CFFAFE" } }, font: { color: { rgb: "155E75" }, bold: true } },
            };

            const headerRow = [{ v: "Dolgozó Neve", s: headStyle }];
            for (let i = 1; i <= lastDay; i++) {
                const dateObj = new Date(year, month - 1, i);
                const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const hStyle = isWknd ? { ...headStyle, fill: { fgColor: { rgb: "374151" } } } : headStyle;
                headerRow.push({ v: i.toString(), s: hStyle });
            }
            ["Munka", "SZ", "T", "BSZ", "FÜ", "FN", "IF"].forEach(t => headerRow.push({ v: t, s: { ...headStyle, fill: { fgColor: { rgb: "0F172A" } } } }));
            matrix.push(headerRow);

            let grandTotals = { munka: 0, sz: 0, t: 0, bsz: 0, fu: 0, fn: 0, ip: 0 };

            activeEmp.forEach(emp => {
                const row = [{ v: emp.name, s: nameStyle }];
                let stats = { munka: 0, sz: 0, t: 0, bsz: 0, fu: 0, fn: 0, ip: 0 };

                for (let i = 1; i <= lastDay; i++) {
                    const dStr = `${year}-${month}-${String(i).padStart(2, '0')}`;
                    const dObj = new Date(year, month - 1, i);
                    const isWknd = dObj.getDay() === 0 || dObj.getDay() === 6;
                    const isPast = dObj < todayObj;

                    const tav = tavArr.find(t => t.dolgozoId === emp.id && t.datum === dStr);
                    const att = jelArr.find(j => j.name === emp.name && j.date === dStr);

                    let cellVal = ""; let cellStyle = { ...baseCellStyle };
                    if (isWknd) cellStyle.fill = weekendStyle.fill;

                    if (tav) {
                        const s = absenceSettings[tav.tipus] || absenceSettings["Alapértelmezett"];
                        cellVal = s.short;
                        if (excelColors[tav.tipus]) { cellStyle.fill = excelColors[tav.tipus].fill; cellStyle.font = excelColors[tav.tipus].font; }
                        if (tav.tipus === "Szabadság") stats.sz++; else if (tav.tipus === "Táppénz") stats.t++; else if (tav.tipus === "Betegszabadság") stats.bsz++; else if (tav.tipus === "Fizetett ünnep") stats.fu++; else if (tav.tipus === "Fizetés nélküli szabadság") stats.fn++; else if (tav.tipus === "Igazolt fizetett távollét") stats.ip++;
                    } else if (att) {
                        stats.munka++;
                        const dep = att.departure && att.departure !== "-" ? att.departure : "";
                        if (dep) {
                            const workedHours = calculateSmartHours(att.arrival, dep);
                            cellVal = `${att.arrival} - ${dep}\n(${workedHours})`;
                        } else cellVal = att.arrival;
                        cellStyle.font = { color: { rgb: "166534" }, bold: true };
                    } else {
                        if (isPast && !isWknd) { cellVal = "X"; cellStyle.font = { color: { rgb: "EF4444" }, bold: true }; }
                        else { cellVal = "-"; cellStyle.font = { color: { rgb: "9CA3AF" } }; }
                    }
                    row.push({ v: cellVal, s: cellStyle });
                }

                grandTotals.munka += stats.munka; grandTotals.sz += stats.sz; grandTotals.t += stats.t; grandTotals.bsz += stats.bsz; grandTotals.fu += stats.fu; grandTotals.fn += stats.fn; grandTotals.ip += stats.ip;

                const statStyle = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: borderStyle };
                row.push({ v: stats.munka, s: { ...statStyle, font: { bold: true, color: { rgb: "1D4ED8" } } } });
                row.push({ v: stats.sz, s: { ...statStyle, font: { bold: true, color: { rgb: "15803D" } } } });
                row.push({ v: stats.t, s: { ...statStyle, font: { bold: true, color: { rgb: "A16207" } } } });
                row.push({ v: stats.bsz, s: { ...statStyle, font: { bold: true, color: { rgb: "C2410C" } } } });
                row.push({ v: stats.fu, s: { ...statStyle, font: { bold: true, color: { rgb: "1D4ED8" } } } });
                row.push({ v: stats.fn, s: { ...statStyle, font: { bold: true, color: { rgb: "7E22CE" } } } });
                row.push({ v: stats.ip, s: { ...statStyle, font: { bold: true, color: { rgb: "0E7490" } } } });
                matrix.push(row);
            });

            const totalRowStyle = { font: { bold: true, color: { rgb: "1E3A8A" } }, fill: { fgColor: { rgb: "DBEAFE" } }, border: borderStyle, alignment: { vertical: "center", horizontal: "right" } };
            const totalStatStyleObj = { font: { bold: true }, fill: { fgColor: { rgb: "DBEAFE" } }, border: borderStyle, alignment: { horizontal: "center", vertical: "center" } };

            const finalRow = [{ v: "ÖSSZESEN:", s: totalRowStyle }];
            for (let i = 1; i <= lastDay; i++) finalRow.push({ v: "", s: totalRowStyle });

            finalRow.push({ v: grandTotals.munka, s: { ...totalStatStyleObj, font: { bold: true, color: { rgb: "1D4ED8" } } } });
            finalRow.push({ v: grandTotals.sz, s: { ...totalStatStyleObj, font: { bold: true, color: { rgb: "15803D" } } } });
            finalRow.push({ v: grandTotals.t, s: { ...totalStatStyleObj, font: { bold: true, color: { rgb: "A16207" } } } });
            finalRow.push({ v: grandTotals.bsz, s: { ...totalStatStyleObj, font: { bold: true, color: { rgb: "C2410C" } } } });
            finalRow.push({ v: grandTotals.fu, s: { ...totalStatStyleObj, font: { bold: true, color: { rgb: "1D4ED8" } } } });
            finalRow.push({ v: grandTotals.fn, s: { ...totalStatStyleObj, font: { bold: true, color: { rgb: "7E22CE" } } } });
            finalRow.push({ v: grandTotals.ip, s: { ...totalStatStyleObj, font: { bold: true, color: { rgb: "0E7490" } } } });
            matrix.push(finalRow);

            const ws = XLSX.utils.aoa_to_sheet(matrix);

            const colWidths = [{ wch: 22 }];
            for (let i = 1; i <= lastDay; i++) colWidths.push({ wch: 11 });
            for (let i = 0; i < 7; i++) colWidths.push({ wch: 6 });
            ws['!cols'] = colWidths;

            const finalRowIndex = matrix.length - 1;
            if (!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push({ s: { r: finalRowIndex, c: 0 }, e: { r: finalRowIndex, c: lastDay } });

            ws['!freeze'] = { xSplit: 1, ySplit: 1 };

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Jelenleti_Matrix");
            XLSX.writeFile(wb, `Femszer_Jelenleti_Matrix_${year}_${month}.xlsx`);

        } catch (e) {
            console.error("Hiba az Excel exportálásakor:", e);
            Swal.fire('Hiba!', 'Sikertelen exportálás.', 'error');
        } finally {
            btnExportExcel.innerHTML = origContent;
            btnExportExcel.disabled = false;
        }
    });
}

// -------------------------------------------------------------------------------------------------
// KÁRTYA KÓDOK MODAL (SÚGÓ)
// -------------------------------------------------------------------------------------------------
const btnOpenCardsModal = document.getElementById('btn-open-cards-modal');
const modalCards = document.getElementById('modal-card-codes');
const btnCloseCardsTop = document.getElementById('btn-close-cards-modal');
const btnCloseCardsBottom = document.getElementById('btn-close-cards-modal-bottom');

function openCardsModal() {
    const tbody = document.getElementById('card-codes-tbody');
    tbody.innerHTML = '';
    
    for(let i=1; i<=40; i++) {
        if(i === 6) continue;
        const uid = cardMapping[i];
        tbody.innerHTML += `
        <tr class="hover:bg-blue-50 transition-colors">
            <td class="py-2.5 px-6 border-b border-gray-100 font-bold text-gray-700">${i}. kártya</td>
            <td class="py-2.5 px-6 border-b border-gray-100 font-mono text-blue-600 bg-blue-50/30">${uid}</td>
        </tr>`;
    }

    document.getElementById('modal-overlay').classList.remove('hidden', 'opacity-0');
    modalCards.classList.remove('hidden');
    requestAnimationFrame(() => {
        document.getElementById('modal-card-codes-content').classList.remove('opacity-0', 'scale-95');
        document.getElementById('modal-card-codes-content').classList.add('opacity-100', 'scale-100');
    });
}

function closeCardsModal() {
    document.getElementById('modal-overlay').classList.add('opacity-0');
    document.getElementById('modal-card-codes-content').classList.remove('opacity-100', 'scale-100');
    document.getElementById('modal-card-codes-content').classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        document.getElementById('modal-overlay').classList.add('hidden');
        modalCards.classList.add('hidden');
    }, 300);
}

if (btnOpenCardsModal) btnOpenCardsModal.addEventListener('click', openCardsModal);
if (btnCloseCardsTop) btnCloseCardsTop.addEventListener('click', closeCardsModal);
if (btnCloseCardsBottom) btnCloseCardsBottom.addEventListener('click', closeCardsModal);

// -------------------------------------------------------------------------------------------------
// Worker Profile & Calendar Modal 
// -------------------------------------------------------------------------------------------------
const modalWorkerProfile = document.getElementById('modal-worker-profile');
const modalWorkerProfileContent = document.getElementById('modal-worker-profile-content');
const btnCloseWpModal = document.getElementById('btn-close-wp-modal');
const wpName = document.getElementById('wp-name');
const wpNfc = document.getElementById('wp-nfc');
const wpStatus = document.getElementById('wp-status');
const wpMonogram = document.getElementById('wp-monogram');
const wpMonth = document.getElementById('wp-month');
const wpCalendarGrid = document.getElementById('wp-calendar-grid');
const wpCalendarLoading = document.getElementById('wp-calendar-loading');
const wpLegend = document.getElementById('wp-legend');
const wpAbsencesList = document.getElementById('wp-absences-list');

let currentProfileId = null;

window.openWorkerProfile = function (id, name, nfc, status) {
    const emp = allEmployees.find(e => e.id === id);
    if (!emp) return;

    currentProfileId = id;

    wpName.textContent = name;
    wpNfc.textContent = nfc || "-";
    wpMonogram.textContent = name.split(" ").map(n => n.charAt(0)).join("").toUpperCase().substring(0, 2) || "?";

    const isActive = status === "Aktív";
    if (wpStatus) {
        wpStatus.className = isActive
            ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium shadow-sm text-green-700 bg-green-50 border-green-200"
            : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium shadow-sm text-gray-700 bg-gray-100 border-gray-200";
        const dotClass = isActive ? "w-2 h-2 rounded-full bg-green-500" : "w-2 h-2 rounded-full bg-gray-400";
        wpStatus.innerHTML = `<span class="${dotClass} status-dot"></span><span class="status-text">${status}</span>`;
    }

    const nfcHistoryContainer = document.getElementById('wp-nfc-history');
    const oldCards = emp.korabbiKartyak || [];
    if (oldCards.length === 0) {
        nfcHistoryContainer.innerHTML = '<span class="text-sm text-gray-400 italic">Nincs korábbi kártya</span>';
    } else {
        nfcHistoryContainer.innerHTML = oldCards.sort((a, b) => new Date(b.date) - new Date(a.date)).map(c => {
            const dateStr = new Date(c.date).toISOString().split('T')[0].replace(/-/g, '.');
            return `<div class="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0"><span class="font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">${getCardNumberByUid(c.card)}</span><span class="text-xs text-gray-400">Lezárva: ${dateStr}</span></div>`;
        }).join('');
    }

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    wpMonth.value = currentMonth;

    renderLegend();
    renderModalAbsences(id);

    document.getElementById('modal-overlay').classList.remove('hidden', 'opacity-0');
    modalWorkerProfile.classList.remove('hidden');
    requestAnimationFrame(() => {
        modalWorkerProfileContent.classList.remove('opacity-0', 'scale-95');
        modalWorkerProfileContent.classList.add('opacity-100', 'scale-100');
    });

    generateCalendar(currentMonth);
};

function closeWorkerProfile() {
    document.getElementById('modal-overlay').classList.add('opacity-0');
    modalWorkerProfileContent.classList.remove('opacity-100', 'scale-100');
    modalWorkerProfileContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        document.getElementById('modal-overlay').classList.add('hidden');
        modalWorkerProfile.classList.add('hidden');
        currentProfileId = null;
    }, 300);
}

if (btnCloseWpModal) btnCloseWpModal.addEventListener('click', closeWorkerProfile);

if (wpMonth) wpMonth.addEventListener('change', (e) => {
    generateCalendar(e.target.value);
});

async function generateCalendar(monthStr) {
    if (!currentProfileId) return;
    wpCalendarLoading.classList.remove('hidden');

    const [year, month] = monthStr.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    let startDayOfWeek = firstDay.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7;

    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    try {
        const qJelenlet = query(jelenletRef, where("date", ">=", toDbDate(monthStartStr)), where("date", "<=", toDbDate(monthEndStr)));
        const snapJelenlet = await getDocs(qJelenlet);
        const jelenletMap = {};
        snapJelenlet.forEach(doc => {
            const data = doc.data();
            data.date = fromDbDate(data.date);
            if (data.name === wpName.textContent) jelenletMap[data.date] = data;
        });

        const qTavollet = query(tavolletekRef, where("datum", ">=", monthStartStr), where("datum", "<=", monthEndStr));
        const snapTavollet = await getDocs(qTavollet);
        const tavolletMap = {};
        snapTavollet.forEach(doc => {
            const data = doc.data();
            if (data.dolgozoId === currentProfileId) tavolletMap[data.datum] = data;
        });

        wpCalendarGrid.innerHTML = "";
        for (let i = 1; i < startDayOfWeek; i++) {
            const cell = document.createElement('div');
            cell.className = "bg-white opacity-50";
            wpCalendarGrid.appendChild(cell);
        }

        const todayStr = getTodayString();

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cellDate = new Date(year, month - 1, day);
            const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

            const attendance = jelenletMap[dateStr];
            const absence = tavolletMap[dateStr];
            const isToday = dateStr === todayStr;

            const cell = document.createElement('div');
            cell.className = `p-2 min-h-[100px] flex flex-col bg-white overflow-hidden relative transition-colors ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}`;

            if (isWeekend && !absence && !attendance) cell.classList.add('bg-gray-50');

            const dateNumClasses = isWeekend ? "text-red-400" : "text-gray-500";
            const todayBadge = isToday ? `<span class="bg-blue-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold leading-none ml-auto -mr-1 -mt-1 shadow-sm">Ma</span>` : '';

            let contentHTML = `
                <div class="flex justify-between items-start mb-2 ${isToday ? 'relative z-10' : ''}">
                    <span class="text-sm font-bold ${dateNumClasses}">${day}</span>
                    ${todayBadge}
                </div>
            `;

            if (absence) {
                const colors = absenceSettings[absence.tipus] ? absenceSettings[absence.tipus].color : absenceSettings["Alapértelmezett"].color;
                const bgColor = colors.split(' ').find(c => c.startsWith('bg-'));
                const textColor = colors.split(' ').find(c => c.startsWith('text-'));
                const borderColor = colors.split(' ').find(c => c.startsWith('border-'));

                cell.className = `p-2 min-h-[100px] flex flex-col ${bgColor} overflow-hidden border ${borderColor} relative ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}`;
                contentHTML += `<div class="mt-auto h-full flex items-center justify-center"><span class="text-xs font-bold text-center ${textColor} drop-shadow-sm px-1 leading-tight">${absence.tipus}</span></div>`;
            } else if (attendance) {
                const isWorking = attendance.status === "Jelen van" || attendance.status === "Eltávozott";
                if (isWorking) {
                    let durationHTML = "";
                    if (attendance.departure && attendance.departure !== "-") {
                        const workedHours = calculateSmartHours(attendance.arrival, attendance.departure);
                        durationHTML = `<div class="text-center font-bold text-gray-800 text-sm mb-1">${workedHours}</div>`;
                    }
                    contentHTML += `<div class="mt-auto flex flex-col gap-0.5 w-full bg-gray-50 p-1.5 rounded-lg border border-gray-100 shadow-sm">${durationHTML}<div class="flex items-center justify-between text-[10px] text-gray-500 font-medium px-1"><span><i class="fas fa-sign-in-alt text-emerald-500 mr-0.5"></i> ${attendance.arrival}</span><span><i class="fas fa-sign-out-alt text-gray-400 mr-0.5"></i> ${attendance.departure || '-'}</span></div></div>`;
                }
            }

            cell.innerHTML = contentHTML;
            wpCalendarGrid.appendChild(cell);
        }

    } catch (error) {
        console.error("Hiba a naptár generálásakor:", error);
    } finally {
        wpCalendarLoading.classList.add('hidden');
    }
}

function renderLegend() {
    const legendContainer = document.getElementById('wp-legend');
    if (legendContainer) {
        legendContainer.innerHTML = Object.entries(absenceSettings).filter(([key]) => key !== "Alapértelmezett").map(([key, setting]) => `<div class="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-gray-100 shadow-sm"><span class="w-3 h-3 rounded-sm ${setting.color.split(' ').find(c => c.startsWith('bg-'))}"></span><span class="text-xs font-medium text-gray-700">${key} <span class="text-[10px] text-gray-400 font-bold ml-1">(${setting.short})</span></span></div>`).join('');
    }
}

async function renderModalAbsences(empId) {
    if (!empId) return;
    wpAbsencesList.innerHTML = `<div class="text-center py-4 text-gray-400 text-sm italic"><i class="fas fa-spinner fa-spin mr-2"></i>Távollétek betöltése...</div>`;
    try {
        const qTav = query(tavolletekRef, where("dolgozoId", "==", empId));
        const snapTav = await getDocs(qTav);
        const tavData = [];
        snapTav.forEach(docSnap => tavData.push(docSnap.data()));

        const grouped = groupAbsences(tavData);
        wpAbsencesList.innerHTML = "";

        if (grouped.length === 0) {
            wpAbsencesList.innerHTML = `<div class="text-center py-4 text-gray-500 text-sm font-medium">Nincs korábbi távollét rögzítve.</div>`;
            return;
        }

        grouped.forEach(g => {
            const displayDate = g.start === g.end ? g.start.replace(/-/g, '.') : `${g.start.replace(/-/g, '.')} - ${g.end.replace(/-/g, '.')}`;
            const colors = absenceSettings[g.tipus] ? absenceSettings[g.tipus].color : absenceSettings["Alapértelmezett"].color;

            wpAbsencesList.innerHTML += `<div class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm transition-all hover:border-blue-100 hover:shadow-md"><div class="flex items-center gap-3"><div class="w-2 h-8 rounded-full ${colors.split(' ').find(c => c.startsWith('bg-')) || 'bg-gray-400'}"></div><div><p class="text-sm font-bold text-gray-800">${g.tipus}</p><p class="text-xs font-medium text-gray-500"><i class="far fa-calendar-alt mr-1"></i> ${displayDate}</p></div></div></div>`;
        });
    } catch (error) {
        wpAbsencesList.innerHTML = `<div class="text-center py-4 text-red-500 text-sm font-medium">Hiba történt az adatok betöltésekor.</div>`;
    }
}

async function initApp() {
    setupEmployeesListener();
    setupAbsencesListener();
}

// MAGYAR ÜNNEPNAPOK AUTOMATIKUS LETÖLTÉSE (API)
window.downloadHungarianHolidays = async function () {
    const year = new Date().getFullYear();
    const result = await Swal.fire({
        title: `${year}. évi Ünnepnapok`,
        text: "Letöltsem és beírjam az összes aktív dolgozónak az idei piros betűs ünnepeket?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Igen, letöltés!'
    });

    if (!result.isConfirmed) return;
    Swal.fire({ title: 'Letöltés folyamatban...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/HU`);
        const holidays = await response.json();
        const activeEmp = allEmployees.filter(e => e.status === "Aktív");
        let addedCount = 0;

        for (const holiday of holidays) {
            const dateStr = holiday.date;
            for (const emp of activeEmp) {
                const qCheck = query(tavolletekRef, where("dolgozoId", "==", emp.id), where("datum", "==", dateStr));
                const snapCheck = await getDocs(qCheck);

                if (snapCheck.empty) {
                    await addDoc(tavolletekRef, { dolgozoId: emp.id, dolgozoNeve: emp.name, datum: dateStr, tipus: "Fizetett ünnep", createdAt: serverTimestamp() });
                    addedCount++;
                }
            }
        }
        Swal.fire('Kész!', `${addedCount} db ünnepnap bejegyzés sikeresen rögzítve a dolgozóknál!`, 'success');
        fetchAndRenderWarnings();
    } catch (error) {
        console.error(error);
        Swal.fire('Hiba!', 'Nem sikerült letölteni az ünnepnapokat.', 'error');
    }
};

// BEJELENTKEZÉS ÉS JELSZÓ VÉDELEM LOGIKA
const loginScreen = document.getElementById('login-screen');
const appDashboard = document.getElementById('app-dashboard');
const loginForm = document.getElementById('login-form');
const btnLogout = document.getElementById('btn-logout');
const btnForgotPassword = document.getElementById('btn-forgot-password');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.add('opacity-0');
        setTimeout(() => {
            loginScreen.classList.add('hidden');
            appDashboard.classList.remove('hidden');
            initApp();
        }, 300);
    } else {
        appDashboard.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.classList.remove('opacity-0'), 50);
    }
});

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login');
        const orig = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xl"></i>';
        btn.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            Swal.fire('Hiba!', 'Hibás email cím vagy jelszó!', 'error');
            btn.innerHTML = orig;
            btn.disabled = false;
        }
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        const result = await Swal.fire({ title: 'Kijelentkezés', text: "Biztosan kilépsz?", icon: 'question', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Igen' });
        if (result.isConfirmed) {
            await signOut(auth);
            window.location.reload();
        }
    });
}

if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', async () => {
        const currentEmail = document.getElementById('login-email').value;
        const { value: email } = await Swal.fire({
            title: 'Jelszó visszaállítása',
            input: 'email',
            inputLabel: 'Add meg a regisztrált email címedet:',
            inputValue: currentEmail,
            inputPlaceholder: 'pelda@femszer.hu',
            showCancelButton: true,
            confirmButtonText: 'Email küldése',
            cancelButtonText: 'Mégse',
            confirmButtonColor: '#2563eb'
        });

        if (email) {
            try {
                await sendPasswordResetEmail(auth, email);
                Swal.fire('Siker!', 'A jelszóvisszaállító linket elküldtük az email címedre! Nézd meg a Spam mappát is.', 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('Hiba!', 'Nem sikerült elküldeni az emailt. Biztosan jó címet adtál meg?', 'error');
            }
        }
    });
}

// TÖMEGES PDF NAPTÁR GENERÁLÓ (EXPORTÁLÁS FÜL) - PIROS GOMB
const btnExportPdfAll = document.getElementById('btn-export-pdf-all');
if (btnExportPdfAll) {
    btnExportPdfAll.addEventListener('click', async () => {
        const mStr = document.getElementById('export-month').value;
        if (!mStr) {
            Swal.fire('Hiba!', 'Kérlek válassz egy hónapot a fenti naptárban!', 'warning');
            return;
        }

        const [year, month] = mStr.split('-').map(Number);
        const origContent = btnExportPdfAll.innerHTML;
        btnExportPdfAll.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span> Naptárak generálása (Kérlek várj)...</span>';
        btnExportPdfAll.disabled = true;

        try {
            const daysInMonth = new Date(year, month, 0).getDate();
            const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const endStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            const activeEmp = allEmployees.filter(e => e.status === "Aktív").sort((a, b) => a.name.localeCompare(b.name));

            const [snapJ, snapT] = await Promise.all([
                getDocs(query(jelenletRef, where("date", ">=", toDbDate(startStr)), where("date", "<=", toDbDate(endStr)))),
                getDocs(query(tavolletekRef, where("datum", ">=", startStr), where("datum", "<=", endStr)))
            ]);

            const allJel = []; snapJ.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); allJel.push(data); });
            const allTav = []; snapT.forEach(d => allTav.push(d.data()));

            let batchHtml = '';
            const legendHtml = Object.entries(absenceSettings).filter(([k]) => k !== "Alapértelmezett").map(([k, v]) => `<div class="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-gray-200 shadow-sm"><span class="w-3 h-3 rounded-sm ${v.color.split(' ').find(c => c.startsWith('bg-'))}"></span><span class="text-xs font-bold text-gray-700">${k} <span class="text-[10px] text-gray-400 ml-1">(${v.short})</span></span></div>`).join('');

            activeEmp.forEach((emp, index) => {
                const empJel = allJel.filter(j => j.name === emp.name);
                const empTav = allTav.filter(t => t.dolgozoId === emp.id);

                const jelMap = {}; empJel.forEach(j => jelMap[j.date] = j);
                const tavMap = {}; empTav.forEach(t => tavMap[t.datum] = t);

                let gridHtml = '';
                const firstDay = new Date(year, month - 1, 1);
                let startDayOfWeek = firstDay.getDay(); if (startDayOfWeek === 0) startDayOfWeek = 7;

                for (let i = 1; i < startDayOfWeek; i++) gridHtml += `<div class="bg-white opacity-50"></div>`;

                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const cellDate = new Date(year, month - 1, day);
                    const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

                    const attendance = jelMap[dateStr];
                    const absence = tavMap[dateStr];

                    let cellClasses = `p-1.5 min-h-[60px] flex flex-col bg-white overflow-hidden relative border border-gray-100`;
                    if (isWeekend && !absence && !attendance) cellClasses += ' bg-gray-50';

                    const dateNumClasses = isWeekend ? "text-red-400" : "text-gray-500";
                    let contentHTML = `<div class="flex justify-between items-start mb-0.5"><span class="text-xs font-bold ${dateNumClasses}">${day}</span></div>`;

                    if (absence) {
                        const cArr = absenceSettings[absence.tipus] ? absenceSettings[absence.tipus].color : absenceSettings["Alapértelmezett"].color;
                        const bgColor = cArr.split(' ').find(c => c.startsWith('bg-'));
                        const textColor = cArr.split(' ').find(c => c.startsWith('text-'));
                        cellClasses = `p-1.5 min-h-[60px] flex flex-col ${bgColor} overflow-hidden border border-gray-200 relative`;
                        contentHTML += `<div class="mt-auto h-full flex items-center justify-center"><span class="text-[10px] font-bold text-center drop-shadow-sm px-1 leading-tight" style="color:${textColor};">${absence.tipus}</span></div>`;
                    } else if (attendance) {
                        const isWorking = attendance.status === "Jelen van" || attendance.status === "Eltávozott";
                        if (isWorking) {
                            let durationHTML = "";
                            if (attendance.departure && attendance.departure !== "-") {
                                const workedHours = calculateSmartHours(attendance.arrival, attendance.departure);
                                durationHTML = `<div class="text-center font-bold text-gray-800 text-[10px] mb-0.5">${workedHours}</div>`;
                            }
                            contentHTML += `<div class="mt-auto flex flex-col gap-0.5 w-full bg-gray-50 p-1 rounded border border-gray-200 shadow-sm">${durationHTML}<div class="flex items-center justify-between text-[9px] text-gray-500 font-medium px-0.5"><span><i class="fas fa-sign-in-alt text-emerald-500 mr-0.5"></i> ${attendance.arrival}</span><span><i class="fas fa-sign-out-alt text-gray-400 mr-0.5"></i> ${attendance.departure || '-'}</span></div></div>`;
                        }
                    }
                    gridHtml += `<div class="${cellClasses}">${contentHTML}</div>`;
                }

                const isLast = index === activeEmp.length - 1;

                batchHtml += `
                <div class="bg-white w-full p-4 pt-6 flex flex-col justify-between ${!isLast ? 'page-break' : ''}" style="height: 98vh; max-height: 98vh; box-sizing: border-box; overflow: hidden;">
                    <div>
                        <div class="mb-3 flex justify-between items-end border-b border-gray-200 pb-2">
                            <div>
                                <h2 class="text-xl font-bold text-gray-800 uppercase">${emp.name}</h2>
                                <p class="text-gray-500 text-xs">Havi Jelenléti Naptár - ${year}. ${String(month).padStart(2, '0')}. hónap</p>
                            </div>
                            <div class="text-right text-gray-400 text-[10px] italic">Generálva: ${new Date().toLocaleDateString('hu-HU')}</div>
                        </div>
                        
                        <div class="grid grid-cols-7 border-b border-gray-100 bg-gray-100 mb-[1px]">
                            <div class="py-1.5 text-center text-xs font-bold text-gray-600">Hétfő</div>
                            <div class="py-1.5 text-center text-xs font-bold text-gray-600">Kedd</div>
                            <div class="py-1.5 text-center text-xs font-bold text-gray-600">Szerda</div>
                            <div class="py-1.5 text-center text-xs font-bold text-gray-600">Csütörtök</div>
                            <div class="py-1.5 text-center text-xs font-bold text-gray-600">Péntek</div>
                            <div class="py-1.5 text-center text-xs font-bold text-red-500">Szombat</div>
                            <div class="py-1.5 text-center text-xs font-bold text-red-500">Vasárnap</div>
                        </div>
                        
                        <div class="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-[1px]">
                            ${gridHtml}
                        </div>
                    </div>
                    
                    <div class="mt-auto shrink-0 pb-2 pt-2">
                        <div class="pt-3 border-t border-gray-200 flex justify-between items-end gap-4">
                            <div class="flex flex-wrap gap-1.5 justify-start flex-1">
                                ${legendHtml}
                            </div>
                            <div class="w-48 border-t-2 border-gray-800 text-center pt-1.5 font-bold text-gray-700 text-sm uppercase tracking-widest shrink-0 mb-2">Aláírás</div>
                        </div>
                    </div>
                </div>
                `;
            });

            const batchContainer = document.getElementById('batch-print-container');
            batchContainer.innerHTML = batchHtml;

            document.body.classList.add('batch-printing');

            setTimeout(() => {
                window.print();
                document.body.classList.remove('batch-printing');
                batchContainer.innerHTML = '';
                btnExportPdfAll.innerHTML = origContent;
                btnExportPdfAll.disabled = false;
            }, 800);

        } catch (error) {
            console.error(error);
            Swal.fire('Hiba', 'Nem sikerült legenerálni a PDF naptárakat.', 'error');
            btnExportPdfAll.innerHTML = origContent;
            btnExportPdfAll.disabled = false;
        }
    });
}

// EGYOLDALAS HAVI MÁTRIX PDF GENERÁLÓ (EXPORTÁLÁS FÜL) - LILA GOMB
const btnExportPdfMatrix = document.getElementById('btn-export-pdf-matrix');
if (btnExportPdfMatrix) {
    btnExportPdfMatrix.addEventListener('click', async () => {
        const mStr = document.getElementById('export-month').value;
        if (!mStr) { Swal.fire('Hiba!', 'Kérlek válassz egy hónapot a fenti naptárban!', 'warning'); return; }

        const [year, month] = mStr.split('-').map(Number);
        const origContent = btnExportPdfMatrix.innerHTML;
        btnExportPdfMatrix.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span> Mátrix PDF generálása...</span>';
        btnExportPdfMatrix.disabled = true;

        try {
            const daysInMonth = new Date(year, month, 0).getDate();
            const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const endStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
            const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);

            const activeEmp = allEmployees.filter(e => e.status === "Aktív").sort((a, b) => a.name.localeCompare(b.name));

            const [snapJ, snapT] = await Promise.all([
                getDocs(query(jelenletRef, where("date", ">=", toDbDate(startStr)), where("date", "<=", toDbDate(endStr)))),
                getDocs(query(tavolletekRef, where("datum", ">=", startStr), where("datum", "<=", endStr)))
            ]);

            const allJel = []; snapJ.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); allJel.push(data); });
            const allTav = []; snapT.forEach(d => allTav.push(d.data()));

            let tableHtml = `
            <div class="bg-white w-full p-4 font-sans flex flex-col justify-between" style="min-height: 98vh;">
              <div>
                <div class="text-center mb-6 border-b-2 border-gray-800 pb-2">
                    <h2 class="text-3xl font-bold text-gray-900 uppercase tracking-widest">Jelenléti Összesítő Mátrix</h2>
                    <p class="text-gray-600 font-bold text-lg">${year}. ${String(month).padStart(2, '0')}. hónap</p>
                </div>
                <table class="w-full border-collapse border border-gray-400">
                    <thead>
                        <tr class="bg-gray-100 text-xs text-gray-700 border-b border-gray-400">
                            <th class="border-r border-gray-300 p-2 text-left w-48 font-black uppercase">Dolgozó Neve</th>
            `;
            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month - 1, d);
                const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                tableHtml += `<th class="border-r border-gray-300 p-1.5 text-center font-bold ${isWknd ? 'bg-gray-200 text-gray-600' : ''}">${d}</th>`;
            }
            tableHtml += `
                            <th class="border-r border-gray-300 p-2 text-center bg-blue-50 font-black uppercase">M</th>
                            <th class="border-r border-gray-300 p-2 text-center bg-green-50 font-black uppercase">SZ</th>
                            <th class="border-r border-gray-300 p-2 text-center bg-yellow-50 font-black uppercase">T</th>
                            <th class="border-r border-gray-300 p-2 text-center bg-orange-50 font-black uppercase">BSZ</th>
                            <th class="border-r border-gray-300 p-2 text-center bg-blue-50 font-black uppercase">FÜ</th>
                            <th class="border-r border-gray-300 p-2 text-center bg-purple-50 font-black uppercase">FN</th>
                            <th class="p-2 text-center bg-cyan-50 font-black uppercase">IF</th>
                        </tr>
                    </thead>
                    <tbody class="text-xs">
            `;

            const getShortHours = (arr, dep) => {
                if (!arr || !dep || dep === "-") return "";
                const depTotalMins = (Number(dep.split(':')[0]) * 60) + Number(dep.split(':')[1]);
                let hrs = depTotalMins <= ((14 * 60) + 45) ? 7 : 8;
                const otStart = (16 * 60);
                if (depTotalMins > otStart) hrs += Math.floor((depTotalMins - otStart) / 60);
                return `${hrs}ó`;
            };

            let grandTotals = { munka: 0, sz: 0, t: 0, bsz: 0, fu: 0, fn: 0, ip: 0 };

            activeEmp.forEach(emp => {
                let stats = { munka: 0, sz: 0, t: 0, bsz: 0, fu: 0, fn: 0, ip: 0 };
                tableHtml += `<tr class="border-b border-gray-300"><td class="border-r border-gray-300 p-2 font-bold text-gray-900 truncate max-w-[160px]">${emp.name}</td>`;

                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dateObj = new Date(year, month - 1, d);
                    const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                    const isPast = dateObj < todayObj;

                    const tav = allTav.find(t => t.dolgozoId === emp.id && t.datum === dateStr);
                    const att = allJel.find(j => j.name === emp.name && j.date === dateStr);

                    let cellText = ""; let cellClass = "border-r border-gray-300 p-1 text-center font-bold ";

                    if (tav) {
                        const s = absenceSettings[tav.tipus] || absenceSettings["Alapértelmezett"];
                        cellText = s.short;
                        cellClass += s.color.split(' ').find(c => c.startsWith('text-')) + " " + s.color.split(' ').find(c => c.startsWith('bg-'));
                        if (tav.tipus === "Szabadság") stats.sz++; else if (tav.tipus === "Táppénz") stats.t++; else if (tav.tipus === "Betegszabadság") stats.bsz++; else if (tav.tipus === "Fizetett ünnep") stats.fu++; else if (tav.tipus === "Fizetés nélküli szabadság") stats.fn++; else if (tav.tipus === "Igazolt fizetett távollét") stats.ip++;
                    } else if (att && att.departure !== "-") {
                        stats.munka++;
                        cellText = getShortHours(att.arrival, att.departure);
                        cellClass += "text-green-800 bg-green-50/50";
                    } else if (att && att.departure === "-") {
                        cellText = "?"; cellClass += "text-amber-700 bg-amber-50";
                    } else {
                        if (isWknd) { cellClass += "bg-gray-100 text-gray-400"; cellText = "-"; }
                        else if (isPast) { cellClass += "text-red-500 bg-red-50/30"; cellText = "X"; }
                        else { cellClass += "text-gray-300"; cellText = ""; }
                    }

                    tableHtml += `<td class="${cellClass}">${cellText}</td>`;
                }

                grandTotals.munka += stats.munka; grandTotals.sz += stats.sz; grandTotals.t += stats.t; grandTotals.bsz += stats.bsz; grandTotals.fu += stats.fu; grandTotals.fn += stats.fn; grandTotals.ip += stats.ip;

                tableHtml += `
                    <td class="border-r border-gray-300 p-2 text-center font-black text-blue-900 bg-blue-50">${stats.munka}</td>
                    <td class="border-r border-gray-300 p-2 text-center font-black text-green-900 bg-green-50">${stats.sz}</td>
                    <td class="border-r border-gray-300 p-2 text-center font-black text-yellow-900 bg-yellow-50">${stats.t}</td>
                    <td class="border-r border-gray-300 p-2 text-center font-black text-orange-900 bg-orange-50">${stats.bsz}</td>
                    <td class="border-r border-gray-300 p-2 text-center font-black text-blue-900 bg-blue-50">${stats.fu}</td>
                    <td class="border-r border-gray-300 p-2 text-center font-black text-purple-900 bg-purple-50">${stats.fn}</td>
                    <td class="p-2 text-center font-black text-cyan-900 bg-cyan-50">${stats.ip}</td>
                </tr>`;
            });

            tableHtml += `
                    <tr class="bg-gray-200 border-t-2 border-gray-400">
                        <td class="border-r border-gray-300 p-2 font-black text-right uppercase text-xs text-gray-800" colspan="${daysInMonth + 1}">Céges Összesítő:</td>
                        <td class="border-r border-gray-300 p-2 text-center font-black text-blue-900 text-sm">${grandTotals.munka}</td>
                        <td class="border-r border-gray-300 p-2 text-center font-black text-green-900 text-sm">${grandTotals.sz}</td>
                        <td class="border-r border-gray-300 p-2 text-center font-black text-yellow-900 text-sm">${grandTotals.t}</td>
                        <td class="border-r border-gray-300 p-2 text-center font-black text-orange-900 text-sm">${grandTotals.bsz}</td>
                        <td class="border-r border-gray-300 p-2 text-center font-black text-blue-900 text-sm">${grandTotals.fu}</td>
                        <td class="border-r border-gray-300 p-2 text-center font-black text-purple-900 text-sm">${grandTotals.fn}</td>
                        <td class="p-2 text-center font-black text-cyan-900 text-sm">${grandTotals.ip}</td>
                    </tr>
                    </tbody>
                </table>
              </div>
              
              <div class="mt-8 pt-4 border-t border-gray-300 flex justify-between items-end shrink-0">
                  <div class="flex flex-wrap gap-3 justify-start flex-1">
                      ${Object.entries(absenceSettings).filter(([k]) => k !== "Alapértelmezett" && k !== "Kiküldetés").map(([k, v]) => `<div class="flex items-center gap-1.5"><span class="w-4 h-4 border border-gray-300 ${v.color.split(' ').find(c => c.startsWith('bg-'))}"></span><span class="text-xs font-bold text-gray-700">${k} (${v.short})</span></div>`).join('')}
                      <div class="flex items-center gap-1.5"><span class="w-4 h-4 border border-gray-300 bg-green-50"></span><span class="text-xs font-bold text-gray-700">Munkanap (Pl: 8ó)</span></div>
                      <div class="flex items-center gap-1.5"><span class="w-4 h-4 border border-gray-300 bg-red-50"></span><span class="text-xs font-bold text-gray-700">Igazolatlan (X)</span></div>
                  </div>
                  <div class="w-64 border-t-2 border-gray-800 text-center pt-2 font-bold text-gray-800 text-sm uppercase tracking-widest shrink-0 mb-4">Aláírás</div>
              </div>
            </div>`;

            const batchContainer = document.getElementById('batch-print-container');
            batchContainer.innerHTML = tableHtml;

            document.body.classList.add('matrix-printing');

            setTimeout(() => {
                window.print();
                document.body.classList.remove('matrix-printing');
                batchContainer.innerHTML = '';
                btnExportPdfMatrix.innerHTML = origContent;
                btnExportPdfMatrix.disabled = false;
            }, 800);

        } catch (error) {
            console.error(error);
            Swal.fire('Hiba', 'Nem sikerült legenerálni a Mátrix PDF-et.', 'error');
            btnExportPdfMatrix.innerHTML = origContent;
            btnExportPdfMatrix.disabled = false;
        }
    });
}

// GÉPKOCSI KÖLTSÉGTÉRÍTÉS PDF GENERÁLÓ (ZÖLD GOMB) - EGYOLDALAS ÖSSZESÍTŐ
const btnExportTravel = document.getElementById('btn-export-travel');
if (btnExportTravel) {
    btnExportTravel.addEventListener('click', async () => {
        const mStr = document.getElementById('export-month').value;
        if (!mStr) { Swal.fire('Hiba!', 'Kérlek válassz egy hónapot a fenti naptárban!', 'warning'); return; }

        const [year, month] = mStr.split('-').map(Number);
        const origContent = btnExportTravel.innerHTML;
        btnExportTravel.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span> Generálás...</span>';
        btnExportTravel.disabled = true;

        try {
            const daysInMonth = new Date(year, month, 0).getDate();
            const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const endStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            const activeEmp = allEmployees.filter(e => e.status === "Aktív" && e.distance && Number(e.distance) > 0).sort((a, b) => a.name.localeCompare(b.name));

            if (activeEmp.length === 0) {
                Swal.fire('Figyelem', 'Nincs olyan aktív dolgozó a rendszerben, akinek be lenne állítva a kilométer távolság a profiljában!', 'info');
                btnExportTravel.innerHTML = origContent;
                btnExportTravel.disabled = false;
                return;
            }

            const snapJ = await getDocs(query(jelenletRef, where("date", ">=", toDbDate(startStr)), where("date", "<=", toDbDate(endStr))));
            const allJel = []; snapJ.forEach(d => { let data = d.data(); data.date = fromDbDate(data.date); allJel.push(data); });

            let tableRows = '';
            let grandTotalPay = 0;

            activeEmp.forEach(emp => {
                const empJel = allJel.filter(j => j.name === emp.name);

                const uniqueDays = new Set(empJel.map(j => j.date));
                const workedDays = uniqueDays.size;

                const dailyKm = Number(emp.distance) * 2;
                const totalPay = dailyKm * workedDays * 30;
                grandTotalPay += totalPay;

                tableRows += `
                <tr class="border-b border-gray-400">
                    <td class="py-3 px-4 border-r border-gray-400 font-bold text-gray-800">${emp.name}</td>
                    <td class="py-3 px-4 border-r border-gray-400 text-gray-700">${emp.city || '-'}</td>
                    <td class="py-3 px-4 border-r border-gray-400 text-center font-semibold text-gray-800">${dailyKm} km</td>
                    <td class="py-3 px-4 border-r border-gray-400 text-center font-semibold text-gray-800">${workedDays} nap</td>
                    <td class="py-3 px-4 border-r border-gray-400 text-right font-bold text-gray-900 text-lg">${totalPay.toLocaleString('hu-HU')} Ft</td>
                    <td class="py-3 px-4 text-center"></td>
                </tr>
                `;
            });

            let batchHtml = `
            <div class="bg-white w-full p-8 font-sans">
                <div class="text-center mb-10 border-b-2 border-gray-800 pb-4">
                    <h1 class="text-3xl font-bold text-gray-900 uppercase tracking-widest">Gépkocsi Költségtérítés Összesítő</h1>
                    <p class="text-xl font-semibold text-gray-600 mt-2">${year}. ${String(month).padStart(2, '0')}. hónap</p>
                </div>

                <table class="w-full text-left border-collapse border-2 border-gray-800 mb-10">
                    <thead>
                        <tr class="bg-gray-100 border-b-2 border-gray-800">
                            <th class="py-3 px-4 border-r-2 border-gray-800 font-bold text-gray-800 uppercase text-sm">Dolgozó neve</th>
                            <th class="py-3 px-4 border-r-2 border-gray-800 font-bold text-gray-800 uppercase text-sm">Település</th>
                            <th class="py-3 px-4 border-r-2 border-gray-800 font-bold text-gray-800 text-center uppercase text-sm">Napi táv.<br><span class="text-xs text-gray-500">(oda-vissza)</span></th>
                            <th class="py-3 px-4 border-r-2 border-gray-800 font-bold text-gray-800 text-center uppercase text-sm">Munkában<br><span class="text-xs text-gray-500">töltött nap</span></th>
                            <th class="py-3 px-4 border-r-2 border-gray-800 font-bold text-gray-800 text-right uppercase text-sm">Térítés<br><span class="text-xs text-gray-500">(30 Ft/km)</span></th>
                            <th class="py-3 px-4 font-bold text-gray-800 text-center w-56 uppercase text-sm">Aláírás <br><span class="text-xs text-gray-500">(Átvétel)</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr class="bg-gray-200 border-t-4 border-gray-800">
                            <td colspan="4" class="py-4 px-4 border-r-2 border-gray-800 font-black text-right text-lg uppercase text-gray-900">Mindösszesen fizetendő:</td>
                            <td class="py-4 px-4 border-r-2 border-gray-800 font-black text-right text-2xl text-gray-900">${grandTotalPay.toLocaleString('hu-HU')} Ft</td>
                            <td class="bg-gray-50"></td>
                        </tr>
                    </tbody>
                </table>

                <div class="mt-20 flex justify-between items-end px-4">
                    <div class="text-gray-700 font-medium text-lg">
                        Kelt: Veresegyház, ${new Date().toLocaleDateString('hu-HU')}
                    </div>
                    <div class="w-72 border-t-2 border-gray-800 text-center pt-2 font-bold text-gray-800 text-sm uppercase tracking-widest">
                        Jóváhagyó aláírása
                    </div>
                </div>
            </div>
            `;

            const batchContainer = document.getElementById('batch-print-container');
            batchContainer.innerHTML = batchHtml;

            document.body.classList.add('travel-printing');

            setTimeout(() => {
                window.print();
                document.body.classList.remove('travel-printing');
                batchContainer.innerHTML = '';
                btnExportTravel.innerHTML = origContent;
                btnExportTravel.disabled = false;
            }, 800);

        } catch (error) {
            console.error(error);
            Swal.fire('Hiba', 'Nem sikerült legenerálni a költségtérítési listát.', 'error');
            btnExportTravel.innerHTML = origContent;
            btnExportTravel.disabled = false;
        }
    });
}