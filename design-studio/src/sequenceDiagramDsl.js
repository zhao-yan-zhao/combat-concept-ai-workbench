/**
 * Convert OV-6c sequence models to open-source diagram DSLs, and parse editable DSLs back.
 * Engines: Mermaid, js-sequence-diagrams, PlantUML (text export).
 */

export const SEQUENCE_DIAGRAM_ENGINES = Object.freeze([
  {
    id: "workbench",
    label: "画布编辑",
    license: "project",
    source: "",
    hint: "在画布上直接改生命线/消息（主编辑）"
  },
  {
    id: "js-sequence",
    label: "UML 序列",
    license: "BSD",
    source: "https://github.com/bramp/js-sequence-diagrams",
    hint: "画布编辑 + UML 预览/文本"
  },
  {
    id: "mermaid",
    label: "Mermaid",
    license: "MIT",
    source: "https://github.com/mermaid-js/mermaid",
    hint: "画布编辑 + Mermaid 预览/文本"
  }
]);

export function resolveSequenceDiagramEngine(value = "workbench") {
  const id = String(value || "workbench").trim();
  return SEQUENCE_DIAGRAM_ENGINES.some((item) => item.id === id) ? id : "workbench";
}

export function sequenceToMermaid(sequence = {}) {
  const participants = Array.isArray(sequence.participants) ? sequence.participants : [];
  const messages = sortedMessages(sequence);
  const lines = ["sequenceDiagram", "  autonumber"];
  participants.forEach((participant) => {
    const alias = safeId(participant.id || participant.name, "P");
    const name = safeLabel(participant.name || participant.id || alias);
    lines.push(`  participant ${alias} as ${name}`);
  });
  if (!participants.length) {
    lines.push("  participant A as 参与方 A");
    lines.push("  participant B as 参与方 B");
  }
  messages.forEach((message) => {
    const from = safeId(message.fromRef || participants[0]?.id, "A");
    const to = safeId(message.toRef || participants[1]?.id || participants[0]?.id, "B");
    const label = safeLabel(message.name || message.title || message.id || "消息");
    const arrow = message.type === "response" ? "-->>" : "->>";
    lines.push(`  ${from}${arrow}${to}: ${label}`);
  });
  if (!messages.length) {
    lines.push("  Note over A,B: 尚无消息");
  }
  return lines.join("\n");
}

export function sequenceToJsSequence(sequence = {}) {
  const participants = Array.isArray(sequence.participants) ? sequence.participants : [];
  const messages = sortedMessages(sequence);
  const lines = [];
  const aliasOf = (value, fallback = "P") => safeActorId(value, fallback);
  if (sequence.name) lines.push(`title ${safePlain(sequence.name)}`);
  participants.forEach((participant, index) => {
    const alias = aliasOf(participant.id || participant.name || `P${index + 1}`, `P${index + 1}`);
    const name = safePlain(participant.name || participant.id || alias);
    if (name && name !== alias) lines.push(`participant ${name} as ${alias}`);
    else lines.push(`participant ${alias}`);
  });
  if (!participants.length) {
    lines.push("participant 参与方 A as A");
    lines.push("participant 参与方 B as B");
  }
  messages.forEach((message) => {
    const from = aliasOf(message.fromRef || participants[0]?.id || "A", "A");
    const to = aliasOf(message.toRef || participants[1]?.id || participants[0]?.id || "B", "B");
    const label = safePlain(message.name || message.title || message.id || "消息");
    const arrow = message.type === "response" ? "-->" : "->";
    lines.push(`${from}${arrow}${to}: ${label}`);
  });
  if (!messages.length) {
    lines.push("Note over A,B: 尚无消息");
  }
  return lines.join("\n");
}

export function sequenceToPlantUml(sequence = {}) {
  const participants = Array.isArray(sequence.participants) ? sequence.participants : [];
  const messages = sortedMessages(sequence);
  const lines = ["@startuml", "skinparam shadowing false", "autonumber"];
  if (sequence.name) lines.push(`title ${safePlain(sequence.name)}`);
  participants.forEach((participant) => {
    const alias = safeId(participant.id || participant.name, "P");
    const name = safePlain(participant.name || participant.id || alias);
    lines.push(`participant "${name}" as ${alias}`);
  });
  if (!participants.length) {
    lines.push('participant "参与方 A" as A');
    lines.push('participant "参与方 B" as B');
  }
  messages.forEach((message) => {
    const from = safeId(message.fromRef || participants[0]?.id, "A");
    const to = safeId(message.toRef || participants[1]?.id || participants[0]?.id, "B");
    const label = safePlain(message.name || message.title || message.id || "消息");
    const arrow = message.type === "response" ? "-->" : "->";
    lines.push(`${from} ${arrow} ${to} : ${label}`);
  });
  if (!messages.length) lines.push("note over A,B: 尚无消息");
  lines.push("@enduml");
  return lines.join("\n");
}

