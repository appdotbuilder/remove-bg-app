import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type RemoveBackgroundInput, type ImageJob } from '../schema';
import { eq } from 'drizzle-orm';

export const removeBackground = async (input: RemoveBackgroundInput): Promise<ImageJob> => {
  try {
    // 1. Fetch the image job by ID
    const existingJobs = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, input.image_job_id))
      .execute();

    if (existingJobs.length === 0) {
      throw new Error(`Image job with ID ${input.image_job_id} not found`);
    }

    const job = existingJobs[0];

    // Check if job is already processed or processing
    if (job.status === 'completed') {
      throw new Error(`Image job ${input.image_job_id} is already completed`);
    }

    if (job.status === 'processing') {
      throw new Error(`Image job ${input.image_job_id} is already being processed`);
    }

    if (job.status === 'failed') {
      throw new Error(`Image job ${input.image_job_id} has failed and cannot be reprocessed`);
    }

    // 2. Update status to 'processing'
    await db.update(imageJobsTable)
      .set({ 
        status: 'processing'
      })
      .where(eq(imageJobsTable.id, input.image_job_id))
      .execute();

    try {
      // 3. Simulate calling remove.bg API with the original image URL
      // In a real implementation, this would make an HTTP request to remove.bg
      const processedFileUrl = `https://storage.example.com/processed_${job.id}_${Date.now()}.png`;
      const processedFileSize = Math.floor(job.file_size_original * 0.7); // Simulate size reduction

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // 4. & 5. Update the job with processed file URL and 'completed' status
      const updatedResults = await db.update(imageJobsTable)
        .set({
          status: 'completed',
          processed_file_url: processedFileUrl,
          file_size_processed: processedFileSize,
          completed_at: new Date(),
          error_message: null
        })
        .where(eq(imageJobsTable.id, input.image_job_id))
        .returning()
        .execute();

      return updatedResults[0];

    } catch (processingError) {
      // 6. Handle errors by setting status to 'failed' and storing error message
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown processing error';
      
      const failedResults = await db.update(imageJobsTable)
        .set({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date()
        })
        .where(eq(imageJobsTable.id, input.image_job_id))
        .returning()
        .execute();

      return failedResults[0];
    }

  } catch (error) {
    console.error('Background removal failed:', error);
    throw error;
  }
};