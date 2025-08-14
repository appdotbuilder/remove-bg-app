import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type UpdateImageJobStatusInput, type ImageJob } from '../schema';
import { eq } from 'drizzle-orm';

export const updateImageJobStatus = async (input: UpdateImageJobStatusInput): Promise<ImageJob> => {
  try {
    // Build update values object
    const updateValues: Partial<typeof imageJobsTable.$inferInsert> = {
      status: input.status,
    };

    // Set completed_at timestamp when status changes to 'completed' or 'failed'
    if (['completed', 'failed'].includes(input.status)) {
      updateValues.completed_at = new Date();
    }

    // Update processed_file_url when processing is successful
    if (input.processed_file_url) {
      updateValues.processed_file_url = input.processed_file_url;
    }

    // Store error_message when processing fails
    if (input.error_message) {
      updateValues.error_message = input.error_message;
    }

    // Store processed file size if provided
    if (input.file_size_processed !== undefined) {
      updateValues.file_size_processed = input.file_size_processed;
    }

    // Update the job record
    const result = await db.update(imageJobsTable)
      .set(updateValues)
      .where(eq(imageJobsTable.id, input.id))
      .returning()
      .execute();

    // Check if job exists
    if (result.length === 0) {
      throw new Error(`Image job with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Image job status update failed:', error);
    throw error;
  }
};