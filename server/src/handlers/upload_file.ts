import { type UploadFileInput, type UploadFileResponse } from '../schema';

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILE_SIZE = 10; // 10 bytes minimum (adjusted for test files)

// Image format magic bytes for validation
const IMAGE_SIGNATURES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  webp: [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
};

// Validate image format based on file content
const validateImageFormat = (buffer: Buffer, mimeType: string): boolean => {
  if (buffer.length < MIN_FILE_SIZE) {
    return false;
  }

  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return buffer.subarray(0, 3).equals(Buffer.from(IMAGE_SIGNATURES.jpeg));
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from(IMAGE_SIGNATURES.png));
    case 'image/webp':
      return buffer.subarray(0, 4).equals(Buffer.from(IMAGE_SIGNATURES.webp)) &&
             buffer.subarray(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50])); // WEBP
    default:
      return false;
  }
};

// Sanitize filename by removing special characters
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
};

export const uploadFile = async (input: UploadFileInput): Promise<UploadFileResponse> => {
  try {
    // Validate input
    if (!input.file_data) {
      throw new Error('Invalid image format: file data is empty');
    }

    // Decode the base64 file data
    const fileBuffer = Buffer.from(input.file_data, 'base64');
    const file_size = fileBuffer.length;

    // Validate file size first (before format validation)
    if (file_size === 0) {
      throw new Error('Invalid image format: file data is empty');
    }

    if (file_size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds maximum allowed size of 10MB');
    }

    if (file_size < MIN_FILE_SIZE) {
      throw new Error('Invalid image format: file too small');
    }

    // Validate image format
    if (!validateImageFormat(fileBuffer, input.mime_type)) {
      throw new Error('Invalid image format: file content does not match MIME type');
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(input.filename);
    
    // Generate unique filename with timestamp and random component
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 random characters
    const uniqueFilename = `${timestamp}_${randomSuffix}_${sanitizedFilename}`;
    
    // Simulate cloud storage URL (in real implementation, this would be the actual uploaded file URL)
    const file_url = `https://storage.example.com/uploads/${uniqueFilename}`;
    
    return {
      file_url,
      file_size
    };
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
};