import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type UploadFileInput } from '../schema';
import { uploadFile } from '../handlers/upload_file';

// Create valid test image data (minimal JPEG)
const createValidJpegBase64 = (): string => {
  // Minimal JPEG header: FF D8 FF E0 00 10 4A 46 49 46 00 01 FF D9
  const jpegBytes = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xFF, 0xD9
  ]);
  return jpegBytes.toString('base64');
};

// Create valid PNG test data
const createValidPngBase64 = (): string => {
  // Minimal PNG header: 89 50 4E 47 0D 0A 1A 0A (PNG signature) + minimal content
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 image
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // RGB, no compression
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk start
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, // Minimal data
    0x01, 0x00, 0x01, 0x5C, 0xC2, 0xD5, 0x00, 0x00, // End of IDAT
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, // IEND chunk
    0x60, 0x82
  ]);
  return pngBytes.toString('base64');
};

// Create valid WebP test data
const createValidWebpBase64 = (): string => {
  // Minimal WebP header: RIFF + WebP signature
  const webpBytes = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x1A, 0x00, 0x00, 0x00, // File size
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20, // VP8 
    0x0E, 0x00, 0x00, 0x00, // Chunk size
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  return webpBytes.toString('base64');
};

// Test inputs
const validJpegInput: UploadFileInput = {
  filename: 'test-image.jpg',
  file_data: createValidJpegBase64(),
  mime_type: 'image/jpeg'
};

const validPngInput: UploadFileInput = {
  filename: 'test-image.png',
  file_data: createValidPngBase64(),
  mime_type: 'image/png'
};

const validWebpInput: UploadFileInput = {
  filename: 'test-image.webp',
  file_data: createValidWebpBase64(),
  mime_type: 'image/webp'
};

describe('uploadFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should upload a valid JPEG file', async () => {
    const result = await uploadFile(validJpegInput);

    expect(result.file_url).toBeDefined();
    expect(result.file_url).toContain('https://storage.example.com/uploads/');
    expect(result.file_url).toContain('test-image.jpg');
    expect(result.file_size).toBeGreaterThan(0);
    expect(typeof result.file_size).toBe('number');
  });

  it('should upload a valid PNG file', async () => {
    const result = await uploadFile(validPngInput);

    expect(result.file_url).toBeDefined();
    expect(result.file_url).toContain('https://storage.example.com/uploads/');
    expect(result.file_url).toContain('test-image.png');
    expect(result.file_size).toBeGreaterThan(0);
    expect(typeof result.file_size).toBe('number');
  });

  it('should upload a valid WebP file', async () => {
    const result = await uploadFile(validWebpInput);

    expect(result.file_url).toBeDefined();
    expect(result.file_url).toContain('https://storage.example.com/uploads/');
    expect(result.file_url).toContain('test-image.webp');
    expect(result.file_size).toBeGreaterThan(0);
    expect(typeof result.file_size).toBe('number');
  });

  it('should generate unique filenames for each upload', async () => {
    const result1 = await uploadFile(validJpegInput);
    const result2 = await uploadFile(validJpegInput);

    expect(result1.file_url).not.toEqual(result2.file_url);
  });

  it('should sanitize filenames with special characters', async () => {
    const inputWithSpecialChars: UploadFileInput = {
      filename: 'test file!@#$%^&*()_+{}|:"<>?[]\\;\',.jpg',
      file_data: createValidJpegBase64(),
      mime_type: 'image/jpeg'
    };

    const result = await uploadFile(inputWithSpecialChars);

    // Should contain sanitized filename without special characters
    expect(result.file_url).toContain('test_file');
    expect(result.file_url).not.toContain('!@#$%^&*()');
  });

  it('should calculate correct file size', async () => {
    const result = await uploadFile(validJpegInput);
    const expectedSize = Buffer.from(validJpegInput.file_data, 'base64').length;

    expect(result.file_size).toEqual(expectedSize);
  });

  it('should reject files that are too large', async () => {
    // Create a large file (> 10MB)
    const largeFileData = Buffer.alloc(11 * 1024 * 1024, 0xFF).toString('base64'); // 11MB of 0xFF bytes
    const largeFileInput: UploadFileInput = {
      filename: 'large-file.jpg',
      file_data: largeFileData,
      mime_type: 'image/jpeg'
    };

    await expect(uploadFile(largeFileInput)).rejects.toThrow(/file size exceeds maximum/i);
  });

  it('should reject invalid image formats', async () => {
    // Create invalid image data that doesn't match JPEG format
    const invalidImageData = Buffer.from([0x00, 0x00, 0x00, 0x00]).toString('base64');
    const invalidInput: UploadFileInput = {
      filename: 'invalid.jpg',
      file_data: invalidImageData,
      mime_type: 'image/jpeg'
    };

    await expect(uploadFile(invalidInput)).rejects.toThrow(/invalid image format/i);
  });

  it('should reject files with mismatched MIME type and content', async () => {
    // Use PNG data but claim it's JPEG
    const mismatchedInput: UploadFileInput = {
      filename: 'test.jpg',
      file_data: createValidPngBase64(),
      mime_type: 'image/jpeg' // Wrong MIME type
    };

    await expect(uploadFile(mismatchedInput)).rejects.toThrow(/invalid image format/i);
  });

  it('should handle empty file data', async () => {
    const emptyFileInput: UploadFileInput = {
      filename: 'empty.jpg',
      file_data: '',
      mime_type: 'image/jpeg'
    };

    await expect(uploadFile(emptyFileInput)).rejects.toThrow(/invalid image format/i);
  });

  it('should handle very small files gracefully', async () => {
    const tinyFileData = Buffer.from([0xFF, 0xD8]).toString('base64'); // Too small for JPEG
    const tinyFileInput: UploadFileInput = {
      filename: 'tiny.jpg',
      file_data: tinyFileData,
      mime_type: 'image/jpeg'
    };

    await expect(uploadFile(tinyFileInput)).rejects.toThrow(/invalid image format/i);
  });
});