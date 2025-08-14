import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateImageJobStatusInput, type ImageJob } from '../schema';

export const updateImageJobStatus = async (input: UpdateImageJobStatusInput): Promise<ImageJob> => {
  try {
    // Build update object dynamically based on provided fields
    const updateData: any = {
      status: input.status,
    };

    if (input.processed_file_url) {
      updateData.processed_file_url = input.processed_file_url;
    }

    if (input.error_message) {
      updateData.error_message = input.error_message;
    }

    if (input.file_size_processed) {
      updateData.file_size_processed = input.file_size_processed;
    }

    // Set completed_at timestamp if status is completed or failed
    if (input.status === 'completed' || input.status === 'failed') {
      updateData.completed_at = new Date();
    }

    const result = await db.update(imageJobsTable)
      .set(updateData)
      .where(eq(imageJobsTable.id, input.id))
      .returning()
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
    console.error('Failed to update image job status:', error);
    throw error;
  }
};