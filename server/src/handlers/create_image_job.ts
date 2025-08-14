import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type CreateImageJobInput, type ImageJob } from '../schema';

export const createImageJob = async (input: CreateImageJobInput): Promise<ImageJob> => {
  try {
    // Insert image job record
    const result = await db.insert(imageJobsTable)
      .values({
        original_filename: input.original_filename,
        original_file_url: input.original_file_url,
        file_size_original: input.file_size_original,
        status: 'pending', // Default status
      })
      .returning()
      .execute();

    const imageJob = result[0];
    return {
      ...imageJob,
      // Ensure proper type conversion for dates and nullable fields
      created_at: imageJob.created_at,
      completed_at: imageJob.completed_at,
      processed_file_url: imageJob.processed_file_url,
      error_message: imageJob.error_message,
      file_size_processed: imageJob.file_size_processed,
    };
  } catch (error) {
    console.error('Image job creation failed:', error);
    throw error;
  }
};