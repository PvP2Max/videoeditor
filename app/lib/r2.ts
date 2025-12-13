import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import fs from "fs";

let client: S3Client | null = null;
let bucketName: string | null = null;

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
};

const getClient = () => {
  if (client && bucketName) {
    return { s3: client, bucket: bucketName };
  }
  const endpoint = required("R2_ENDPOINT");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  const region = process.env.R2_REGION ?? "auto";
  bucketName = required("R2_BUCKET");
  client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true
  });
  return { s3: client, bucket: bucketName };
};

export const uploadStream = async (key: string, contentType: string, body: Readable | Buffer) => {
  const { s3, bucket } = getClient();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  });
  await s3.send(command);
};

export const uploadBuffer = async (key: string, buffer: Buffer, contentType: string) => {
  await uploadStream(key, contentType, buffer);
};

export const getDownloadUrl = async (key: string, expiresIn = 300) => {
  const { s3, bucket } = getClient();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });
  return getSignedUrl(s3, command, { expiresIn });
};

export const downloadToFile = async (key: string, filePath: string) => {
  const { s3, bucket } = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  if (!response.Body) throw new Error("Empty R2 response body");
  const body = response.Body as Readable;
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    body.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
};

export const streamFromR2 = async (key: string): Promise<Readable> => {
  const { s3, bucket } = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  if (!response.Body) throw new Error("Empty R2 response body");
  return response.Body as Readable;
};

export const r2Bucket = () => getClient().bucket;
