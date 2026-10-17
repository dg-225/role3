/**
 * 우리 반 1인 1역할 배정 도우미 - script.js
 * 1인 1역할 무작위 1:1 매칭, 교실 게시판 A4 인쇄, 구글 시트 연동 준비 로직
 */

// --- 1. 기본 예시 데이터: 초등학생 20명 & 학급 역할 20개 ---
const DEFAULT_STUDENTS = [
  "김민준", "이서연", "박도윤", "정하은", "최시우",
  "강지아", "조은우", "윤수아", "장예준", "임지유",
  "한유준", "오서아", "서서진", "신하윤", "권이준",
  "황채원", "안시윤", "송유나", "류태오", "문소율"
];

const DEFAULT_ROLES = [
  { icon: "🧽", name: "칠판 요정", desc: "수업이 끝나면 칠판을 분필가루 없이 반짝반짝 닦아요" },
  { icon: "🌱", name: "식물 집사", desc: "매일 아침 교실 화분에 사랑을 담아 물을 주어요" },
  { icon: "💡", name: "에너지 지킴이", desc: "쉬는 시간과 하교 시 전등을 끄고 전기를 아껴요" },
  { icon: "🪟", name: "환기 대장", desc: "중간놀이와 점심시간에 창문을 열어 맑은 공기를 채워요" },
  { icon: "🥛", name: "우유 배달부", desc: "아침마다 신선한 우유를 안전하게 챙겨와요" },
  { icon: "📚", name: "도서 도우미", desc: "학급 문고 책을 바르게 꽂고 책장을 깔끔히 정리해요" },
  { icon: "🚶", name: "줄서기 반장", desc: "이동 수업 갈 때 복도에서 친구들과 바르게 줄을 서요" },
  { icon: "💌", name: "칭찬 배달원", desc: "친구들의 멋진 행동을 찾아 학급 칭찬함에 쏙 넣어요" },
  { icon: "⏰", name: "시간 알리미", desc: "수업 시작 1분 전에 친구들에게 자리에 앉도록 알려요" },
  { icon: "🍱", name: "급식 안전관", desc: "점심시간 손 씻기를 안내하고 질서 있게 급식 받아요" },
  { icon: "🌡️", name: "온도 조절사", desc: "교실 적정 온도를 살피고 냉난방기 상태를 확인해요" },
  { icon: "⚽", name: "체육 부장", desc: "체육 시간 놀이기구와 공을 챙기고 끝난 뒤 정리해요" },
  { icon: "🎵", name: "음악 DJ", desc: "아침 자습 시간이나 청소 시간에 행복한 음악을 틀어요" },
  { icon: "📢", name: "알림장 도우미", desc: "오늘의 과제와 준비물을 칠판에 예쁘게 적어두어요" },
  { icon: "♻️", name: "분리수거 박사", desc: "종이와 플라스틱을 바르게 나누어 버리도록 도와요" },
  { icon: "🔍", name: "분실물 지킴이", desc: "주인을 잃어버린 연필과 지우개의 주인을 찾아주어요" },
  { icon: "📐", name: "책상 줄잡이", desc: "하교 전 책상과 의자 줄을 반듯하게 맞춰요" },
  { icon: "💻", name: "컴퓨터 매니저", desc: "수업용 전자칠판과 컴퓨터를 켜고 안전하게 꺼요" },
  { icon: "☂️", name: "우산 꽂이 반장", desc: "비 오는 날 우산을 가지런히 꽂고 바닥 물기를 닦아요" },
  { icon: "😊", name: "스마일 비타민", desc: "아침마다 친구들에게 밝고 힘찬 목소리로 인사해요" }
];

const THEME_CLASSES = ["theme-mint", "theme-yellow", "theme-blue", "theme-purple", "theme-pink", "theme-peach"];

