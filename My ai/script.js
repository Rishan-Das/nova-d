const chatWindow = document.querySelector("#chatWindow");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const newChatButton = document.querySelector("#newChatButton");
const clearChatButton = document.querySelector("#clearChatButton");
const toneSelect = document.querySelector("#toneSelect");
const menuButton = document.querySelector("#menuButton");
const sidebarBackdrop = document.querySelector("#sidebarBackdrop");
const themeToggle = document.querySelector("#themeToggle");
const themeText = document.querySelector("#themeText");
const welcomePanel = document.querySelector("#welcomePanel");
const featureStrip = document.querySelector("#featureStrip");
const authButton = document.querySelector("#authButton");
const settingsButton = document.querySelector("#settingsButton");
const accountButton = document.querySelector("#accountButton");
const authModal = document.querySelector("#authModal");
const settingsModal = document.querySelector("#settingsModal");
const authForm = document.querySelector("#authForm");
const googleButton = document.querySelector("#googleButton");
const guestButton = document.querySelector("#guestButton");
const settingsForm = document.querySelector("#settingsForm");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const displayNameInput = document.querySelector("#displayNameInput");
const dobInput = document.querySelector("#dobInput");
const settingsEmailInput = document.querySelector("#settingsEmailInput");
const bioInput = document.querySelector("#bioInput");
const profileInput = document.querySelector("#profileInput");
const profilePreview = document.querySelector("#profilePreview");
const profileInitial = document.querySelector("#profileInitial");
const accountName = document.querySelector("#accountName");
const accountEmail = document.querySelector("#accountEmail");
const navItems = document.querySelectorAll(".nav-item[data-mode]");
const quickCards = document.querySelectorAll(".quick-card");
const closeModalButtons = document.querySelectorAll("[data-close-modal]");
const navStatus = document.querySelector(".nav-status");
const chatHistory = [];
const SYSTEM_PROMPT =
  "You are Nova, a clear and helpful AI assistant. Your name is Nova only. Use the requested tone. Answer conversationally, clearly, and neatly. Use actual native Unicode emoji characters only, so the user's operating system can render them. Never write emoji names, emoji shortcodes like :smile:, HTML entities, replacement boxes, or mojibake text like broken emoji gibberish. When the user sends emojis, mirror a small number of those same emojis when they fit naturally. Include 1 to 3 relevant emojis in most friendly answers. Do not spam emojis.";
const windows1252Bytes = new Map([
  ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83], ["„", 0x84], ["…", 0x85], ["†", 0x86],
  ["‡", 0x87], ["ˆ", 0x88], ["‰", 0x89], ["Š", 0x8a], ["‹", 0x8b], ["Œ", 0x8c],
  ["Ž", 0x8e], ["‘", 0x91], ["’", 0x92], ["“", 0x93], ["”", 0x94], ["•", 0x95],
  ["–", 0x96], ["—", 0x97], ["˜", 0x98], ["™", 0x99], ["š", 0x9a], ["›", 0x9b],
  ["œ", 0x9c], ["ž", 0x9e], ["Ÿ", 0x9f],
]);
const emojiShortcodes = new Map([
  [":smile:", "😄"], [":grin:", "😁"], [":joy:", "😂"], [":rofl:", "🤣"],
  [":laughing:", "😆"], [":blush:", "😊"], [":wink:", "😉"], [":heart_eyes:", "😍"],
  [":kissing_heart:", "😘"], [":thinking:", "🤔"], [":sunglasses:", "😎"],
  [":cry:", "😢"], [":sob:", "😭"], [":angry:", "😠"], [":rage:", "😡"],
  [":skull:", "💀"], [":fire:", "🔥"], [":sparkles:", "✨"], [":thumbsup:", "👍"],
]);

const userProfile = {
  name: "Guest User",
  email: "",
  dob: "",
  bio: "",
};

function scrollToLatest() {
  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  });
}

function repairBrokenEmojiText(text) {
  let repaired = text.replace(/[:][a-z0-9_+-]+[:]/gi, (shortcode) => (
    emojiShortcodes.get(shortcode.toLowerCase()) || shortcode
  ));

  if (!/[ÃÂâð][\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u02c6\u02dc\u2018-\u201e\u2020-\u2022\u2030\u2039\u203a]*/.test(repaired)) {
    return repaired;
  }

  return repaired.replace(/[ÃÂâð][\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u02c6\u02dc\u2018-\u201e\u2020-\u2022\u2030\u2039\u203a]+/g, (chunk) => {
    try {
      const bytes = Uint8Array.from(Array.from(chunk), (character) => {
        if (windows1252Bytes.has(character)) {
          return windows1252Bytes.get(character);
        }

        const code = character.charCodeAt(0);
        if (code <= 0xff) {
          return code;
        }

        throw new Error("Not mojibake.");
      });
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return chunk;
    }
  });
}

