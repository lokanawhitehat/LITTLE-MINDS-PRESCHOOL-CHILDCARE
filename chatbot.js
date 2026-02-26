const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear().toString();
}

const chatToggle = document.querySelector(".lm-chat-toggle");
const chatPanel = document.querySelector(".lm-chat");
const chatClose = document.querySelector(".lm-chat-close");
const chatHeader = document.querySelector(".lm-chat-header");
const chatMessages = document.getElementById("lm-chat-messages");
const chatForm = document.getElementById("lm-chat-form");
const chatInput = document.getElementById("lm-chat-input");
const suggestionContainer = document.getElementById("lm-chat-suggestions");
const openChatButtons = document.querySelectorAll("[data-open-chat]");
const inquiryForm = document.getElementById("inquiry-form");
const galleryImages = document.querySelectorAll("[data-gallery-img]");
const lightbox = document.getElementById("lm-lightbox");
const lightboxImg = document.getElementById("lm-lightbox-img");
const lightboxClose = lightbox ? lightbox.querySelector(".lm-lightbox-close") : null;
const lightboxBackdrop = lightbox ? lightbox.querySelector(".lm-lightbox-backdrop") : null;

const LITTLE_MINDS_CONFIG = {
  leadWebhookUrl: "", // Optional: backend endpoint to receive lead/contact data
  faqApiUrl: "", // Optional: backend endpoint that talks to OpenAI / RAG
  tourWebhookUrl: "", // Optional: backend endpoint to create Google Calendar events
};

let chatState = {
  context: null,
  pendingLead: null,
};

