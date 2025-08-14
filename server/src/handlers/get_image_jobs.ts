import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type ImageJob } from '../schema';
import { desc } from 'drizzle-orm';

export const getImageJobs = async (): Promise<ImageJob[]> => {
  try {
    // Query all image jobs ordered by creation date (newest first)
    const results = await db.select()
      .from(imageJobsTable)
      .orderBy(desc(imageJobsTable.created_at))
      .execute();

    // Return the results as-is since all fields are already correctly typed
    // No numeric conversions needed - all columns are text, integer, or timestamp
    return results;
  } catch (error) {
    console.error('Failed to fetch image jobs:', error);
    throw error;
  }
};