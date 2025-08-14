import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { desc } from 'drizzle-orm';
import { type ImageJob } from '../schema';

export const getImageJobs = async (): Promise<ImageJob[]> => {
  try {
    const results = await db.select()
      .from(imageJobsTable)
      .orderBy(desc(imageJobsTable.created_at))
      .execute();

    return results.map(imageJob => ({
      ...imageJob,
      // Ensure proper type conversion for dates and nullable fields
      created_at: imageJob.created_at,
      completed_at: imageJob.completed_at,
      processed_file_url: imageJob.processed_file_url,
      error_message: imageJob.error_message,
      file_size_processed: imageJob.file_size_processed,
    }));
  } catch (error) {
    console.error('Failed to get image jobs:', error);
    throw error;
  }
};