import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type UpdateImageJobStatusInput, type CreateImageJobInput } from '../schema';
import { updateImageJobStatus } from '../handlers/update_image_job_status';
import { eq } from 'drizzle-orm';

// Helper function to create a test job
const createTestJob = async (input: CreateImageJobInput) => {
  const result = await db.insert(imageJobsTable)
    .values({
      original_filename: input.original_filename,
      original_file_url: input.original_file_url,
      file_size_original: input.file_size_original,
      status: 'pending'
    })
    .returning()
    .execute();
  
  return result[0];
};

// Test data
const testJobInput: CreateImageJobInput = {
  original_filename: 'test-image.jpg',
  original_file_url: 'https://storage.example.com/test-image.jpg',
  file_size_original: 1024000
};

describe('updateImageJobStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update job status to processing', async () => {
    // Create test job
    const job = await createTestJob(testJobInput);

    const updateInput: UpdateImageJobStatusInput = {
      id: job.id,
      status: 'processing'
    };

    const result = await updateImageJobStatus(updateInput);

    expect(result.id).toBe(job.id);
    expect(result.status).toBe('processing');
    expect(result.completed_at).toBeNull(); // Should not be set for 'processing' status
    expect(result.original_filename).toBe(testJobInput.original_filename);
    expect(result.original_file_url).toBe(testJobInput.original_file_url);
    expect(result.file_size_original).toBe(testJobInput.file_size_original);
  });

  it('should update job status to completed with processed file URL and size', async () => {
    // Create test job
    const job = await createTestJob(testJobInput);

    const updateInput: UpdateImageJobStatusInput = {
      id: job.id,
      status: 'completed',
      processed_file_url: 'https://storage.example.com/processed-image.png',
      file_size_processed: 800000
    };

    const result = await updateImageJobStatus(updateInput);

    expect(result.id).toBe(job.id);
    expect(result.status).toBe('completed');
    expect(result.processed_file_url).toBe('https://storage.example.com/processed-image.png');
    expect(result.file_size_processed).toBe(800000);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.error_message).toBeNull();
  });

  it('should update job status to failed with error message', async () => {
    // Create test job
    const job = await createTestJob(testJobInput);

    const updateInput: UpdateImageJobStatusInput = {
      id: job.id,
      status: 'failed',
      error_message: 'Processing failed due to invalid image format'
    };

    const result = await updateImageJobStatus(updateInput);

    expect(result.id).toBe(job.id);
    expect(result.status).toBe('failed');
    expect(result.error_message).toBe('Processing failed due to invalid image format');
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.processed_file_url).toBeNull();
    expect(result.file_size_processed).toBeNull();
  });

  it('should save updates to database', async () => {
    // Create test job
    const job = await createTestJob(testJobInput);

    const updateInput: UpdateImageJobStatusInput = {
      id: job.id,
      status: 'completed',
      processed_file_url: 'https://storage.example.com/final-image.webp',
      file_size_processed: 750000
    };

    await updateImageJobStatus(updateInput);

    // Verify in database
    const updatedJobs = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, job.id))
      .execute();

    expect(updatedJobs).toHaveLength(1);
    const updatedJob = updatedJobs[0];
    expect(updatedJob.status).toBe('completed');
    expect(updatedJob.processed_file_url).toBe('https://storage.example.com/final-image.webp');
    expect(updatedJob.file_size_processed).toBe(750000);
    expect(updatedJob.completed_at).toBeInstanceOf(Date);
  });

  it('should handle partial updates correctly', async () => {
    // Create test job
    const job = await createTestJob(testJobInput);

    // First update: set to processing
    const processingInput: UpdateImageJobStatusInput = {
      id: job.id,
      status: 'processing'
    };

    const processingResult = await updateImageJobStatus(processingInput);
    expect(processingResult.status).toBe('processing');
    expect(processingResult.completed_at).toBeNull();

    // Second update: complete the job
    const completedInput: UpdateImageJobStatusInput = {
      id: job.id,
      status: 'completed',
      processed_file_url: 'https://storage.example.com/done.jpg'
    };

    const completedResult = await updateImageJobStatus(completedInput);
    expect(completedResult.status).toBe('completed');
    expect(completedResult.processed_file_url).toBe('https://storage.example.com/done.jpg');
    expect(completedResult.completed_at).toBeInstanceOf(Date);
    
    // Verify original data is preserved
    expect(completedResult.original_filename).toBe(testJobInput.original_filename);
    expect(completedResult.original_file_url).toBe(testJobInput.original_file_url);
    expect(completedResult.file_size_original).toBe(testJobInput.file_size_original);
  });

  it('should throw error when job does not exist', async () => {
    const updateInput: UpdateImageJobStatusInput = {
      id: 99999, // Non-existent job ID
      status: 'completed'
    };

    await expect(updateImageJobStatus(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should update only provided fields', async () => {
    // Create test job
    const job = await createTestJob(testJobInput);

    // Update only status, leaving other optional fields unchanged
    const updateInput: UpdateImageJobStatusInput = {
      id: job.id,
      status: 'processing'
    };

    const result = await updateImageJobStatus(updateInput);

    expect(result.status).toBe('processing');
    expect(result.processed_file_url).toBeNull(); // Should remain null
    expect(result.error_message).toBeNull(); // Should remain null
    expect(result.file_size_processed).toBeNull(); // Should remain null
    expect(result.completed_at).toBeNull(); // Should remain null for 'processing'
  });

  it('should set completed_at for both completed and failed statuses', async () => {
    // Test completed status
    const job1 = await createTestJob({
      ...testJobInput,
      original_filename: 'test1.jpg'
    });

    const completedInput: UpdateImageJobStatusInput = {
      id: job1.id,
      status: 'completed'
    };

    const completedResult = await updateImageJobStatus(completedInput);
    expect(completedResult.completed_at).toBeInstanceOf(Date);

    // Test failed status
    const job2 = await createTestJob({
      ...testJobInput,
      original_filename: 'test2.jpg'
    });

    const failedInput: UpdateImageJobStatusInput = {
      id: job2.id,
      status: 'failed'
    };

    const failedResult = await updateImageJobStatus(failedInput);
    expect(failedResult.completed_at).toBeInstanceOf(Date);
  });
});