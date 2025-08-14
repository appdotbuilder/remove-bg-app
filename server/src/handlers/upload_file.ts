import { type UploadFileInput, type UploadFileResponse } from '../schema';

export const uploadFile = async (input: UploadFileInput): Promise<UploadFileResponse> => {
  try {
    // 1. Decode the base64 file data
    const fileBuffer = Buffer.from(input.file_data, 'base64');
    const fileSize = fileBuffer.length;
    
    // 2. Validate file size (e.g., max 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxFileSize) {
      throw new Error('File size exceeds maximum allowed size of 10MB');
    }
    
    // 3. Validate file format by checking the buffer header
    const isValidImageFormat = validateImageFormat(fileBuffer, input.mime_type);
    if (!isValidImageFormat) {
      throw new Error('Invalid image format or corrupted file');
    }
    
    // 4. Generate a unique filename to prevent conflicts
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = getFileExtension(input.mime_type);
    const uniqueFilename = `${timestamp}-${randomString}-${sanitizeFilename(input.filename)}.${fileExtension}`;
    
    // 5. In a real implementation, this would upload to cloud storage
    // For now, simulate the storage operation
    const storageUrl = await simulateFileUpload(uniqueFilename, fileBuffer);
    
    return {
      file_url: storageUrl,
      file_size: fileSize
    };
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
};

/**
 * Validate image format by checking file headers (magic bytes)
 */
function validateImageFormat(buffer: Buffer, mimeType: string): boolean {
  // Check if buffer has enough bytes
  if (buffer.length < 4) {
    return false;
  }
  
  // Check magic bytes for different image formats
  const header = buffer.subarray(0, 12);
  
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      // JPEG: FF D8 FF
      return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
      
    case 'image/png':
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
      
    case 'image/webp':
      // WebP: 52 49 46 46 (RIFF) followed by WEBP
      return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
             header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
      
    default:
      return false;
  }
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}

/**
 * Sanitize filename by removing dangerous characters
 */
function sanitizeFilename(filename: string): string {
  // Remove file extension and dangerous characters
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return nameWithoutExt
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 50); // Limit length
}

/**
 * Simulate file upload to cloud storage
 * In a real implementation, this would upload to AWS S3, Cloudinary, etc.
 */
async function simulateFileUpload(filename: string, buffer: Buffer): Promise<string> {
  // Simulate async upload delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return a mock URL
  return `https://storage.example.com/uploads/${filename}`;
}