import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type GetImageJobInput, type ImageJob } from '../schema';

export const getImageJob = async (input: GetImageJobInput): Promise<ImageJob> => {
  try {
    const result = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, input.id))
      .execute();

    if (result.length === 0) {
      throw new Error(`Image job with ID ${input.id} not found`);
    }

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
    console.error('Failed to get image job:', error);
    throw error;
  }
};