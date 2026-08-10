import { writeObsidianArchive } from "../design-studio/src/obsidianArchiveClient.js";

const root = createDirectory("Research Vault");
const previousWindow = globalThis.window;
globalThis.window = { showDirectoryPicker: async () => root };

try {
  const result = await writeObsidianArchive({
    folderName: "Research Archive",
    filename: "研究归档.md",
    files: [
      { fileName: "研究归档.md", content: "# 研究归档" },
      { fileName: "ConceptBrief.md", content: "# ConceptBrief" },
      { fileName: "OV5-a1.md", content: "# 活动" }
    ]
  });
  const target = root.directories.get("Research Archive");
  assert(result.directoryName === "Research Vault" && result.folderName === "Research Archive" && result.fileCount === 3, "Archive-set result metadata is incomplete");
  assert(target?.files.get("研究归档.md") === "# 研究归档" && target.files.get("ConceptBrief.md") === "# ConceptBrief" && target.files.get("OV5-a1.md") === "# 活动", "Archive-set writer did not persist every generated note");
  console.log("Obsidian archive-set acceptance passed: structured notes were written into a dedicated Vault directory.");
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

function createDirectory(name) {
  return {
    name,
    directories: new Map(),
    files: new Map(),
    async getDirectoryHandle(childName) {
      if (!this.directories.has(childName)) this.directories.set(childName, createDirectory(childName));
      return this.directories.get(childName);
    },
    async getFileHandle(fileName) {
      return {
        createWritable: async () => ({
          write: async (content) => { this.files.set(fileName, content); },
          close: async () => {}
        })
      };
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