// --- 2. 애플리케이션 상태 (State) ---
class AppState {
  constructor() {
    this.students = this.loadStorage("classroom_students", DEFAULT_STUDENTS);
    this.roles = this.loadStorage("classroom_roles", DEFAULT_ROLES);
    this.className = localStorage.getItem("classroom_name") || "3학년 2반 1인 1역할";
    this.sheetUrl = localStorage.getItem("classroom_sheet_url") || "";
    this.soundEnabled = localStorage.getItem("classroom_sound") !== "false";
    
    // Assignment mapping: array of { roleIndex, role, student }
    const savedAssignments = this.loadStorage("classroom_assignments", null);
    if (savedAssignments && savedAssignments.length === this.roles.length) {
      this.assignments = savedAssignments;
    } else {
      // 기본 초기 1:1 매칭 생성
      this.assignments = this.roles.map((r, i) => ({
        roleIndex: i,
        role: r,
        student: this.students[i] || `학생 ${i + 1}`
      }));
    }

    this.currentSort = "default";
    this.searchQuery = "";
    this.isShuffling = false;
  }

  loadStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  save() {
    localStorage.setItem("classroom_students", JSON.stringify(this.students));
    localStorage.setItem("classroom_roles", JSON.stringify(this.roles));
    localStorage.setItem("classroom_assignments", JSON.stringify(this.assignments));
    localStorage.setItem("classroom_name", this.className);
    localStorage.setItem("classroom_sheet_url", this.sheetUrl);
    localStorage.setItem("classroom_sound", String(this.soundEnabled));
  }
}

const state = new AppState();

// --- 3. 경쾌한 웹 오디오 효과음 합성기 (외부 파일 없이 순수 Web Audio API로 구동) ---
class SoundManager {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playPop() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {
      // Audio not permitted without interaction
    }
  }

  playSuccess() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = this.ctx.currentTime + idx * 0.08;

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // Silent catch
    }
  }
}

const soundManager = new SoundManager();

