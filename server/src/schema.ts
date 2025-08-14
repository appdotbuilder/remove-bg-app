import { z } from 'zod';

// Image processing job schema
export const imageJobSchema = z.object({
  id: z.number(),
  original_filename: z.string(),
  original_file_url: z.string(),
  processed_file_url: z.string().nullable(), // Will be null until processing is complete
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  error_message: z.string().nullable(), // Error details if processing fails
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable(), // When processing finished
  file_size_original: z.number().int(), // Original file size in bytes
  file_size_processed: z.number().int().nullable(), // Processed file size in bytes
});

export type ImageJob = z.infer<typeof imageJobSchema>;

// Input schema for creating image processing jobs
export const createImageJobInputSchema = z.object({
  original_filename: z.string().min(1),
  original_file_url: z.string().url(),
  file_size_original: z.number().int().positive(),
});

export type CreateImageJobInput = z.infer<typeof createImageJobInputSchema>;

// Input schema for updating job status
export const updateImageJobStatusInputSchema = z.object({
  id: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  processed_file_url: z.string().url().optional(),
  error_message: z.string().optional(),
  file_size_processed: z.number().int().positive().optional(),
});

export type UpdateImageJobStatusInput = z.infer<typeof updateImageJobStatusInputSchema>;

// Input schema for file upload
export const uploadFileInputSchema = z.object({
  filename: z.string().min(1),
  file_data: z.string(), // Base64 encoded file data
  mime_type: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/), // Only allow image formats
});

export type UploadFileInput = z.infer<typeof uploadFileInputSchema>;

// Response schema for file upload
export const uploadFileResponseSchema = z.object({
  file_url: z.string().url(),
  file_size: z.number().int(),
});

export type UploadFileResponse = z.infer<typeof uploadFileResponseSchema>;

// Input schema for background removal
export const removeBackgroundInputSchema = z.object({
  image_job_id: z.number(),
});

export type RemoveBackgroundInput = z.infer<typeof removeBackgroundInputSchema>;

// Response schema for background removal (returns the updated ImageJob)
export const removeBackgroundResponseSchema = imageJobSchema;

export type RemoveBackgroundResponse = z.infer<typeof removeBackgroundResponseSchema>;

// Input schema for getting job by ID
export const getImageJobInputSchema = z.object({
  id: z.number(),
});

export type GetImageJobInput = z.infer<typeof getImageJobInputSchema>;