/* MC1 training interface: independent practice controls; no instructor endpoints or exam locks. */
"use strict";
var currentLang = "en";
var currentStudentIdx = -1;
var practiceStorePrefix = "se-mc1-trainer-se-v3:";
var toastTimer = null;
var hasRenderedPractice = false;

function safeStorageGet(key) {
    try { return localStorage.getItem(practiceStorePrefix + key); } catch (e) { return null; }
}
function safeStorageSet(key, val) {
    try { localStorage.setItem(practiceStorePrefix + key, String(val)); } catch (e) { /* private mode */ }
}
function practiceKey() { return "answers-" + currentStudentIdx; }

function notify(msg, isError) {
    var toast = document.getElementById("toast");
    var bg = document.getElementById("toast-bg");
    if (!toast || !bg) return;
    document.getElementById("toast-msg").textContent = msg;
    bg.classList.toggle("bg-rose-600", !!isError);
    bg.classList.toggle("bg-indigo-600", !isError);
    clearTimeout(toastTimer);
    toast.classList.remove("translate-y-20", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
    toastTimer = setTimeout(function () {
        toast.classList.remove("translate-y-0", "opacity-100");
        toast.classList.add("translate-y-20", "opacity-0");
    }, 3500);
}
function setLanguage(nextLang) {
    if (nextLang !== "ru" && nextLang !== "en") return;
    if (hasRenderedPractice && currentStudentIdx >= 0) savePractice();
    currentLang = nextLang;
    safeStorageSet("lang", nextLang);
    var en = document.getElementById("lang-btn-en");
    var ru = document.getElementById("lang-btn-ru");
    en.className = nextLang === "en" ? "px-3 py-1 text-xs font-bold rounded bg-indigo-600 text-white transition" : "px-3 py-1 text-xs font-bold rounded text-slate-400 hover:text-white transition";
    ru.className = nextLang === "ru" ? "px-3 py-1 text-xs font-bold rounded bg-indigo-600 text-white transition" : "px-3 py-1 text-xs font-bold rounded text-slate-400 hover:text-white transition";
    document.querySelectorAll("[data-lang-en]").forEach(function(el) {
        el.textContent = el.getAttribute("data-lang-" + nextLang);
    });
    var picker = document.getElementById("training-variant");
    if (picker && typeof STUDENTS_LIST !== "undefined") {
        for (var i = 0; i < STUDENTS_LIST.length; i++) {
            var option = picker.querySelector('option[value="' + (i + 1) + '"]');
            if (option) option.textContent = (nextLang === "ru" ? "Вариант" : "Variant") + " " + (i + 1) + " — " + STUDENTS_LIST[i];
        }
    }
    if (currentStudentIdx >= 0) {renderPractice();hasRenderedPractice = true;}
    else refreshVariantLabel();
}
function refreshVariantLabel() {
    var box = document.getElementById("student-status-box");
    if (currentStudentIdx < 0) {
        box.innerHTML = '<i class="fas fa-user-graduate text-2xl text-slate-700"></i><span class="text-slate-500 font-normal">' +
            (currentLang === "ru" ? "Ожидание выбора имени студента..." : "Awaiting authentic name selection...") + '</span>';
        return;
    }
    box.innerHTML = '<i class="fas fa-check-circle text-2xl text-emerald-400"></i><span class="text-emerald-300 font-bold">Variant #' +
        (currentStudentIdx + 1) + " (" + STUDENTS_LIST[currentStudentIdx] + ")</span>";
}
function chooseVariant(value) {
    var number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 9) return;
    if (currentStudentIdx >= 0) savePractice();
    currentStudentIdx = number - 1;
    safeStorageSet("variant", number);
    document.getElementById("training-variant").value = String(number);
    document.getElementById("student-name").value = STUDENTS_LIST[currentStudentIdx];
    document.getElementById("exam-hub").classList.remove("hidden");
    renderPractice();
    hasRenderedPractice = true;
}
function selectStudentForPractice() {
    var val = document.getElementById("student-name").value.trim().toLowerCase();
    var found = val.length >= 3 ? STUDENTS_LIST.findIndex(function(s) {return s.toLowerCase().includes(val);}) : -1;
    if (found >= 0) {
        if (currentStudentIdx !== found) chooseVariant(found + 1);
    } else {
        if (currentStudentIdx >= 0) savePractice();
        currentStudentIdx = -1; hasRenderedPractice = false;
        document.getElementById("training-variant").value = "";
        document.getElementById("exam-hub").classList.add("hidden");
        refreshVariantLabel();
    }
}
function randomVariant() {
    var next = Math.floor(Math.random() * (currentStudentIdx < 0 ? 9 : 8));
    if (currentStudentIdx >= 0 && next >= currentStudentIdx) next++;
    chooseVariant(next + 1);
}
function getAnswers() {
    var answers = {};
    var root = document.getElementById("exam-hub");
    if (!root) return answers;
    root.querySelectorAll('input[type="radio"], input[type="text"], textarea, input[type="range"]').forEach(function (el) {
        var key = el.id || el.name;
        if (!key) return;
        if (el.type === "radio") { if (el.checked) answers["radio:" + el.name] = el.value; }
        else answers["field:" + key] = el.value;
    });
    return answers;
}
function savePractice() {
    var hub = document.getElementById("exam-hub");
    if (!hub || hub.classList.contains("hidden")) return;
    safeStorageSet(practiceKey(), JSON.stringify(getAnswers()));
}
function restorePractice() {
    var raw = safeStorageGet(practiceKey());
    var answers = {};
    if (raw) { try { answers = JSON.parse(raw) || {}; } catch (e) { answers = {}; } }
    var root = document.getElementById("exam-hub");
    if (!root) return;
    root.querySelectorAll('input[type="radio"], input[type="text"], textarea, input[type="range"]').forEach(function (el) {
        var key = el.id || el.name;
        if (!key) return;
        if (el.type === "radio") el.checked = answers["radio:" + el.name] === el.value;
        else if (Object.prototype.hasOwnProperty.call(answers, "field:" + key)) el.value = answers["field:" + key];
    });
    if (typeof updateCostChartFromTableInputs === "function") {
        try { updateCostChartFromTableInputs(); } catch (e) { console.warn("Cost chart update:", e.message); }
    }
    if (typeof p4_checkWordCount === "function") {
        try { p4_checkWordCount(); } catch (e) {}
    }
    ["p4_updatePcDashboard", "p4_updateMcDashboard", "p4_updateMoDashboard"].forEach(function (name) {
        var fn = window[name];
        if (typeof fn === "function") { try { fn(); } catch (e) {} }
    });
}
function renderPractice() {
    if (currentStudentIdx < 0) return;
    refreshVariantLabel();
    document.getElementById("exam-hub").classList.remove("hidden");
    var methods = [renderQuestionsP1P2, renderTasksP3, renderCaseP4];
    methods.forEach(function (fn, i) {
        try { fn(currentStudentIdx, currentLang); }
        catch (e) { console.error("Practice module " + (i + 1) + ":", e); notify("Module loading error: " + e.message, true); }
    });
    var results = document.getElementById("practice-results");
    if (results) { results.classList.add("hidden"); results.replaceChildren(); }
    window.setTimeout(restorePractice, 350);
}
function switchTab(tabId) {
    var target = document.getElementById(tabId);
    if (!target) return;
    document.querySelectorAll(".tab-pane").forEach(function (p) { p.classList.add("hidden"); });
    target.classList.remove("hidden");
    document.querySelectorAll(".tab-btn").forEach(function (b) {
        b.classList.toggle("active", (b.getAttribute("onclick") || "").includes(tabId));
    });
    if (tabId === "tab-part4" || tabId === "tab-part3") {
        window.setTimeout(function () {
            [typeof p4Chart1Inst !== "undefined" ? p4Chart1Inst : null,
         typeof p4Chart2Inst !== "undefined" ? p4Chart2Inst : null,
         typeof costChartInstance !== "undefined" ? costChartInstance : null].forEach(function (chart) {
                if (chart && typeof chart.resize === "function") chart.resize();
            });
        }, 180);
    }
}
function resetPractice() {
    if (!window.confirm(currentLang === "ru" ? "Очистить ответы текущего тренировочного варианта?" : "Clear answers for this practice variant?")) return;
    safeStorageSet(practiceKey(), "{}");
    renderPractice();
    switchTab("tab-part1");
    notify(currentLang === "ru" ? "Вариант сброшен" : "Variant reset");
}
function toggleCalc() {
    document.getElementById("mini-calc").classList.toggle("hidden");
}
var calcExpr = "";
function calcPress(ch) {
    if (calcExpr === "0") calcExpr = "";
    if (calcExpr.length < 80) calcExpr += String(ch);
    document.getElementById("calc-display").value = calcExpr || "0";
}
function calcClear() {
    calcExpr = "";
    document.getElementById("calc-display").value = "0";
}
function calcEval() {
    var display = document.getElementById("calc-display");
    try {
        if (!/^[0-9+\-*/().\s]+$/.test(calcExpr) || calcExpr.length > 80) throw Error("Invalid expression");
        var value = Function('"use strict";return (' + calcExpr + ');')();
        if (!Number.isFinite(value)) throw Error("Non-finite result");
        calcExpr = String(Math.round(value * 10000) / 10000);
        display.value = calcExpr;
    } catch (e) { display.value = "Error"; calcExpr = ""; }
}
function htmlEscape(raw) {
    return String(raw).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function openQuestionBank() {
    var panel = document.getElementById("bank-content");
    var isRu = currentLang === "ru";
    var groups = [
        [isRu ? "Банк 1: основы микроэкономики" : "Pool 1: Microeconomics", PART1_POOL],
        [isRu ? "Банк 2: рынки и предложение" : "Pool 2: Markets", PART2_POOL]
    ];
    var html = "";
    groups.forEach(function (group) {
        html += '<h3 class="text-lg font-bold text-white mb-3 mt-5">' + htmlEscape(group[0]) + " — " + group[1].length + "</h3>";
        group[1].forEach(function (q, idx) {
            var key = q.ans;
            var opts = isRu ? q.opts_ru : q.opts_en;
            var rawQuestion = isRu ? q.q_ru : q.q_en;
            var correct = opts.find(function (option) { return option.startsWith(key + ")"); }) || key;
            html += '<article class="card p-4 mb-3"><div class="text-xs text-indigo-300 font-bold mb-2">#' + (idx + 1) + "</div>" +
                '<div class="text-sm font-semibold text-white mb-3">' + htmlEscape(rawQuestion) + "</div><ol class=\"space-y-1\">";
            opts.forEach(function (opt) { html += '<li class="text-xs text-slate-400">' + htmlEscape(opt) + "</li>"; });
            html += "</ol><details class=\"mt-3 text-sm\"><summary class=\"text-emerald-300 cursor-pointer font-bold\">" +
                (isRu ? "Показать правильный ответ" : "Show answer") +
                '</summary><p class="mt-2 text-emerald-200">' + htmlEscape(correct) + "</p></details></article>";
        });
    });
    panel.innerHTML = html;
    var dialog = document.getElementById("bank-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.classList.remove("hidden");
}
function closeQuestionBank() {
    var dialog = document.getElementById("bank-dialog");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.classList.add("hidden");
}
function compareNumeric(el, tol) {
    if (!el) return null;
    var given = Number.parseFloat((el.value || "").replace(",", "."));
    var correct = Number.parseFloat(el.dataset.expected);
    return {filled: Number.isFinite(given),ok: Number.isFinite(given) && Math.abs(given - correct) <= tol,actual: given,expected: correct};
}
function reviewPractice() {
    savePractice();
    var isRu = currentLang === "ru";
    var mcq = new Map();
    document.querySelectorAll('#exam-hub input[type="radio"][data-ans]').forEach(function (el) {
        if (!mcq.has(el.name)) mcq.set(el.name, {correct:el.dataset.ans, selected:null,group:el.name});
        if (el.checked) mcq.get(el.name).selected = el.value;
    });
    var questionsCorrect = 0, questionsMissing = 0;
    var incorrect = [];
    mcq.forEach(function (q) {
        if (q.selected === q.correct) questionsCorrect++;
        else { if (!q.selected) questionsMissing++; incorrect.push(q); }
    });
    var problems = [["ans-t1", 0.99],["ans-t2",0.11],["ans-t3",0.11],["ans-t4-q",0.001]];
    var problemResults = problems.map(function (entry) { return {id:entry[0],r:compareNumeric(document.getElementById(entry[0]),entry[1])}; });
    var problemCorrect = problemResults.filter(function (x) {return x.r && x.r.ok;}).length;
    var matrixCorrect = 0, matrixTotal = 0;
    var fields = ["tc","afc","avc","atc","mc"];
    for (var q = 1; q <= 10; q++) {
        var row = document.getElementById("t4-tc-" + q);
        if (!row) continue;
        var tr = row.closest("tr");
        var cells = tr.querySelectorAll("td");
        var fc = Number(cells[1].textContent);
        var vc = Number(cells[2].textContent);
        var prev = q === 1 ? 0 : Number(document.getElementById("t4-tc-" + (q-1)).closest("tr").querySelectorAll("td")[2].textContent);
        var expected = {tc:fc+vc,afc:fc/q,avc:vc/q,atc:(fc+vc)/q,mc:vc-prev};
        fields.forEach(function (f) {
            var inp = document.getElementById("t4-"+f+"-"+q);
            if (!inp) return;
            var val = Number.parseFloat(inp.value.replace(",","."));
            matrixTotal++;
            if (Number.isFinite(val) && Math.abs(val-expected[f]) <= 0.13) matrixCorrect++;
        });
    }
    var essay=document.getElementById("p4-essay-input");
    var wordCount = essay && essay.value.trim() ? essay.value.trim().split(/\s+/).length : 0;
    var sliderPoints=typeof p4_getSliderScore === "function" ? p4_getSliderScore() : 0;
    var parts = [
        [isRu ? "Тест + график" : "Quiz & Graph", questionsCorrect + "/" + mcq.size, questionsMissing],
        [isRu ? "Расчёты 3.1–3.4" : "Computations 3.1–3.4", problemCorrect + "/4"],
        [isRu ? "Таблица издержек" : "Cost matrix", matrixCorrect + "/" + matrixTotal],
        [isRu ? "Кейс: положение ползунка" : "Case: Slider selection", sliderPoints + "/10"],
        [isRu ? "Кейс: письменное обоснование" : "Case: Written reasoning", wordCount + (isRu ? " слов (минимум 60)" : " words (minimum 60)")]
    ];
    var out = document.getElementById("practice-results");
    out.innerHTML = "";
    var title = document.createElement("h3");
    title.className = "text-lg font-bold text-white";
    title.textContent = isRu ? "Результаты тренировочного варианта" : "Practice variant results";
    out.appendChild(title);
    parts.forEach(function (part) {
        var p = document.createElement("div");
        p.className = "flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 py-3";
        var left = document.createElement("span");left.className="text-sm text-slate-300";left.textContent=part[0];
        var right = document.createElement("strong");right.className="text-emerald-300 font-mono";right.textContent=part[1];
        p.append(left,right);out.appendChild(p);
    });
    if (incorrect.length) {
        var list=document.createElement("div");
        list.className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4 text-sm text-amber-200 mt-4";
        var message = isRu ? "Повтори вопросы: " : "Review these questions: ";
        list.textContent = message + incorrect.map(function (x) {return x.group;}).join(", ");
        out.appendChild(list);
    }
    var missing = problemResults.filter(function (x) {return !x.r || !x.r.ok;});
    if(missing.length) {
        var calc=document.createElement("div");calc.className="bg-indigo-950/40 border border-indigo-700/40 rounded-lg p-4 text-xs text-slate-300 mt-3";
        calc.textContent=(isRu ? "Проверь вычисления: " : "Check these tasks: ")+missing.map(function(x){return x.id.replace("ans-t","3.");}).join(", ");
        out.appendChild(calc);
    }
    var note=document.createElement("p");
    note.className="text-xs text-slate-400 mt-4 leading-relaxed";
    note.textContent=isRu
        ? "Это самостоятельная тренировка, а не оценка преподавателя. Правильность письменного анализа автоматически не устанавливается; проверь экономическое обоснование и минимум 60 слов."
        : "Practice feedback only, not an instructor grade. Written reasoning is not auto-graded; review the economics of your explanation and aim for at least 60 words.";
    out.appendChild(note);
    out.classList.remove("hidden");
    out.scrollIntoView({behavior:"smooth",block:"start"});
    safeStorageSet("last-review-"+currentStudentIdx,JSON.stringify({date:new Date().toISOString(),mcq:questionsCorrect,of:mcq.size,calc:problemCorrect,matrix:matrixCorrect,words:wordCount}));
}
document.addEventListener("input", function (event) {
    if (event.target.closest && event.target.closest("#exam-hub")) savePractice();
});
document.addEventListener("change", function (event) {
    if (event.target.closest && event.target.closest("#exam-hub")) savePractice();
});
document.addEventListener("DOMContentLoaded", function () {
    var storedLang = safeStorageGet("lang");
    currentLang = storedLang === "en" ? "en" : "ru";
    setLanguage(currentLang);
    var variant = Number.parseInt(safeStorageGet("variant") || "",10);
    if (Number.isInteger(variant) && variant >= 1 && variant <= STUDENTS_LIST.length) chooseVariant(variant);
    else {currentStudentIdx = -1;document.getElementById("exam-hub").classList.add("hidden");refreshVariantLabel();}
    switchTab("tab-part1");
});
