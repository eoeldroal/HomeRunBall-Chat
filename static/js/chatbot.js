console.log("챗봇 JS 로드 완료");

// DOM 요소
const chatArea = document.querySelector(".chat-area");
const username = chatArea ? chatArea.dataset.username : "사용자";
const chatLog = document.getElementById("chat-log");
const userMessageInput = document.getElementById("user-message");
const sendBtn = document.getElementById("send-btn");
const videoBtn = document.getElementById("videoBtn");
const imageBtn = document.getElementById("imageBtn");

// 메시지 전송 함수
async function sendMessage(isInitial = false) {
  let message;

  if (isInitial) {
    message = "init";
  } else {
    message = userMessageInput.value.trim();
    if (!message) return;

    appendMessage("user", message);
    userMessageInput.value = "";
  }

  // 로딩 표시
  const loadingId = appendMessage("bot", "생각 중...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        username: username,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 로딩 메시지 제거
    removeMessage(loadingId);

    // 응답 파싱
    let replyText, imagePath;
    if (typeof data.reply === "object" && data.reply !== null) {
      replyText = data.reply.reply || data.reply;
      imagePath = data.reply.image || null;
    } else {
      replyText = data.reply;
      imagePath = null;
    }

    // 디버그 정보 콘솔 출력
    if (data.debug) {
      console.group("🎮 게임 상태 업데이트");
      console.log("📅 현재 시점:", `${data.debug.game_state.current_month}월 ${data.debug.game_state.current_day}일`);
      console.log("🎯 드래프트까지:", `${data.debug.game_state.months_until_draft}개월`);
      console.log("💖 친밀도 레벨:", data.debug.game_state.intimacy_level);

      console.group("📊 스탯 변화");
      if (Object.keys(data.debug.stat_changes.changes).length > 0) {
        console.log("변화량:", data.debug.stat_changes.changes);
        console.log("이유:", data.debug.stat_changes.reason);
        console.table({
          "이전": data.debug.stat_changes.old_stats,
          "이후": data.debug.stat_changes.new_stats
        });
      } else {
        console.log("스탯 변화 없음");
      }
      console.groupEnd();

      if (data.debug.event_check.triggered) {
        console.log("🎭 이벤트 발생:", data.debug.event_check.event_name);
      }

      if (data.debug.hint_provided) {
        console.log("💡 힌트 제공됨");
      }

      console.log("💬 대화 횟수:", data.debug.conversation_count);
      console.log("📜 이벤트 히스토리:", data.debug.event_history);
      console.groupEnd();

      // 스탯 UI 업데이트
      updateStatsUI(data.debug.game_state);
    }

    appendMessage("bot", replyText, imagePath);

    // 이벤트 알림 표시
    if (data.event) {
      showEventNotification(data.event);
    }

    // 힌트 표시
    if (data.hint) {
      showHintNotification(data.hint);
    }
  } catch (err) {
    console.error("메시지 전송 에러:", err);
    removeMessage(loadingId);
    appendMessage("bot", "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.");
  }
}

// 메시지 DOM에 추가
let messageIdCounter = 0;
function appendMessage(sender, text, imageSrc = null) {
  const messageId = `msg-${messageIdCounter++}`;
  const messageElem = document.createElement("div");
  messageElem.classList.add("message", sender);
  messageElem.id = messageId;

  if (sender === "user") {
    messageElem.textContent = text;
  } else {
    // 이미지가 있으면 먼저 표시
    if (imageSrc) {
      const botImg = document.createElement("img");
      botImg.classList.add("bot-big-img");
      botImg.src = imageSrc;
      botImg.alt = "챗봇 이미지";
      messageElem.appendChild(botImg);
    }

    // 텍스트 추가
    const textContainer = document.createElement("div");
    textContainer.classList.add("bot-text-container");
    textContainer.textContent = text;
    messageElem.appendChild(textContainer);
  }

  if (chatLog) {
    chatLog.appendChild(messageElem);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  return messageId;
}

// 메시지 제거
function removeMessage(messageId) {
  const elem = document.getElementById(messageId);
  if (elem) {
    elem.remove();
  }
}

// 엔터키로 전송
if (userMessageInput) {
  userMessageInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  });
}

// 전송 버튼
if (sendBtn) {
  sendBtn.addEventListener("click", () => sendMessage());
}

// 모달 열기/닫기
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "block";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  }
}

// 미디어 버튼 이벤트
if (videoBtn) {
  videoBtn.addEventListener("click", () => openModal("videoModal"));
}

if (imageBtn) {
  imageBtn.addEventListener("click", () => openModal("imageModal"));
}

// 모달 닫기 버튼
document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modalId = btn.dataset.closeModal;
    closeModal(modalId);
  });
});

// 모달 배경 클릭 시 닫기
document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
});

// 스탯 UI 업데이트
function updateStatsUI(gameState) {
  if (!gameState || !gameState.stats) return;

  const stats = gameState.stats;

  // 스탯 바 업데이트
  updateStatBar("intimacy", stats.intimacy);
  updateStatBar("mental", stats.mental);
  updateStatBar("stamina", stats.stamina);
  updateStatBar("power", stats.power);
  updateStatBar("speed", stats.speed);

  // 월 정보 업데이트
  const monthElem = document.getElementById("current-month");
  if (monthElem) {
    monthElem.textContent = `${gameState.current_month}월`;
  }

  // 친밀도 레벨 업데이트
  const intimacyLevelElem = document.getElementById("intimacy-level");
  if (intimacyLevelElem) {
    intimacyLevelElem.textContent = gameState.intimacy_level;
  }
}

function updateStatBar(statName, value) {
  const statValue = document.getElementById(`${statName}-value`);
  const statBar = document.getElementById(`${statName}-bar`);

  if (statValue) {
    statValue.textContent = value;
  }

  if (statBar) {
    statBar.style.width = `${value}%`;

    // 색상 변경 (값에 따라)
    if (value >= 80) {
      statBar.style.backgroundColor = "#4CAF50"; // 녹색
    } else if (value >= 50) {
      statBar.style.backgroundColor = "#2196F3"; // 파란색
    } else if (value >= 30) {
      statBar.style.backgroundColor = "#FF9800"; // 주황색
    } else {
      statBar.style.backgroundColor = "#F44336"; // 빨간색
    }
  }
}

// 이벤트 알림 표시
function showEventNotification(eventInfo) {
  const notification = document.createElement("div");
  notification.className = "event-notification";
  notification.innerHTML = `
    <h3>🎭 ${eventInfo.event_name}</h3>
    <p>${eventInfo.trigger_message}</p>
    <button onclick="this.parentElement.remove()">확인</button>
  `;
  document.body.appendChild(notification);

  // 자동으로 5초 후 제거
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// 힌트 알림 표시
function showHintNotification(hint) {
  const notification = document.createElement("div");
  notification.className = "hint-notification";
  notification.innerHTML = `
    <p>${hint}</p>
    <button onclick="this.parentElement.remove()">닫기</button>
  `;
  document.body.appendChild(notification);

  // 자동으로 10초 후 제거
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

// 페이지 로드 시 초기 메시지 요청
window.addEventListener("load", () => {
  console.log("페이지 로드 완료");

  setTimeout(() => {
    if (chatLog && chatLog.childElementCount === 0) {
      console.log("초기 메시지 요청");
      sendMessage(true);
    }
  }, 500);
});