export function dslForEngine(sequence, engineId = "mermaid") {
  const engine = resolveSequenceDiagramEngine(engineId);
  if (engine === "js-sequence") return sequenceToJsSequence(sequence);
  if (engine === "workbench") return sequenceToMermaid(sequence);
  return sequenceToMermaid(sequence);
}

/**
 * Parse editable js-sequence-diagrams DSL into a sequence partial.
 * Supports: title, participant [Name as] alias, A->B: msg, A-->B: msg, Note over A,B: text
 */
export function parseJsSequenceDsl(text = "") {
  const lines = String(text || "").split(/\r?\n/);
  let name = "";
  const participants = [];
  const aliasOrder = [];
  const aliasToId = new Map();
  const messages = [];

  const ensureActor = (token) => {
    const raw = String(token || "").trim().replace(/^"|"$/g, "");
    if (!raw) return "";
    const id = safeActorId(raw);
    if (!aliasToId.has(id)) {
      aliasToId.set(id, id);
      participants.push({ id, name: raw, ref: "" });
      aliasOrder.push(id);
    }
    return id;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line || line.startsWith("#")) continue;

    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      name = titleMatch[1].trim().slice(0, 240);
      continue;
    }

    const participantMatch = /^participant\s+(.+)$/i.exec(line);
    if (participantMatch) {
      const body = participantMatch[1].trim();
      const asMatch = /^(.+?)\s+as\s+(\S+)$/i.exec(body);
      if (asMatch) {
        const display = asMatch[1].trim().replace(/^"|"$/g, "");
        const alias = safeActorId(asMatch[2].trim());
        if (!aliasToId.has(alias)) {
          aliasToId.set(alias, alias);
          participants.push({ id: alias, name: display || alias, ref: "" });
          aliasOrder.push(alias);
        } else {
          const hit = participants.find((item) => item.id === alias);
          if (hit && display) hit.name = display;
        }
      } else {
        ensureActor(body.replace(/^"|"$/g, ""));
      }
      continue;
    }

    if (/^note\b/i.test(line)) continue;

    const signalMatch = /^(.+?)(\-{1,2}>{1,2})(.+?):\s*(.+)$/.exec(line);
    if (signalMatch) {
      const from = ensureActor(signalMatch[1]);
      const arrow = signalMatch[2];
      const to = ensureActor(signalMatch[3]);
      const label = signalMatch[4].trim().slice(0, 240) || `消息 ${messages.length + 1}`;
      const type = arrow.includes("--") ? "response" : "message";
      if (from && to) {
        messages.push({
          id: `event-dsl-${messages.length + 1}`,
          sequence: messages.length + 1,
          fromRef: from,
          toRef: to,
          name: label,
          title: label,
          type,
          condition: "",
          relatedActivityRefs: []
        });
      }
    }
  }

  if (!participants.length) {
    participants.push(
      { id: "participant-a", name: "参与方 A", ref: "" },
      { id: "participant-b", name: "参与方 B", ref: "" }
    );
  }

  return { name, participants, messages };
}

/**
 * Parse a minimal Mermaid sequenceDiagram subset back into a sequence partial.
 */
export function parseMermaidSequenceDsl(text = "") {
  const source = String(text || "");
  const lines = source.split(/\r?\n/);
  let name = "";
  const participants = [];
  const aliasToId = new Map();
  const messages = [];

  const ensureActor = (token, display = "") => {
    const raw = String(token || "").trim();
    if (!raw) return "";
    const id = safeActorId(raw);
    if (!aliasToId.has(id)) {
      aliasToId.set(id, id);
      participants.push({ id, name: display || raw, ref: "" });
    } else if (display) {
      const hit = participants.find((item) => item.id === id);
      if (hit) hit.name = display;
    }
    return id;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line || line === "sequenceDiagram" || line === "autonumber" || line.startsWith("%%")) continue;

    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      name = titleMatch[1].trim().slice(0, 240);
      continue;
    }

    const participantMatch = /^(?:participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i.exec(line);
    if (participantMatch) {
      ensureActor(participantMatch[1], (participantMatch[2] || "").trim());
      continue;
    }

    if (/^note\b/i.test(line) || /^loop\b/i.test(line) || /^alt\b/i.test(line) || line === "end") continue;

    const signalMatch = /^(\S+)\s*(-->>|->>|-->|->)\s*(\S+)\s*:\s*(.+)$/.exec(line);
    if (signalMatch) {
      const from = ensureActor(signalMatch[1]);
      const arrow = signalMatch[2];
      const to = ensureActor(signalMatch[3]);
      const label = signalMatch[4].trim().slice(0, 240) || `消息 ${messages.length + 1}`;
      const type = arrow.includes("--") ? "response" : "message";
      if (from && to) {
        messages.push({
          id: `event-dsl-${messages.length + 1}`,
          sequence: messages.length + 1,
          fromRef: from,
          toRef: to,
          name: label,
          title: label,
          type,
          condition: "",
          relatedActivityRefs: []
        });
      }
    }
  }

  if (!participants.length) {
    participants.push(
      { id: "A", name: "参与方 A", ref: "" },
      { id: "B", name: "参与方 B", ref: "" }
    );
  }

  return { name, participants, messages };
}

