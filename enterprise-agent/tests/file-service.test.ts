import { describe, it, expect, beforeEach } from "vitest";
import { FileService, createFileService } from "../src/services/file.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, "test-data", `file-test-${Date.now()}`);

describe("FileService", () => {
  let fileService: FileService;

  beforeEach(async () => {
    fileService = createFileService({
      baseDir: TEST_DIR,
      maxFileSize: 1024 * 1024, // 1MB
      allowedExtensions: [".txt", ".md", ".json", ".js", ".py"],
    });
    await fileService.initialize();
  });

  it("should create directory", async () => {
    const result = await fileService.createDirectory("/test-dir");
    
    expect(result.success).toBe(true);
    
    // 验证目录存在
    const checkResult = await fileService.exists("/test-dir");
    expect(checkResult.data).toBe(true);
  });

  it("should write and read file", async () => {
    const content = "Hello, World!";
    const writeResult = await fileService.write("/test.txt", content);
    
    expect(writeResult.success).toBe(true);
    expect(writeResult.data?.size).toBe(content.length);

    const readResult = await fileService.read("/test.txt");
    
    expect(readResult.success).toBe(true);
    expect(readResult.data).toBe(content);
  });

  it("should list directory", async () => {
    await fileService.write("/dir/file1.txt", "content1");
    await fileService.write("/dir/file2.txt", "content2");

    const result = await fileService.list("/dir");
    
    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(2);
  });

  it("should check file exists", async () => {
    await fileService.write("/exists.txt", "test");

    const exists = await fileService.exists("/exists.txt");
    expect(exists.data).toBe(true);

    const notExists = await fileService.exists("/not-exists.txt");
    expect(notExists.data).toBe(false);
  });

  it("should get file info", async () => {
    await fileService.write("/info.txt", "test content");

    const result = await fileService.getInfo("/info.txt");
    
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("info.txt");
    expect(result.data?.extension).toBe(".txt");
  });

  it("should copy file", async () => {
    await fileService.write("/source.txt", "source content");
    
    const result = await fileService.copy("/source.txt", "/dest.txt");
    
    expect(result.success).toBe(true);
    
    const readResult = await fileService.read("/dest.txt");
    expect(readResult.data).toBe("source content");
  });

  it("should move file", async () => {
    await fileService.write("/old.txt", "content");
    
    const moveResult = await fileService.move("/old.txt", "/new.txt");
    
    expect(moveResult.success).toBe(true);
    
    const oldExists = await fileService.exists("/old.txt");
    const newExists = await fileService.exists("/new.txt");
    
    expect(oldExists.data).toBe(false);
    expect(newExists.data).toBe(true);
  });

  it("should search files", async () => {
    await fileService.write("/search/test1.txt", "test content 1");
    await fileService.write("/search/test2.txt", "test content 2");
    await fileService.write("/search/other.txt", "other");

    const result = await fileService.search("test", "/search");
    
    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(2);
  });

  it("should delete file", async () => {
    await fileService.write("/delete.txt", "to delete");
    
    const result = await fileService.delete("/delete.txt");
    
    expect(result.success).toBe(true);
    
    const exists = await fileService.exists("/delete.txt");
    expect(exists.data).toBe(false);
  });
});
