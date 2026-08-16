import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "innovagrp";

// R2-dən JSON faylı oxumaq
export async function loadJSONFromR2(fileName, fallback = {}) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: `data/${fileName}`,
    });
    const response = await s3.send(command);
    const str = await response.Body.transformToString();
    return JSON.parse(str);
  } catch (err) {
    if (err.name === "NoSuchKey" || err.Code === "NoSuchKey") {
      return fallback;
    }
    console.error(`❌ R2 oxuma xətası (${fileName}):`, err.message);
    return fallback;
  }
}

// R2-yə JSON faylı yadda saxlamaq
export async function saveJSONToR2(fileName, data) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: `data/${fileName}`,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    });
    await s3.send(command);
  } catch (err) {
    console.error(`❌ R2 yazma xətası (${fileName}):`, err.message);
  }
}