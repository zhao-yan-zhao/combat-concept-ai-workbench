import { buildVaultSummary, importVaultFiles, searchKnowledge } from "../../shared/knowledge.js";
import { filterKnowledgeDocuments } from "../../server/projectKnowledgeSensitivity.mjs";

const STORAGE_KEY = "concept-studio-knowledge-v1";

export function loadKnowledgeVault() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved?.docs)) return createVault(saved.docs);
  } catch {
    // Invalid local data is treated as an unconnected vault.
  }
  return createVault([]);
}

export async function importKnowledgeVault(files) {
  const docs = await importVaultFiles(files);
  const vault = createVault(docs);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ docs: vault.docs }));
  return vault;
}

export function clearKnowledgeVault() {
  localStorage.removeItem(STORAGE_KEY);
}

export function searchEvidence(query, vault, limit = 4, options = {}) {
  return searchKnowledge(query, filterKnowledgeDocuments(vault?.docs, options).docs, limit);
}

export function findKnowledgeNote(noteId, vault) {
  return (vault?.docs || []).find((note) => note.id === noteId) || null;
}

function createVault(docs) {
  return { docs, summary: docs.length ? buildVaultSummary(docs) : null };
}