// --- 4. 경쾌한 축하 컨페티 (Canvas Confetti Engine) ---
class ConfettiEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.particles = [];
    this.animating = false;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(count = 90) {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    const colors = ["#f59e0b", "#10b981", "#0284c7", "#ec4899", "#8b5cf6", "#f97316", "#ffd700"];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width * (0.2 + Math.random() * 0.6),
        y: this.canvas.height * 0.4,
        size: Math.random() * 10 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 1.2) * 16,
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        opacity: 1,
        life: 1
      });
    }

    if (!this.animating) {
      this.animating = true;
      this.loop();
    }
  }

  loop() {
    if (!this.particles.length) {
      this.animating = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravity
      p.vx *= 0.98;
      p.rotation += p.vr;
      p.life -= 0.012;
      p.opacity = Math.max(0, p.life);

      if (p.life <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    requestAnimationFrame(() => this.loop());
  }
}

let confetti = null;

// --- 5. Fisher-Yates 무작위 셔플 알고리즘 ---
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// --- 6. 토스트 알림 표시기 ---
let toastTimer = null;
function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

// --- 7. UI 렌더링 함수 ---
function renderCards() {
  const grid = document.getElementById("cards-grid");
  if (!grid) return;

  // 필터링 및 정렬 처리
  let list = [...state.assignments];

  // 1. 검색어 필터링
  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(item => 
      item.student.toLowerCase().includes(q) ||
      item.role.name.toLowerCase().includes(q) ||
      item.role.desc.toLowerCase().includes(q)
    );
  }

  // 2. 정렬 기준
  if (state.currentSort === "student") {
    list.sort((a, b) => a.student.localeCompare(b.student, "ko-KR"));
  } else if (state.currentSort === "role") {
    list.sort((a, b) => a.role.name.localeCompare(b.role.name, "ko-KR"));
  } else {
    // default: 원래 역할 번호 순서
    list.sort((a, b) => a.roleIndex - b.roleIndex);
  }

  grid.innerHTML = "";

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: #64748b; background: #ffffff; border-radius: 16px; border: 2px dashed #cbd5e1;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
        <p style="font-size: 1.1rem; font-weight: 600;">검색 결과가 없습니다.</p>
        <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem;">다른 검색어로 찾아보거나 검색창을 비워보세요.</p>
      </div>
    `;
    return;
  }

  list.forEach((item, displayIdx) => {
    const themeClass = THEME_CLASSES[item.roleIndex % THEME_CLASSES.length];
    const cardNum = String(item.roleIndex + 1).padStart(2, "0");

    const card = document.createElement("div");
    card.className = `role-card ${themeClass}`;
    card.id = `role-card-${item.roleIndex}`;

    card.innerHTML = `
      <div class="card-top-band">
        <span class="card-num">#${cardNum}</span>
        <span class="card-role-name">${item.role.name}</span>
        <span class="card-icon" aria-hidden="true">${item.role.icon}</span>
      </div>

      <div class="card-student-box">
        <div class="student-avatar" aria-hidden="true">
          ${item.student ? (item.roleIndex % 2 === 0 ? "👦" : "👧") : "❓"}
        </div>
        <div class="student-info">
          <span class="student-label">담당 학생</span>
          <div class="student-name ${!item.student ? 'unassigned' : ''}">
            ${item.student || "미배정"}
          </div>
        </div>
      </div>

      <div class="card-mission-box">
        <span class="mission-tag">🌱 하는 일 (미션)</span>
        <p class="mission-text">${item.role.desc}</p>
      </div>

      <div class="card-footer">
        <button type="button" class="card-action-btn btn-swap-trigger" data-role-index="${item.roleIndex}" title="다른 학생과 역할 맞바꾸기">
          🔄 교환
        </button>
      </div>
    `;

    grid.appendChild(card);
  });

  // 역할 교환 이벤트 바인딩
  document.querySelectorAll(".btn-swap-trigger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.getAttribute("data-role-index"), 10);
      openSwapModal(idx);
    });
  });

  updateStats();
  renderPrintTable();
}

// 상단 통계 숫자 업데이트
function updateStats() {
  const statStudents = document.getElementById("stat-students-count");
  const statRoles = document.getElementById("stat-roles-count");
  const statAssigned = document.getElementById("stat-assigned-count");
  const statStatus = document.getElementById("stat-status-text");

  if (statStudents) statStudents.textContent = state.students.length;
  if (statRoles) statRoles.textContent = state.roles.length;

  const assignedCount = state.assignments.filter(a => a.student && a.student.trim() !== "").length;
  if (statAssigned) statAssigned.textContent = `${assignedCount}/${state.roles.length}`;
  if (statStatus) {
    if (assignedCount === state.roles.length && state.roles.length > 0) {
      statStatus.textContent = "배정 완료 ✨";
    } else {
      statStatus.textContent = "진행 중";
    }
  }
}

// 교실 게시판 부착용 A4 인쇄 테이블 렌더링
function renderPrintTable() {
  const tbody = document.getElementById("print-table-body");
  if (!tbody) return;

  const printClassTitle = document.getElementById("print-class-title");
  const printMetaClass = document.getElementById("print-meta-class");
  const printMetaDate = document.getElementById("print-meta-date");

  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, "0")}. ${String(today.getDate()).padStart(2, "0")}`;

  if (printClassTitle) printClassTitle.textContent = `🌱 [${state.className}] 1인 1역할 조직표`;
  if (printMetaClass) printMetaClass.textContent = state.className;
  if (printMetaDate) printMetaDate.textContent = dateStr;

  // 원래 역할 순서대로 정렬하여 인쇄
  const sorted = [...state.assignments].sort((a, b) => a.roleIndex - b.roleIndex);

  tbody.innerHTML = sorted.map((item, idx) => `
    <tr>
      <td class="center font-bold">${idx + 1}</td>
      <td class="role-col">${item.role.icon} ${item.role.name}</td>
      <td class="student-col">${item.student || "-"}</td>
      <td class="desc-col">${item.role.desc}</td>
      <td class="check-col">□</td>
    </tr>
  `).join("");
}

