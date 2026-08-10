export async function writeObsidianArchive(archive) {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new Error("当前浏览器不支持直接写入本地 Vault，请使用桌面版 Chrome 或 Edge。");
  }
  const directory = await window.showDirectoryPicker({ mode: "readwrite" });
  const files = normalizeArchiveFiles(archive);
  const target = await directory.getDirectoryHandle(String(archive?.folderName || "作战概念研究归档").slice(0, 120), { create: true });
  for (const item of files) await writeFile(target, item);
  return { fileName: archive.filename, directoryName: directory.name, folderName: target.name, fileCount: files.length };
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

async function writeFile(directory, item) {
  const file = await directory.getFileHandle(item.fileName, { create: true });
  const writer = await file.createWritable();
  try {
    await writer.write(item.content);
  } finally {
    await writer.close();
  }
}
