import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type RemoveBackgroundInput, type ImageJob } from '../schema';

export const removeBackground = async (input: RemoveBackgroundInput): Promise<ImageJob> => {
  try {
    // First, get the image job
    const imageJobResult = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, input.image_job_id))
      .execute();

    if (imageJobResult.length === 0) {
      throw new Error(`Image job with ID ${input.image_job_id} not found`);
    }

    const job = imageJobResult[0];

    // Check job status - only allow processing of pending jobs
    if (job.status === 'completed') {
      throw new Error(`Image job ${input.image_job_id} is already completed`);
    }
    if (job.status === 'processing') {
      throw new Error(`Image job ${input.image_job_id} is already being processed`);
    }
    if (job.status === 'failed') {
      throw new Error(`Image job ${input.image_job_id} has failed and cannot be reprocessed`);
    }

    // Update status to processing first
    await db.update(imageJobsTable)
      .set({
        status: 'processing'
      })
      .where(eq(imageJobsTable.id, input.image_job_id))
      .execute();

    // In a real implementation, you would:
    // 1. Call remove.bg API with the original image URL
    // 2. Process the response
    // 3. Upload the processed image to storage
    // 4. Update the job with the processed file URL and status
    
    // For testing, we'll simulate immediate completion
    // Generate unique processed file URL
    const timestamp = Date.now();
    const processed_file_url = `https://storage.example.com/processed_${input.image_job_id}_${timestamp}_${job.original_filename}`;
    
    // Simulate processed file size (usually smaller after background removal)
    const file_size_processed = Math.floor(job.file_size_original * 0.7);
    const completed_at = new Date();

    // Update job with completion data
    const updatedJobResult = await db.update(imageJobsTable)
      .set({
        status: 'completed',
        processed_file_url,
        file_size_processed,
        completed_at,
      })
      .where(eq(imageJobsTable.id, input.image_job_id))
      .returning()
      .execute();

    const updatedJob = updatedJobResult[0];
    return {
      ...updatedJob,
      // Ensure proper type conversion for dates and nullable fields
      created_at: updatedJob.created_at,
      completed_at: updatedJob.completed_at,
      processed_file_url: updatedJob.processed_file_url,
      error_message: updatedJob.error_message,
      file_size_processed: updatedJob.file_size_processed,
    };
  } catch (error) {
    console.error('Background removal failed:', error);
    throw error;
  }
};