function extractSources(text) {
  const markdownLinks = [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => ({
    title: match[1],
    url: match[2].replace(/[.,;:!?]+$/, ""),
  }));
  const rawLinks = [...text.matchAll(/https?:\/\/[^\s)]+/g)].map((match) => ({
    url: match[0].replace(/[.,;:!?]+$/, ""),
  })).map((source) => {
    try {
      return {
        title: new URL(source.url).hostname.replace(/^www\./, ""),
        url: source.url,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
  const seen = new Set();

  return markdownLinks.concat(rawLinks).filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }

    seen.add(source.url);
    return true;
  });
}

function linkifyText(text) {
  const fragment = document.createDocumentFragment();
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text))) {
    fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));

    const link = document.createElement("a");
    link.href = match[2] || match[3];
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = match[1] || link.href;
    fragment.append(link);

    lastIndex = pattern.lastIndex;
  }

  fragment.append(document.createTextNode(text.slice(lastIndex)));
  return fragment;
}

function renderSources(bubble, text) {
  const sources = extractSources(text);

  if (!sources.length) {
    return;
  }

  const sourcePanel = document.createElement("div");
  sourcePanel.className = "sources-panel";

  const heading = document.createElement("p");
  heading.className = "sources-title";
  heading.textContent = "Sources";
  sourcePanel.append(heading);

  const sourceList = document.createElement("div");
  sourceList.className = "source-list";

  sources.slice(0, 5).forEach((source, index) => {
    const sourceLink = document.createElement("a");
    sourceLink.href = source.url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noreferrer";
    sourceLink.className = "source-card";

    const number = document.createElement("span");
    number.textContent = String(index + 1);

    const title = document.createElement("strong");
    title.textContent = source.title || new URL(source.url).hostname;

    const domain = document.createElement("small");
    domain.textContent = new URL(source.url).hostname.replace(/^www\./, "");

    sourceLink.append(number, title, domain);
    sourceList.append(sourceLink);
  });

  sourcePanel.append(sourceList);
  bubble.append(sourcePanel);
}

function createCopyButton(text) {
  const button = document.createElement("button");
  button.className = "copy-button";
  button.type = "button";
  button.setAttribute("aria-label", "Copy");
  button.textContent = "Copy";

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.classList.add("copied");
      button.textContent = "Copied";
      button.setAttribute("aria-label", "Copied");
      window.setTimeout(() => {
        button.classList.remove("copied");
        button.textContent = "Copy";
        button.setAttribute("aria-label", "Copy");
      }, 900);
    } catch {
      button.classList.add("copy-failed");
      button.textContent = "Failed";
      window.setTimeout(() => {
        button.classList.remove("copy-failed");
        button.textContent = "Copy";
      }, 900);
    }
  });

  return button;
}

function appendProseBox(parent, text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return;
  }

  const box = document.createElement("div");
  box.className = "answer-box prose-box";

  const toolbar = document.createElement("div");
  toolbar.className = "answer-toolbar";
  toolbar.append(createCopyButton(trimmed));

  const content = document.createElement("div");
  content.className = "answer-content";
  content.append(linkifyText(trimmed));

  box.append(toolbar, content);
  parent.append(box);
}

function appendCodeBox(parent, code, language) {
  const box = document.createElement("div");
  box.className = "answer-box code-box";

  const toolbar = document.createElement("div");
  toolbar.className = "answer-toolbar";

  const label = document.createElement("span");
  label.textContent = language || "code";

  toolbar.append(label, createCopyButton(code.trim()));

  const pre = document.createElement("pre");
  const codeElement = document.createElement("code");
  codeElement.textContent = code.trim();
  pre.append(codeElement);

  box.append(toolbar, pre);
  parent.append(box);
}

function renderReplyContent(body, text) {
  const pattern = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  body.textContent = "";

  while ((match = pattern.exec(text))) {
    appendProseBox(body, text.slice(lastIndex, match.index));
    appendCodeBox(body, match[2], match[1]);
    lastIndex = pattern.lastIndex;
  }

  appendProseBox(body, text.slice(lastIndex));
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeModal(authModal);
  closeModal(settingsModal);
}

function updateAccount() {
  const name = userProfile.name || "Guest User";
  accountName.textContent = name;
  accountEmail.textContent = userProfile.email || "Not signed in";
  profileInitial.textContent = name.trim().charAt(0).toUpperCase() || "U";
}

function enterChatMode() {
  document.body.classList.add("chat-started");
}

async function typeReplyInto(message, text) {
  const body = message.querySelector(".message-text");
  const cleanText = repairBrokenEmojiText(text);
  const characters = Array.from(cleanText);
  body.textContent = "";

  for (let index = 0; index < characters.length; index += 1) {
    body.textContent += characters[index];

    if (index % 8 === 0) {
      scrollToLatest();
      await new Promise((resolve) => window.setTimeout(resolve, 6));
    }
  }

  body.textContent = "";
  renderReplyContent(body, cleanText);
  renderSources(message.querySelector(".bubble"), cleanText);
  scrollToLatest();
}