function sendLeadEmail(lead, options) {
  const to = "littlemindschildcarebrooklin@gmail.com";
  const subjectParts = [];
  subjectParts.push("New enquiry from Little Minds website");
  if (options && options.channel) {
    subjectParts.push(`via ${options.channel}`);
  }
  if (lead && lead.type === "tour") {
    subjectParts.push("(Tour request)");
  }
  const subject = subjectParts.join(" ");

  const lines = [];
  if (lead) {
    if (lead.parentName) lines.push(`Parent/Guardian: ${lead.parentName}`);
    if (lead.childName) lines.push(`Child: ${lead.childName}`);
    if (lead.childAge) lines.push(`Child age: ${lead.childAge}`);
    if (lead.program) lines.push(`Preferred program: ${lead.program}`);
    if (lead.phone) lines.push(`Phone: ${lead.phone}`);
    if (lead.email) lines.push(`Email: ${lead.email}`);
    if (lead.preferredSlot) lines.push(`Requested tour time: ${lead.preferredSlot}`);
    if (lead.message) lines.push(`Message: ${lead.message}`);
    if (lead.summary) lines.push(`Summary: ${lead.summary}`);
  }
  lines.push("");
  lines.push("Source: Little Minds AI / website");

  const body = lines.join("\n");
  const mailto = `mailto:${to}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  window.location.href = mailto;
}

function openChat() {
  if (!chatPanel) return;
  chatPanel.hidden = false;
  chatPanel.style.display = "flex";
  if (chatInput) chatInput.focus();
}

function closeChat() {
  if (!chatPanel) return;
  chatPanel.hidden = true;
  chatPanel.style.display = "none";
}

function toggleChat() {
  if (!chatPanel) return;
  if (chatPanel.hidden) {
    openChat();
    initialBotGreeting();
  } else {
    closeChat();
  }
}

function appendMessage({ from, text, meta }) {
  if (!chatMessages) return;
  const wrapper = document.createElement("div");
  wrapper.className = "lm-chat-message";

  const bubble = document.createElement("div");
  bubble.className =
    from === "user" ? "lm-chat-message-user" : "lm-chat-message-bot";
  bubble.textContent = text;
  wrapper.appendChild(bubble);

  if (meta) {
    const metaEl = document.createElement("div");
    metaEl.className = "lm-chat-meta";
    metaEl.textContent = meta;
    wrapper.appendChild(metaEl);
  }

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function resetContext() {
  chatState.context = null;
  chatState.pendingLead = null;
}

function initialBotGreeting() {
  if (!chatMessages || chatMessages.children.length > 0) return;
  appendMessage({
    from: "bot",
    text:
      "Hi, I’m the Little Minds AI Assistant. I can help with program details, fees, booking a school tour, or general child development questions.",
  });
  appendMessage({
    from: "bot",
    text:
      "You can also ask things like “What are your fees?”, “Do you provide meals?”, or “My child is 2 and not speaking much – is it normal?”.",
  });
}

function handleLeadSubmit(lead, options) {
  appendMessage({
    from: "bot",
    text:
      "Thank you, I’ve captured your details. Our team will reach out soon to share fees, availability, and next steps.",
  });

  try {
    sendLeadEmail(lead, options);
  } catch (e) {
    // If mail client cannot be opened, we silently ignore and still keep the on-screen confirmation.
  }

  if (LITTLE_MINDS_CONFIG.leadWebhookUrl) {
    fetch(LITTLE_MINDS_CONFIG.leadWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "little-minds-ai",
        ...lead,
        ...options,
      }),
    }).catch(() => {
      // Ignore errors on the client – leads are still visible in your inbox/logs if you store them
    });
  }
}

function handleTourBooking(message) {
  if (!chatState.pendingLead) {
    chatState.context = "tour_flow";
    chatState.pendingLead = { type: "tour" };
    appendMessage({
      from: "bot",
      text:
        "Wonderful! Let’s book a school tour. To start, may I have your name and your child’s age?",
    });
    return;
  }

  const lead = chatState.pendingLead;

  if (!lead.parentName || !lead.childAge) {
    const parts = message.split(",");
    if (parts.length >= 2) {
      lead.parentName = parts[0].trim();
      lead.childAge = parts[1].trim();
    } else {
      lead.parentName = message.trim();
    }
    appendMessage({
      from: "bot",
      text:
        "Thank you. Please share your phone number and email so we can confirm your visit.",
    });
    return;
  }

  if (!lead.phone || !lead.email) {
    const phoneMatch = message.match(/(\+?\d[\d\s]+)/);
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (phoneMatch) lead.phone = phoneMatch[0].trim();
    if (emailMatch) lead.email = emailMatch[0].trim();

    appendMessage({
      from: "bot",
      text:
        "Great. Finally, what date and approximate time works best for your tour? For example: “Next Tuesday at 10:30am”.",
    });
    return;
  }

  if (!lead.preferredSlot) {
    lead.preferredSlot = message.trim();

    appendMessage({
      from: "bot",
      text:
        "Got it. I’ll pass this along to our admissions team. They’ll confirm the exact time and share directions via WhatsApp or email.",
    });

    try {
      sendLeadEmail(lead, { channel: "chat", type: "tour" });
    } catch (e) {
      // ignore email errors
    }

    if (LITTLE_MINDS_CONFIG.tourWebhookUrl) {
      fetch(LITTLE_MINDS_CONFIG.tourWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "tour_request",
          ...lead,
        }),
      }).catch(() => {});
    }

    resetContext();
    return;
  }
}

function childDevelopmentReply(message) {
  const ageMatch = message.match(/(\d+)\s*(year|years|yr|yrs|month|months)/i);
  let response =
    "Every child develops at their own pace, and it’s normal for there to be some variation between children.";

  if (ageMatch) {
    const ageNumber = parseInt(ageMatch[1], 10);
    const unit = ageMatch[2].toLowerCase();

    if (unit.startsWith("month")) {
      if (ageNumber < 12) {
        response +=
          " Before 12 months, many children are still babbling and experimenting with sounds. We look for eye contact, responses to voices, and early babbling.";
      } else if (ageNumber <= 24) {
        response +=
          " Between 12–24 months, children usually start using simple words and short phrases. If your child is not using any words yet, it can still be within a normal range, but it’s worth gently encouraging talking through songs, reading, and naming everyday objects.";
      } else {
        response +=
          " Around 2 years, many children use simple phrases and can follow basic instructions. If your child isn’t using words or seems to have lost skills they had before, it’s a good idea to discuss this with a pediatrician or speech therapist.";
      }
    } else {
      if (ageNumber === 2) {
        response +=
          " Around 2 years, many children are combining words into short phrases and can point to familiar objects when named. Some 2‑year‑olds speak less, and that can still be okay – but we look closely at understanding, eye contact, and how they interact.";
      } else if (ageNumber === 3) {
        response +=
          " Around 3 years, children are often speaking in short sentences and can be understood much of the time by familiar adults.";
      } else {
        response +=
          " In the preschool years, language usually becomes clearer and more complex, but every child’s journey is unique.";
      }
    }
  }

  response +=
    " This is general guidance only. If you’re ever worried about your child’s development, we strongly encourage you to speak with your pediatrician, who can provide personalised advice.";

  appendMessage({ from: "bot", text: response });
}

async function faqApiReply(question) {
  if (!LITTLE_MINDS_CONFIG.faqApiUrl) {
    appendMessage({
      from: "bot",
      text:
        "Here’s what I can share based on our usual Montessori preschool policies. For detailed policies, fees, or availability, our team will be happy to confirm the exact details with you.",
    });
    return;
  }

  try {
    const res = await fetch(LITTLE_MINDS_CONFIG.faqApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        source: "little-minds-faq",
      }),
    });
    const data = await res.json();
    const answer =
      (data && (data.answer || data.message || data.text)) ||
      "I’ve received your question and our team will respond with the most accurate information from our official handbook.";
    appendMessage({ from: "bot", text: answer });
  } catch (e) {
    appendMessage({
      from: "bot",
      text:
        "I’m having trouble reaching our policy assistant right now, but I can still share general information. For exact details, our team will follow up with you directly.",
    });
  }
}

function handleSimpleFAQs(messageLower) {
  if (messageLower.includes("fee") || messageLower.includes("tuition")) {
    appendMessage({
      from: "bot",
      text:
        "Our monthly tuition varies by program and schedule. Would you like fee information for our Infant, Toddler, or Pre‑K Montessori program?",
    });
    return true;
  }

  if (messageLower.includes("infant")) {
    appendMessage({
      from: "bot",
      text:
        "Our Infant Program (6–18 months) focuses on secure attachment, gentle routines, and sensory exploration. Please share your child’s age and preferred days (full‑day or half‑day), and our team will send the exact fee structure.",
    });
    return true;
  }

  if (messageLower.includes("toddler")) {
    appendMessage({
      from: "bot",
      text:
        "Our Toddler Program (18 months–3 years) focuses on independence, language, and practical life skills. Share your preferred schedule and we’ll send you the current fee details.",
    });
    return true;
  }

  if (messageLower.includes("pre-k") || messageLower.includes("prek")) {
    appendMessage({
      from: "bot",
      text:
        "Our Pre‑K Montessori Program (3–5 years) prepares children for formal schooling with a strong foundation in language, math, and social‑emotional skills. Fees vary by timing and days per week.",
    });
    return true;
  }

  if (messageLower.includes("meal") || messageLower.includes("food")) {
    appendMessage({
      from: "bot",
      text:
        "Yes, we provide healthy vegetarian meals and snacks prepared fresh daily. We can accommodate many common dietary preferences – please share any specific needs your child has.",
    });
    return true;
  }

  if (
    messageLower.includes("timing") ||
    messageLower.includes("hours") ||
    messageLower.includes("open") ||
    messageLower.includes("closing")
  ) {
    appendMessage({
      from: "bot",
      text:
        "Our school day typically includes a morning work cycle, outdoor play, lunch, rest, and an afternoon session. Exact opening and closing times can vary, so please let me know if you prefer half‑day or full‑day care and we’ll share the detailed schedule.",
    });
    return true;
  }

  if (messageLower.includes("ratio") || messageLower.includes("teacher")) {
    appendMessage({
      from: "bot",
      text:
        "We maintain low teacher–child ratios so that each child receives calm, individual attention. Ratios differ slightly by age group, but infant groups are kept especially small.",
    });
    return true;
  }

  return false;
}

async function handleChatMessage(message) {
  const trimmed = message.trim();
  if (!trimmed) return;

  appendMessage({ from: "user", text: trimmed });

  const lower = trimmed.toLowerCase();

  if (
    lower.includes("tour") ||
    lower.includes("visit") ||
    lower.includes("book a tour")
  ) {
    handleTourBooking(trimmed);
    return;
  }

  if (chatState.context === "tour_flow") {
    handleTourBooking(trimmed);
    return;
  }

  if (
    lower.includes("age") ||
    lower.includes("speaking") ||
    lower.includes("talking") ||
    lower.includes("development") ||
    lower.includes("milestone")
  ) {
    childDevelopmentReply(trimmed);
    return;
  }

  if (handleSimpleFAQs(lower)) {
    return;
  }

  if (
    lower.includes("enroll") ||
    lower.includes("admission") ||
    lower.includes("join")
  ) {
    chatState.context = "lead_capture";
    chatState.pendingLead = { type: "enquiry" };
    appendMessage({
      from: "bot",
      text:
        "We’d be happy to share enrollment steps. May I have your name, your child’s age, and the program you’re interested in (Infant, Toddler, or Pre‑K)?",
    });
    return;
  }

  if (chatState.context === "lead_capture" && chatState.pendingLead) {
    const lead = chatState.pendingLead;
    if (!lead.summary) {
      lead.summary = trimmed;
      appendMessage({
        from: "bot",
        text:
          "Thank you. Please also share your phone number and email so our team can send you fees, availability, and next steps.",
      });
      return;
    }

    const phoneMatch = trimmed.match(/(\+?\d[\d\s]+)/);
    const emailMatch = trimmed.match(/[\w.-]+@[\w.-]+\.\w+/);
    lead.phone = phoneMatch ? phoneMatch[0].trim() : undefined;
    lead.email = emailMatch ? emailMatch[0].trim() : undefined;

    handleLeadSubmit(lead, { channel: "chat" });
    resetContext();
    return;
  }

  await faqApiReply(trimmed);
}

if (chatToggle && chatPanel) {
  chatToggle.addEventListener("click", () => {
    toggleChat();
  });
}

if (chatClose) {
  chatClose.addEventListener("click", () => {
    closeChat();
  });
}

if (chatHeader) {
  chatHeader.addEventListener("click", (event) => {
    if (event.target && event.target.closest(".lm-chat-close")) return;
    toggleChat();
  });
}

if (openChatButtons.length) {
  openChatButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      openChat();
      initialBotGreeting();
    });
  });
}

if (chatForm && chatInput) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = chatInput.value;
    chatInput.value = "";
    handleChatMessage(value);
  });
}

if (suggestionContainer) {
  suggestionContainer.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.matches("button[data-suggest]")) {
      const text = target.getAttribute("data-suggest") || "";
      handleChatMessage(text);
    }
  });
}

if (inquiryForm) {
  inquiryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(inquiryForm);
    const lead = {
      parentName: formData.get("parentName") || "",
      phone: formData.get("phone") || "",
      email: formData.get("email") || "",
      childName: formData.get("childName") || "",
      childAge: formData.get("childAge") || "",
      program: formData.get("program") || "",
      message: formData.get("message") || "",
    };

    handleLeadSubmit(lead, { channel: "contact_form" });
    inquiryForm.reset();
  });
}

window.addEventListener("load", () => {
  setTimeout(initialBotGreeting, 600);
  if (chatPanel) {
    chatPanel.hidden = true;
    chatPanel.style.display = "none";
  }
});

function openLightbox(src, alt) {
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = src;
  lightboxImg.alt = alt || "Enlarged Little Minds photo";
  lightbox.hidden = false;
}

function closeLightbox() {
  if (!lightbox || !lightboxImg) return;
  lightbox.hidden = true;
  lightboxImg.src = "";
}

if (galleryImages.length && lightbox) {
  galleryImages.forEach((img) => {
    img.addEventListener("click", () => {
      openLightbox(img.src, img.alt);
    });
  });
}

if (lightboxClose) {
  lightboxClose.addEventListener("click", () => {
    closeLightbox();
  });
}

if (lightboxBackdrop) {
  lightboxBackdrop.addEventListener("click", () => {
    closeLightbox();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLightbox();
  }
});

