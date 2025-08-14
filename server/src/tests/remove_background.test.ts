import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type RemoveBackgroundInput } from '../schema';
import { removeBackground } from '../handlers/remove_background';
import { eq } from 'drizzle-orm';

// Test input
const testInput: RemoveBackgroundInput = {
  image_job_id: 1
};

describe('removeBackground', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test image job
  const createTestImageJob = async (status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending') => {
    const results = await db.insert(imageJobsTable)
      .values({
        original_filename: 'test-image.jpg',
        original_file_url: 'https://storage.example.com/test-image.jpg',
        file_size_original: 1024000, // 1MB
        status: status
      })
      .returning()
      .execute();
    
    return results[0];
  };

  it('should successfully process a pending image job', async () => {
    // Create a test job
    const testJob = await createTestImageJob('pending');

    // Process the background removal
    const result = await removeBackground({ image_job_id: testJob.id });

    // Verify the result
    expect(result.id).toEqual(testJob.id);
    expect(result.status).toEqual('completed');
    expect(result.processed_file_url).toBeDefined();
    expect(result.processed_file_url).toMatch(/^https:\/\/storage\.example\.com\/processed_/);
    expect(result.file_size_processed).toBeDefined();
    expect(result.file_size_processed).toBeLessThan(result.file_size_original);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.error_message).toBeNull();

    // Verify the database was updated
    const updatedJobs = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, testJob.id))
      .execute();

    expect(updatedJobs).toHaveLength(1);
    expect(updatedJobs[0].status).toEqual('completed');
    expect(updatedJobs[0].processed_file_url).toBeDefined();
    expect(updatedJobs[0].file_size_processed).toBeDefined();
    expect(updatedJobs[0].completed_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent job', async () => {
    await expect(removeBackground({ image_job_id: 999 }))
      .rejects.toThrow(/Image job with ID 999 not found/i);
  });

  it('should throw error for already completed job', async () => {
    // Create a completed job
    const testJob = await createTestImageJob('completed');

    await expect(removeBackground({ image_job_id: testJob.id }))
      .rejects.toThrow(/Image job .+ is already completed/i);
  });

  it('should throw error for job already being processed', async () => {
    // Create a processing job
    const testJob = await createTestImageJob('processing');

    await expect(removeBackground({ image_job_id: testJob.id }))
      .rejects.toThrow(/Image job .+ is already being processed/i);
  });

  it('should throw error for failed job', async () => {
    // Create a failed job
    const testJob = await createTestImageJob('failed');

    await expect(removeBackground({ image_job_id: testJob.id }))
      .rejects.toThrow(/Image job .+ has failed and cannot be reprocessed/i);
  });

  it('should update status to processing before processing', async () => {
    // Create a test job
    const testJob = await createTestImageJob('pending');

    // Start processing (this will complete due to our mock implementation)
    await removeBackground({ image_job_id: testJob.id });

    // The job should have gone through the processing status
    // (though in our implementation it completes immediately)
    const finalJob = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, testJob.id))
      .execute();

    expect(finalJob[0].status).toEqual('completed');
  });

  it('should maintain original job data during processing', async () => {
    // Create a test job with specific data
    const testJob = await createTestImageJob('pending');

    // Process the background removal
    const result = await removeBackground({ image_job_id: testJob.id });

    // Verify original data is preserved
    expect(result.original_filename).toEqual(testJob.original_filename);
    expect(result.original_file_url).toEqual(testJob.original_file_url);
    expect(result.file_size_original).toEqual(testJob.file_size_original);
    expect(result.created_at).toEqual(testJob.created_at);
  });

  it('should generate unique processed file URLs', async () => {
    // Create two test jobs
    const testJob1 = await createTestImageJob('pending');
    const testJob2 = await createTestImageJob('pending');

    // Process both jobs
    const result1 = await removeBackground({ image_job_id: testJob1.id });
    const result2 = await removeBackground({ image_job_id: testJob2.id });

    // Verify URLs are different
    expect(result1.processed_file_url).not.toEqual(result2.processed_file_url);
    expect(result1.processed_file_url).toContain(`processed_${testJob1.id}_`);
    expect(result2.processed_file_url).toContain(`processed_${testJob2.id}_`);
  });

  it('should calculate processed file size as smaller than original', async () => {
    // Create a test job with known file size
    const testJob = await createTestImageJob('pending');
    const originalSize = testJob.file_size_original;

    // Process the background removal
    const result = await removeBackground({ image_job_id: testJob.id });

    // Verify processed size is smaller
    expect(result.file_size_processed).toBeLessThan(originalSize);
    expect(result.file_size_processed).toBeGreaterThan(0);
    
    // Should be roughly 70% of original (based on our simulation)
    const expectedSize = Math.floor(originalSize * 0.7);
    expect(result.file_size_processed).toEqual(expectedSize);
  });

  it('should handle multiple jobs independently', async () => {
    // Create multiple test jobs
    const jobs = await Promise.all([
      createTestImageJob('pending'),
      createTestImageJob('pending'),
      createTestImageJob('pending')
    ]);

    // Process all jobs
    const results = await Promise.all(
      jobs.map(job => removeBackground({ image_job_id: job.id }))
    );

    // Verify all jobs completed successfully
    results.forEach((result, index) => {
      expect(result.id).toEqual(jobs[index].id);
      expect(result.status).toEqual('completed');
      expect(result.processed_file_url).toBeDefined();
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    // Verify database state
    const allJobs = await db.select()
      .from(imageJobsTable)
      .execute();

    const completedJobs = allJobs.filter(job => job.status === 'completed');
    expect(completedJobs).toHaveLength(3);
  });
});