function addMessage(role, text, options = {}) {
  const cleanText = role === "assistant" ? repairBrokenEmojiText(text) : text;
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const name = document.createElement("p");
  name.className = "message-name";
  name.textContent = role === "user" ? "You" : "Nova";

  const body = document.createElement("p");
  body.className = "message-text";
  body.textContent = cleanText;

  bubble.append(name, body);
  message.append(avatar, bubble);
  chatWindow.append(message);
  scrollToLatest();

  if (options.sources) {
    renderSources(bubble, cleanText);
  }

  return message;
}

async function getAiReply(userText) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tone: toneSelect.value,
      messages: chatHistory,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "The AI request failed.");
  }

  return data.reply;
}

function updateRuntimeStatus() {
  if (!navStatus) {
    return;
  }

  navStatus.lastChild.textContent = "Groq connected locally";
}

function resetChat() {
  chatWindow.innerHTML = "";
  chatHistory.length = 0;
  document.body.classList.remove("chat-started");
  updateMessageInputHeight();
  messageInput.focus();
}

function updateMessageInputHeight() {
  const styles = window.getComputedStyle(messageInput);
  const minHeight = Number.parseFloat(styles.minHeight) || 42;
  const lineHeight = Number.parseFloat(styles.lineHeight) || 22;
  const maxHeight = Number.parseFloat(styles.maxHeight) || 118;
  const growAfter = minHeight + lineHeight;

  messageInput.style.height = `${minHeight}px`;

  if (messageInput.scrollHeight <= growAfter) {
    messageInput.style.overflowY = "hidden";
    return;
  }

  messageInput.style.height = `${Math.min(messageInput.scrollHeight, maxHeight)}px`;
  messageInput.style.overflowY = messageInput.scrollHeight > maxHeight ? "auto" : "hidden";
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();

  if (!text) {
    messageInput.focus();
    return;
  }

  enterChatMode();
  addMessage("user", text);
  chatHistory.push({ role: "user", content: text });
  messageInput.value = "";
  updateMessageInputHeight();
  const thinkingMessage = addMessage("assistant", "Thinking...");

  try {
    const reply = await getAiReply(text);
    await typeReplyInto(thinkingMessage, reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (error) {
    thinkingMessage.querySelector(".bubble p:last-child").textContent =
      error.message;
    scrollToLatest();
  }
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

messageInput.addEventListener("input", updateMessageInputHeight);

newChatButton.addEventListener("click", resetChat);
clearChatButton.addEventListener("click", resetChat);

authButton.addEventListener("click", () => {
  openModal(authModal);
});

settingsButton.addEventListener("click", () => {
  displayNameInput.value = userProfile.name === "Guest User" ? "" : userProfile.name;
  dobInput.value = userProfile.dob;
  settingsEmailInput.value = userProfile.email;
  bioInput.value = userProfile.bio;
  openModal(settingsModal);
});

accountButton.addEventListener("click", (event) => {
  if (event.target !== profileInput && event.target.closest(".profile-photo")) {
    return;
  }

  settingsButton.click();
});

accountButton.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    settingsButton.click();
  }
});

closeModalButtons.forEach((button) => {
  button.addEventListener("click", () => {
    closeModal(button.closest(".modal-backdrop"));
  });
});

[authModal, settingsModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  userProfile.email = authEmail.value.trim();
  userProfile.name = userProfile.email.split("@")[0] || "Nova User";
  settingsEmailInput.value = userProfile.email;
  updateAccount();
  closeModal(authModal);
});

googleButton.addEventListener("click", () => {
  authEmail.value = "google.user@example.com";
  authPassword.focus();
});

guestButton.addEventListener("click", () => {
  userProfile.name = "Guest User";
  userProfile.email = "";
  updateAccount();
  closeModal(authModal);
  messageInput.focus();
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  userProfile.name = displayNameInput.value.trim() || "Guest User";
  userProfile.dob = dobInput.value;
  userProfile.email = settingsEmailInput.value.trim();
  userProfile.bio = bioInput.value.trim();
  updateAccount();
  updateRuntimeStatus();
  closeModal(settingsModal);
});

profileInput.addEventListener("change", () => {
  const file = profileInput.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    profilePreview.src = reader.result;
    profilePreview.classList.add("visible");
    profileInitial.classList.add("hidden");
  });
  reader.readAsDataURL(file);
});

function closeSidebar() {
  document.body.classList.remove("nav-open");
  menuButton.setAttribute("aria-label", "Open navigation");
}

menuButton.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("nav-open");
  menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

sidebarBackdrop.addEventListener("click", closeSidebar);

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-mode");
  themeText.textContent = isLight ? "Light" : "Dark";
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((navItem) => navItem.classList.remove("active"));
    item.classList.add("active");
    closeSidebar();
  });
});

quickCards.forEach((card) => {
  card.addEventListener("click", () => {
    messageInput.value = card.dataset.prompt;
    updateMessageInputHeight();
    messageInput.focus();
  });
});

updateAccount();
updateRuntimeStatus();
updateMessageInputHeight();