// --- 8. 역할 배정하기 (주요 기능: 1:1 무작위 셔플 & 롤링 애니메이션) ---
function runRandomAssignment() {
  if (state.isShuffling) return;
  state.isShuffling = true;

  soundManager.playPop();

  // 학생 명단이 부족하거나 역할이 없을 때 방어 코드
  if (state.students.length === 0 || state.roles.length === 0) {
    showToast("⚠️ 학생 또는 역할 목록이 비어 있습니다. [편집]에서 추가해 주세요.");
    state.isShuffling = false;
    return;
  }

  const shuffleIndicator = document.getElementById("shuffle-indicator");
  if (shuffleIndicator) shuffleIndicator.style.display = "flex";

  const cards = document.querySelectorAll(".role-card");
  cards.forEach(card => card.classList.add("shuffling"));

  // 1초 동안 슬롯머신처럼 빠르게 이름이 돌아가는 시각적 효과
  let tick = 0;
  const tickInterval = setInterval(() => {
    tick++;
    soundManager.playPop();
    const tempShuffled = shuffleArray(state.students);
    document.querySelectorAll(".student-name").forEach((nameEl, idx) => {
      nameEl.textContent = tempShuffled[idx % tempShuffled.length] || "매칭 중...";
    });

    if (tick > 10) {
      clearInterval(tickInterval);
      finalizeAssignment();
    }
  }, 100);
}

function finalizeAssignment() {
  // 실제 1:1 무작위 매칭 수행
  const shuffledStudents = shuffleArray(state.students);

  state.assignments = state.roles.map((role, idx) => ({
    roleIndex: idx,
    role: role,
    student: shuffledStudents[idx] || (idx < state.students.length ? shuffledStudents[idx] : "미배정")
  }));

  state.save();

  const shuffleIndicator = document.getElementById("shuffle-indicator");
  if (shuffleIndicator) shuffleIndicator.style.display = "none";

  renderCards();

  soundManager.playSuccess();
  if (confetti) {
    confetti.burst(100);
  }

  showToast("🎉 1인 1역할이 신나고 공정하게 배정되었습니다!");
  state.isShuffling = false;
}