export function parseSequenceDsl(text = "", engineId = "js-sequence") {
  const engine = resolveSequenceDiagramEngine(engineId);
  if (engine === "mermaid") return parseMermaidSequenceDsl(text);
  return parseJsSequenceDsl(text);
}

/**
 * Merge parsed DSL into an existing sequence, preserving message activity links when possible.
 */
export function mergeParsedSequence(existing = {}, parsed = {}) {
  const prevMessages = Array.isArray(existing.messages) ? existing.messages : [];
  const prevByKey = new Map(prevMessages.map((item) => [
    messageKey(item),
    item
  ]));
  const prevByName = new Map();
  prevMessages.forEach((item) => {
    const key = String(item.name || item.title || "").trim();
    if (key && !prevByName.has(key)) prevByName.set(key, item);
  });

  const participants = (Array.isArray(parsed.participants) ? parsed.participants : [])
    .slice(0, 40)
    .map((item, index) => ({
      id: String(item.id || `participant-${index + 1}`).slice(0, 160),
      name: String(item.name || item.id || `参与方 ${index + 1}`).slice(0, 240),
      ref: String(item.ref || existing.participants?.find((p) => p.id === item.id)?.ref || "").slice(0, 160)
    }));

  const messages = (Array.isArray(parsed.messages) ? parsed.messages : [])
    .slice(0, 200)
    .map((item, index) => {
      const name = String(item.name || item.title || `消息 ${index + 1}`).slice(0, 240);
      const fromRef = String(item.fromRef || participants[0]?.id || "").slice(0, 160);
      const toRef = String(item.toRef || participants[1]?.id || participants[0]?.id || "").slice(0, 160);
      const prev = prevByKey.get(messageKey({ fromRef, toRef, name }))
        || prevByName.get(name)
        || prevMessages[index]
        || null;
      return {
        id: String(prev?.id || item.id || `event-${index + 1}`).slice(0, 180),
        sequence: index + 1,
        fromRef,
        toRef,
        name,
        title: name,
        type: String(item.type || prev?.type || "message").slice(0, 40),
        condition: String(item.condition || prev?.condition || "").slice(0, 800),
        relatedActivityRefs: Array.isArray(prev?.relatedActivityRefs)
          ? prev.relatedActivityRefs
          : (Array.isArray(item.relatedActivityRefs) ? item.relatedActivityRefs : []),
        ruleRefs: Array.isArray(prev?.ruleRefs) ? prev.ruleRefs : [],
        stateTransitionRefs: Array.isArray(prev?.stateTransitionRefs) ? prev.stateTransitionRefs : []
      };
    });

  return {
    id: existing.id,
    name: String(parsed.name || existing.name || "事件序列").slice(0, 240),
    participants,
    messages,
    fragments: Array.isArray(existing.fragments) ? existing.fragments : []
  };
}

function messageKey(item = {}) {
  return `${item.fromRef || ""}>${item.toRef || ""}:${String(item.name || item.title || "").trim()}`;
}

function safeActorId(value, fallback = "P") {
  const raw = String(value || fallback).trim() || fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9_\u4e00-\u9fff\-]/g, "_");
  if (!cleaned) return fallback;
  // js-sequence-diagrams aliases can be free text; keep readable ids
  return cleaned.slice(0, 80);
}

function sortedMessages(sequence = {}) {
  return [...(Array.isArray(sequence.messages) ? sequence.messages : [])]
    .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0) || String(a.id || "").localeCompare(String(b.id || "")));
}

function safeId(value, fallback = "P") {
  const raw = String(value || fallback).trim() || fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `P_${cleaned}`;
}

// Keep actor ids in exported Mermaid/PlantUML restricted to ASCII for engine safety.
function safeExportActorId(value, fallback = "P") {
  return safeId(value, fallback);
}

function safeLabel(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[:#]/g, "·")
    .trim()
    .slice(0, 80) || "未命名";
}

function safePlain(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[:]/g, "·")
    .trim()
    .slice(0, 80) || "未命名";
}
