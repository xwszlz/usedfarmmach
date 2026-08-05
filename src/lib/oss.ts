import path from "path";
import fs from "fs/promises";

/**
 * MVP: Upload files to local public/uploads directory.
 * Production: Replace with Aliyun OSS upload.
 */

export async function getUploadDir(): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

export function getPublicUrl(filename: string): string {
  return `/uploads/${filename}`;
}

export async function uploadFile(
  file: File,
  subfolder: string = ""
): Promise<{ url: string; filename: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || ".jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const relativePath = subfolder ? `${subfolder}/${uniqueName}` : uniqueName;

  const uploadDir = await getUploadDir();
  const targetDir = subfolder
    ? path.join(uploadDir, subfolder)
    : uploadDir;

  await fs.mkdir(targetDir, { recursive: true });

  const filePath = path.join(targetDir, uniqueName);
  await fs.writeFile(filePath, buffer);

  return {
    url: getPublicUrl(relativePath),
    filename: uniqueName,
  };
}

// OSS upload placeholder for production
export async function uploadToOss(
  _file: File,
  _folder: string = ""
): Promise<{ url: string; key: string }> {
  // TODO: Implement Aliyun OSS upload
  throw new Error("OSS upload not implemented yet. Use local upload for MVP.");
}