// --- 9. 결과 텍스트 복사 (알림장, 하이클래스, 클래스팅 전송용) ---
function copyResultsAsText() {
  const sorted = [...state.assignments].sort((a, b) => a.roleIndex - b.roleIndex);
  
  const lines = [
    `📢 [${state.className}] 1인 1역할 배정 결과`,
    `✨ 우리 반 모두가 주인공! 소중한 역할을 맡아 함께 실천해요.`,
    `--------------------------------------`
  ];

  sorted.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.role.icon} ${item.role.name}: ${item.student} (${item.role.desc})`);
  });

  lines.push(`--------------------------------------`);
  lines.push(`배정일: ${new Date().toLocaleDateString('ko-KR')}`);

  const fullText = lines.join("\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullText).then(() => {
      showToast("📋 알림장/메신저용 결과 텍스트가 클립보드에 복사되었습니다!");
    }).catch(() => fallbackCopy(fullText));
  } else {
    fallbackCopy(fullText);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  showToast("📋 결과 텍스트가 복사되었습니다!");
}

// --- 10. 엑셀(CSV) 다운로드 기능 ---
function exportToCsv() {
  const sorted = [...state.assignments].sort((a, b) => a.roleIndex - b.roleIndex);
  const rows = [
    ["번호", "역할명", "이모지", "담당학생", "역할미션", "학급명"]
  ];

  sorted.forEach((item, idx) => {
    rows.push([
      idx + 1,
      `"${item.role.name.replace(/"/g, '""')}"`,
      `"${item.role.icon}"`,
      `"${item.student.replace(/"/g, '""')}"`,
      `"${item.role.desc.replace(/"/g, '""')}"`,
      `"${state.className.replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${state.className}_1인1역할배정표.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📥 엑셀(CSV) 파일이 성공적으로 다운로드되었습니다!");
}

// --- 11. 구글 스프레드시트 (Apps Script) 연동 기능 ---
function handleSheetLoad() {
  soundManager.playPop();
  if (!state.sheetUrl) {
    // URL 미등록 시 안내 모달 오픈
    openSheetModal();
    showToast("ℹ️ 구글 Apps Script 웹앱 URL을 먼저 등록해주세요.");
    return;
  }

  showToast("🔄 구글 스프레드시트에서 데이터를 불러오는 중...");

  fetch(state.sheetUrl)
    .then(res => {
      if (!res.ok) throw new Error("네트워크 응답 오류: " + res.status);
      return res.json();
    })
    .then(data => {
      if (data && data.rows && Array.isArray(data.rows)) {
        // 시트 데이터 파싱 (1행 헤더 건너뜀)
        const sheetRows = data.rows.slice(1);
        if (sheetRows.length > 0) {
          const newStudents = [];
          const newRoles = [];

          sheetRows.forEach((row, i) => {
            const roleName = row[1] || `역할 ${i + 1}`;
            const studentName = row[2] || `학생 ${i + 1}`;
            const roleDesc = row[3] || "맡은 역할을 성실히 실천해요";

            newRoles.push({
              icon: "🌟",
              name: String(roleName),
              desc: String(roleDesc)
            });
            newStudents.push(String(studentName));
          });

          state.students = newStudents;
          state.roles = newRoles;
          state.assignments = newRoles.map((r, idx) => ({
            roleIndex: idx,
            role: r,
            student: newStudents[idx] || "미배정"
          }));

          state.save();
          renderCards();
          renderManageLists();
          showToast(`✅ 시트에서 ${sheetRows.length}개의 역할을 성공적으로 불러왔습니다!`);
          soundManager.playSuccess();
        }
      } else {
        throw new Error("올바른 시트 JSON 형식이 아닙니다.");
      }
    })
    .catch(err => {
      console.warn("Sheet fetch error:", err);
      showToast("⚠️ 시트 불러오기 실패: Apps Script URL과 권한(모든 사용자)을 확인하세요.");
      openSheetModal();
    });
}

function handleSheetSave() {
  soundManager.playPop();
  if (!state.sheetUrl) {
    openSheetModal();
    showToast("ℹ️ 구글 스프레드시트 저장을 위해 웹 앱 URL을 먼저 등록해주세요.");
    return;
  }

  showToast("💾 구글 스프레드시트에 저장하는 중...");

  const payload = {
    className: state.className,
    timestamp: new Date().toISOString(),
    assignments: state.assignments.map(a => ({
      role: a.role.name,
      student: a.student,
      desc: a.role.desc,
      icon: a.role.icon
    }))
  };

  fetch(state.sheetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(result => {
      soundManager.playSuccess();
      showToast("✅ 구글 스프레드시트에 결과가 안전하게 저장되었습니다!");
    })
    .catch(err => {
      console.warn("Sheet post error:", err);
      showToast("⚠️ 직접 저장 실패 (CORS 정책). 시트 연동 설정을 확인하거나 CSV로 백업하세요.");
      openSheetModal();
    });
}

function openSheetModal() {
  const modal = document.getElementById("modal-sheet-config");
  const input = document.getElementById("input-sheet-url");
  if (input) input.value = state.sheetUrl;
  if (modal) modal.style.display = "flex";
}

// --- 12. 학생 & 역할 관리 모달 로직 ---
function openManageModal() {
  renderManageLists();
  const modal = document.getElementById("modal-manage");
  if (modal) modal.style.display = "flex";
}

function renderManageLists() {
  const studentListEl = document.getElementById("manage-students-list");
  const roleListEl = document.getElementById("manage-roles-list");
  const studentCountEl = document.getElementById("modal-student-count");
  const roleCountEl = document.getElementById("modal-role-count");

  if (studentCountEl) studentCountEl.textContent = state.students.length;
  if (roleCountEl) roleCountEl.textContent = state.roles.length;

  if (studentListEl) {
    studentListEl.innerHTML = state.students.map((name, i) => `
      <div class="list-item-row">
        <span><strong>${i + 1}.</strong> ${name}</span>
        <button type="button" class="list-item-del-btn" data-del-student="${i}" title="삭제">✕</button>
      </div>
    `).join("");

    studentListEl.querySelectorAll("[data-del-student]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-del-student"), 10);
        state.students.splice(idx, 1);
        renderManageLists();
      });
    });
  }

  if (roleListEl) {
    roleListEl.innerHTML = state.roles.map((r, i) => `
      <div class="list-item-row">
        <span><strong>${i + 1}.</strong> ${r.icon} ${r.name} <small style="color:#64748b;">(${r.desc})</small></span>
        <button type="button" class="list-item-del-btn" data-del-role="${i}" title="삭제">✕</button>
      </div>
    `).join("");

    roleListEl.querySelectorAll("[data-del-role]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-del-role"), 10);
        state.roles.splice(idx, 1);
        renderManageLists();
      });
    });
  }
}

// --- 13. 개별 역할 수동 교환 (Swap Modal) ---
let currentSwapSourceIdx = null;

function openSwapModal(sourceIdx) {
  currentSwapSourceIdx = sourceIdx;
  const modal = document.getElementById("modal-swap");
  const infoEl = document.getElementById("swap-source-info");
  const selectEl = document.getElementById("select-swap-target");

  const sourceItem = state.assignments[sourceIdx];
  if (!sourceItem) return;

  if (infoEl) {
    infoEl.innerHTML = `현재 선택: <strong>[${sourceItem.role.name}] ${sourceItem.student}</strong>`;
  }

  if (selectEl) {
    selectEl.innerHTML = state.assignments
      .filter((_, idx) => idx !== sourceIdx)
      .map(item => `
        <option value="${item.roleIndex}">
          [#${item.roleIndex + 1} ${item.role.name}] ${item.student}
        </option>
      `).join("");
  }

  if (modal) modal.style.display = "flex";
}

function handleConfirmSwap() {
  const selectEl = document.getElementById("select-swap-target");
  if (!selectEl || currentSwapSourceIdx === null) return;

  const targetIdx = parseInt(selectEl.value, 10);
  const sourceItem = state.assignments[currentSwapSourceIdx];
  const targetItem = state.assignments[targetIdx];

  if (sourceItem && targetItem) {
    // 학생 서로 교환
    const tempStudent = sourceItem.student;
    sourceItem.student = targetItem.student;
    targetItem.student = tempStudent;

    state.save();
    renderCards();
    soundManager.playPop();
    showToast(`🔄 '${sourceItem.student}' ↔ '${targetItem.student}' 역할이 맞바뀌었습니다!`);
  }

  closeAllModals();
}

function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach(m => m.style.display = "none");
}

// --- 14. 이벤트 리스너 등록 & 초기화 ---
document.addEventListener("DOMContentLoaded", () => {
  // Confetti 인스턴스 생성
  confetti = new ConfettiEngine("confetti-canvas");

  // 오늘 날짜 뱃지 세팅
  const dateBadge = document.getElementById("current-date-badge");
  if (dateBadge) {
    const now = new Date();
    dateBadge.textContent = `${now.getMonth() + 1}월 ${now.getDate()}일`;
  }

  // 학급명 입력창 동기화
  const classInput = document.getElementById("class-title-input");
  if (classInput) {
    classInput.value = state.className;
    classInput.addEventListener("input", (e) => {
      state.className = e.target.value.trim() || "우리 반 1인 1역할";
      state.save();
      renderPrintTable();
    });
  }

  // 핵심 버튼 이벤트
  document.getElementById("btn-assign")?.addEventListener("click", runRandomAssignment);
  document.getElementById("btn-print")?.addEventListener("click", () => {
    soundManager.playPop();
    window.print();
  });
  document.getElementById("btn-copy-text")?.addEventListener("click", copyResultsAsText);
  document.getElementById("btn-export-csv")?.addEventListener("click", exportToCsv);

  // 구글 시트 연동 버튼
  document.getElementById("btn-sheet-load")?.addEventListener("click", handleSheetLoad);
  document.getElementById("btn-sheet-save")?.addEventListener("click", handleSheetSave);
  document.getElementById("btn-sheet-config")?.addEventListener("click", openSheetModal);

  // 효과음 토글
  const soundToggleBtn = document.getElementById("btn-sound-toggle");
  const soundIcon = document.getElementById("sound-icon");
  soundToggleBtn?.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    state.save();
    if (soundIcon) soundIcon.textContent = state.soundEnabled ? "🔊" : "🔇";
    showToast(state.soundEnabled ? "🔊 효과음이 켜졌습니다." : "🔇 효과음이 꺼졌습니다.");
  });

  // 검색 & 필터 이벤트
  const filterInput = document.getElementById("filter-input");
  const clearSearchBtn = document.getElementById("btn-clear-search");
  filterInput?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    if (clearSearchBtn) {
      clearSearchBtn.style.display = state.searchQuery ? "flex" : "none";
    }
    renderCards();
  });

  clearSearchBtn?.addEventListener("click", () => {
    if (filterInput) filterInput.value = "";
    state.searchQuery = "";
    clearSearchBtn.style.display = "none";
    renderCards();
  });

  // 정렬 탭 이벤트
  document.querySelectorAll(".sort-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      document.querySelectorAll(".sort-tab").forEach(t => t.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.currentSort = e.currentTarget.getAttribute("data-sort");
      renderCards();
    });
  });

  // 모달 닫기 버튼 공통
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const modalId = e.currentTarget.getAttribute("data-close");
      const modal = document.getElementById(modalId);
      if (modal) modal.style.display = "none";
    });
  });

  // 모달 배경 클릭 시 닫기
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.style.display = "none";
      }
    });
  });

  // 학생·역할 관리 모달 열기
  document.getElementById("btn-manage-data")?.addEventListener("click", openManageModal);

  // 관리 모달 내부 탭 전환
  const tabBtnStudents = document.getElementById("tab-btn-students");
  const tabBtnRoles = document.getElementById("tab-btn-roles");
  const tabPaneStudents = document.getElementById("tab-content-students");
  const tabPaneRoles = document.getElementById("tab-content-roles");

  tabBtnStudents?.addEventListener("click", () => {
    tabBtnStudents.classList.add("active");
    tabBtnRoles?.classList.remove("active");
    tabPaneStudents?.classList.add("active");
    tabPaneRoles?.classList.remove("active");
  });

  tabBtnRoles?.addEventListener("click", () => {
    tabBtnRoles.classList.add("active");
    tabBtnStudents?.classList.remove("active");
    tabPaneRoles?.classList.add("active");
    tabPaneStudents?.classList.remove("active");
  });

  // 새 학생 단건 추가
  document.getElementById("btn-add-student")?.addEventListener("click", () => {
    const input = document.getElementById("input-new-student");
    const name = input?.value.trim();
    if (name) {
      state.students.push(name);
      input.value = "";
      renderManageLists();
      showToast(`'${name}' 학생이 명단에 추가되었습니다.`);
    }
  });

  // 학생 명단 일괄 붙여넣기
  document.getElementById("btn-apply-batch-students")?.addEventListener("click", () => {
    const textarea = document.getElementById("textarea-batch-students");
    const raw = textarea?.value || "";
    const parsed = raw.split("\n").map(s => s.trim()).filter(Boolean);
    if (parsed.length > 0) {
      state.students = parsed;
      renderManageLists();
      showToast(`총 ${parsed.length}명의 학생 명단으로 교체되었습니다.`);
      textarea.value = "";
    }
  });

  // 새 역할 단건 추가
  document.getElementById("btn-add-role")?.addEventListener("click", () => {
    const iconInput = document.getElementById("input-new-role-icon");
    const nameInput = document.getElementById("input-new-role-name");
    const descInput = document.getElementById("input-new-role-desc");

    const icon = iconInput?.value.trim() || "🌟";
    const name = nameInput?.value.trim();
    const desc = descInput?.value.trim() || "성실하게 역할을 수행해요";

    if (name) {
      state.roles.push({ icon, name, desc });
      if (nameInput) nameInput.value = "";
      if (descInput) descInput.value = "";
      renderManageLists();
      showToast(`'${name}' 역할이 추가되었습니다.`);
    }
  });

  // 역할 목록 일괄 붙여넣기
  document.getElementById("btn-apply-batch-roles")?.addEventListener("click", () => {
    const textarea = document.getElementById("textarea-batch-roles");
    const raw = textarea?.value || "";
    const lines = raw.split("\n").map(s => s.trim()).filter(Boolean);
    if (lines.length > 0) {
      const parsedRoles = lines.map(line => {
        let icon = "🌟";
        let text = line;
        // Check if starts with emoji
        const match = line.match(/^(\p{Emoji})\s*(.*)$/u);
        if (match) {
          icon = match[1];
          text = match[2];
        }
        const parts = text.split("-").map(p => p.trim());
        const name = parts[0] || "역할";
        const desc = parts[1] || "성실하게 역할을 수행해요";
        return { icon, name, desc };
      });

      state.roles = parsedRoles;
      renderManageLists();
      showToast(`총 ${parsedRoles.length}개의 역할 목록으로 교체되었습니다.`);
      textarea.value = "";
    }
  });

  // 기본 20명 데이터로 복원
  document.getElementById("btn-reset-default-data")?.addEventListener("click", () => {
    if (confirm("기본 예시 20명의 학생과 20개의 역할로 초기화하시겠습니까?")) {
      state.students = [...DEFAULT_STUDENTS];
      state.roles = [...DEFAULT_ROLES];
      state.assignments = state.roles.map((r, i) => ({
        roleIndex: i,
        role: r,
        student: state.students[i] || `학생 ${i + 1}`
      }));
      state.save();
      renderManageLists();
      renderCards();
      showToast("🔄 기본 20명 예시 데이터로 복원되었습니다.");
    }
  });

  // 관리 모달 저장 및 적용
  document.getElementById("btn-save-manage")?.addEventListener("click", () => {
    // 역할 수와 학생 수가 다를 경우 보정
    state.assignments = state.roles.map((role, idx) => ({
      roleIndex: idx,
      role: role,
      student: state.students[idx] || "미배정"
    }));
    state.save();
    renderCards();
    closeAllModals();
    showToast("💾 수정된 학생 및 역할 목록이 배정에 반영되었습니다!");
  });

  // 스프레드시트 URL 저장
  document.getElementById("btn-save-sheet-url")?.addEventListener("click", () => {
    const input = document.getElementById("input-sheet-url");
    if (input) {
      state.sheetUrl = input.value.trim();
      state.save();
      showToast("💾 구글 스프레드시트 연동 URL이 저장되었습니다!");
    }
  });

  // 스프레드시트 연결 테스트
  document.getElementById("btn-test-sheet-connection")?.addEventListener("click", () => {
    const input = document.getElementById("input-sheet-url");
    if (input) {
      state.sheetUrl = input.value.trim();
      state.save();
    }
    handleSheetLoad();
  });

  // Apps Script 샘플 코드 복사
  document.getElementById("btn-copy-script-code")?.addEventListener("click", () => {
    const code = document.getElementById("sample-script-code")?.textContent || "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        showToast("📜 Apps Script 코드가 복사되었습니다!");
      });
    }
  });

  // 교환 모달 확인 버튼
  document.getElementById("btn-confirm-swap")?.addEventListener("click", handleConfirmSwap);

  // 초기 카드 렌더링
  renderCards();
});
