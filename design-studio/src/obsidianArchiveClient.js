export async function writeObsidianArchive(archive, options = {}) {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new Error("当前浏览器不支持直接写入本地 Vault，请使用桌面版 Chrome 或 Edge。");
  }
  const root = await window.showDirectoryPicker({ mode: "readwrite" });
  const designatedDir = archive?.designatedDir || options?.designatedDir;
  let targetParent = root;
  if (designatedDir) {
    targetParent = await root.getDirectoryHandle(String(designatedDir).slice(0, 120), { create: true });
  }

  const folderName = String(archive?.folderName || "作战概念研究归档").slice(0, 120);
  const target = await targetParent.getDirectoryHandle(folderName, { create: true });
  const files = normalizeArchiveFiles(archive);
  for (const item of files) {
    await writeNewFileSafely(target, item);
  }
  return {
    fileName: archive.filename,
    directoryName: root.name,
    parentFolderName: targetParent.name,
    folderName: target.name,
    fileCount: files.length
  };
}

function normalizeArchiveFiles(archive) {
  const files = Array.isArray(archive?.files) && archive.files.length
    ? archive.files
    : [{ fileName: archive?.filename, content: archive?.content }];
  return files.map((item) => {
    const fileName = String(item?.fileName || "").trim();
    if (!fileName || /[\\/]/.test(fileName)) throw new Error("Obsidian 归档文件名无效");
    return { fileName: fileName.slice(0, 180), content: String(item?.content || "") };
  });
}

async function writeNewFileSafely(directory, item) {
  let fileName = item.fileName;
  // 严格遵守“绝不修改已有笔记”：如遇同名笔记，派生新文件名
  let exists = await checkFileExists(directory, fileName);

  if (exists) {
    const extMatch = fileName.match(/(\.[^.]+)$/);
    const base = extMatch ? fileName.slice(0, -extMatch[1].length) : fileName;
    const ext = extMatch ? extMatch[1] : ".md";
    let counter = 1;
    while (exists && counter < 20) {
      fileName = `${base}_${counter}${ext}`;
      exists = await checkFileExists(directory, fileName);
      counter += 1;
    }
  }

  const file = await directory.getFileHandle(fileName, { create: true });
  const writer = await file.createWritable();
  try {
    await writer.write(item.content);
  } finally {
    await writer.close();
  }
}

async function checkFileExists(directory, fileName) {
  if (directory?.files instanceof Map) {
    return directory.files.has(fileName);
  }
  try {
    const handle = await directory.getFileHandle(fileName, { create: false });
    return Boolean(handle);
  } catch {
    return false;
  }
}
