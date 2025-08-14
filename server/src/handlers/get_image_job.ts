import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type GetImageJobInput, type ImageJob } from '../schema';

export const getImageJob = async (input: GetImageJobInput): Promise<ImageJob> => {
  try {
    // Fetch the image job by ID
    const results = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, input.id))
      .execute();

    // Check if job exists
    if (results.length === 0) {
      throw new Error(`Image job with ID ${input.id} not found`);
    }

    // Return the job data
    const job = results[0];
    return {
      id: job.id,
      original_filename: job.original_filename,
      original_file_url: job.original_file_url,
      processed_file_url: job.processed_file_url,
      status: job.status,
      error_message: job.error_message,
      created_at: job.created_at,
      completed_at: job.completed_at,
      file_size_original: job.file_size_original,
      file_size_processed: job.file_size_processed
    };
  } catch (error) {
    console.error('Failed to get image job:', error);
    throw error;
  }
};