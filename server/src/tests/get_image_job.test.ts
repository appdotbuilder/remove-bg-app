import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type GetImageJobInput } from '../schema';
import { getImageJob } from '../handlers/get_image_job';

// Test data for creating image jobs
const testJob = {
  original_filename: 'test-image.jpg',
  original_file_url: 'https://storage.example.com/test-image.jpg',
  file_size_original: 1024000
};

const completedJob = {
  original_filename: 'completed-image.png',
  original_file_url: 'https://storage.example.com/completed-image.png',
  processed_file_url: 'https://storage.example.com/completed-image-processed.png',
  status: 'completed' as const,
  completed_at: new Date(),
  file_size_original: 2048000,
  file_size_processed: 1024000
};

const failedJob = {
  original_filename: 'failed-image.jpg',
  original_file_url: 'https://storage.example.com/failed-image.jpg',
  status: 'failed' as const,
  error_message: 'Processing failed due to invalid format',
  file_size_original: 512000
};

describe('getImageJob', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get a pending image job', async () => {
    // Create a test job
    const [createdJob] = await db.insert(imageJobsTable)
      .values(testJob)
      .returning()
      .execute();

    const input: GetImageJobInput = {
      id: createdJob.id
    };

    const result = await getImageJob(input);

    // Verify all fields are returned correctly
    expect(result.id).toEqual(createdJob.id);
    expect(result.original_filename).toEqual('test-image.jpg');
    expect(result.original_file_url).toEqual('https://storage.example.com/test-image.jpg');
    expect(result.processed_file_url).toBeNull();
    expect(result.status).toEqual('pending');
    expect(result.error_message).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeNull();
    expect(result.file_size_original).toEqual(1024000);
    expect(result.file_size_processed).toBeNull();
  });

  it('should get a completed image job with all fields populated', async () => {
    // Create a completed test job
    const [createdJob] = await db.insert(imageJobsTable)
      .values(completedJob)
      .returning()
      .execute();

    const input: GetImageJobInput = {
      id: createdJob.id
    };

    const result = await getImageJob(input);

    // Verify all fields for completed job
    expect(result.id).toEqual(createdJob.id);
    expect(result.original_filename).toEqual('completed-image.png');
    expect(result.original_file_url).toEqual('https://storage.example.com/completed-image.png');
    expect(result.processed_file_url).toEqual('https://storage.example.com/completed-image-processed.png');
    expect(result.status).toEqual('completed');
    expect(result.error_message).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.file_size_original).toEqual(2048000);
    expect(result.file_size_processed).toEqual(1024000);
  });

  it('should get a failed image job with error message', async () => {
    // Create a failed test job
    const [createdJob] = await db.insert(imageJobsTable)
      .values(failedJob)
      .returning()
      .execute();

    const input: GetImageJobInput = {
      id: createdJob.id
    };

    const result = await getImageJob(input);

    // Verify failed job fields
    expect(result.id).toEqual(createdJob.id);
    expect(result.original_filename).toEqual('failed-image.jpg');
    expect(result.status).toEqual('failed');
    expect(result.error_message).toEqual('Processing failed due to invalid format');
    expect(result.processed_file_url).toBeNull();
    expect(result.completed_at).toBeNull();
    expect(result.file_size_processed).toBeNull();
  });

  it('should throw error when job does not exist', async () => {
    const input: GetImageJobInput = {
      id: 999 // Non-existent ID
    };

    await expect(getImageJob(input)).rejects.toThrow(/Image job with ID 999 not found/i);
  });

  it('should handle different job statuses correctly', async () => {
    // Create jobs with different statuses
    const [pendingJob] = await db.insert(imageJobsTable)
      .values({ ...testJob, status: 'pending' })
      .returning()
      .execute();

    const [processingJob] = await db.insert(imageJobsTable)
      .values({ ...testJob, status: 'processing', original_filename: 'processing.jpg' })
      .returning()
      .execute();

    // Test pending job
    const pendingResult = await getImageJob({ id: pendingJob.id });
    expect(pendingResult.status).toEqual('pending');

    // Test processing job
    const processingResult = await getImageJob({ id: processingJob.id });
    expect(processingResult.status).toEqual('processing');
  });

  it('should verify data persistence across queries', async () => {
    // Create a test job
    const [createdJob] = await db.insert(imageJobsTable)
      .values(testJob)
      .returning()
      .execute();

    // Query the job multiple times
    const result1 = await getImageJob({ id: createdJob.id });
    const result2 = await getImageJob({ id: createdJob.id });

    // Verify results are identical
    expect(result1.id).toEqual(result2.id);
    expect(result1.created_at.getTime()).toEqual(result2.created_at.getTime());
    expect(result1.status).toEqual(result2.status);
    expect(result1.original_filename).toEqual(result2.original_filename);
  });
});