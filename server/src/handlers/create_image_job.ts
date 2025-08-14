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
        status: 'pending' // Default status for new jobs
        // Other fields (processed_file_url, error_message, completed_at, file_size_processed) 
        // are nullable and will default to null
      })
      .returning()
      .execute();

    // Return the created job - no numeric conversions needed as all fields are text/integer/enum/timestamp
    return result[0];
  } catch (error) {
    console.error('Image job creation failed:', error);
    throw error;
  }
};