import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

let _s3 = null;

export function isR2Configured() {
  return Boolean(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

function getS3Client() {
  if (!isR2Configured()) return null;
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3;
}

function getBucket() {
  return process.env.R2_BUCKET_NAME || "innovagrp";
}

// Cloudflare R2-dən JSON faylı oxumaq
export async function loadJSONFromR2(fileName, fallback = null) {
  if (!isR2Configured()) return fallback;
  const s3 = getS3Client();
  if (!s3) return fallback;

  try {
    const command = new GetObjectCommand({
      Bucket: getBucket(),
      Key: `data/${fileName}`,
    });
    const response = await s3.send(command);
    const str = await response.Body.transformToString();
    if (!str || !str.trim()) return fallback;
    return JSON.parse(str);
  } catch (err) {
    const code = err.name || err.Code || err.$metadata?.httpStatusCode;
    if (code === "NoSuchKey" || code === 404 || err.message?.includes("NoSuchKey")) {
      return fallback;
    }
    console.error(`❌ Cloudflare R2 oxuma xətası (${fileName}):`, err.message);
    return fallback;
  }
}

// Cloudflare R2-yə JSON faylı yadda saxlamaq
export async function saveJSONToR2(fileName, data) {
  if (!isR2Configured()) return false;
  const s3 = getS3Client();
  if (!s3) return false;

  try {
    const command = new PutObjectCommand({
      Bucket: getBucket(),
      Key: `data/${fileName}`,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    });
    await s3.send(command);
    return true;
  } catch (err) {
    console.error(`❌ Cloudflare R2 yazma xətası (${fileName}):`, err.message);
    return false;
  }
}