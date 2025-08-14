import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type CreateImageJobInput } from '../schema';
import { getImageJobs } from '../handlers/get_image_jobs';

// Test data for creating image jobs
const testJob1: Omit<CreateImageJobInput, 'id'> = {
  original_filename: 'test1.jpg',
  original_file_url: 'https://example.com/test1.jpg',
  file_size_original: 1024
};

const testJob2: Omit<CreateImageJobInput, 'id'> = {
  original_filename: 'test2.png',
  original_file_url: 'https://example.com/test2.png',
  file_size_original: 2048
};

const testJob3: Omit<CreateImageJobInput, 'id'> = {
  original_filename: 'test3.webp',
  original_file_url: 'https://example.com/test3.webp',
  file_size_original: 3072
};

describe('getImageJobs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no jobs exist', async () => {
    const result = await getImageJobs();

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all image jobs ordered by creation date (newest first)', async () => {
    // Create multiple jobs with small delays to ensure different timestamps
    const job1 = await db.insert(imageJobsTable)
      .values({
        original_filename: testJob1.original_filename,
        original_file_url: testJob1.original_file_url,
        file_size_original: testJob1.file_size_original,
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const job2 = await db.insert(imageJobsTable)
      .values({
        original_filename: testJob2.original_filename,
        original_file_url: testJob2.original_file_url,
        file_size_original: testJob2.file_size_original,
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const job3 = await db.insert(imageJobsTable)
      .values({
        original_filename: testJob3.original_filename,
        original_file_url: testJob3.original_file_url,
        file_size_original: testJob3.file_size_original,
      })
      .returning()
      .execute();

    const result = await getImageJobs();

    expect(result).toHaveLength(3);
    
    // Verify ordering - newest first (job3, job2, job1)
    expect(result[0].id).toEqual(job3[0].id);
    expect(result[1].id).toEqual(job2[0].id);
    expect(result[2].id).toEqual(job1[0].id);

    // Verify timestamps are in descending order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });

  it('should return jobs with all expected fields', async () => {
    // Create a job with completed status and processed file
    const completedJob = await db.insert(imageJobsTable)
      .values({
        original_filename: 'completed.jpg',
        original_file_url: 'https://example.com/completed.jpg',
        processed_file_url: 'https://example.com/processed.jpg',
        status: 'completed',
        file_size_original: 5000,
        file_size_processed: 3000,
        completed_at: new Date(),
      })
      .returning()
      .execute();

    // Create a failed job with error message
    const failedJob = await db.insert(imageJobsTable)
      .values({
        original_filename: 'failed.png',
        original_file_url: 'https://example.com/failed.png',
        status: 'failed',
        error_message: 'Processing failed due to invalid format',
        file_size_original: 2000,
      })
      .returning()
      .execute();

    const result = await getImageJobs();

    expect(result).toHaveLength(2);

    // Check completed job fields
    const completed = result.find(job => job.id === completedJob[0].id);
    expect(completed).toBeDefined();
    expect(completed!.original_filename).toEqual('completed.jpg');
    expect(completed!.original_file_url).toEqual('https://example.com/completed.jpg');
    expect(completed!.processed_file_url).toEqual('https://example.com/processed.jpg');
    expect(completed!.status).toEqual('completed');
    expect(completed!.error_message).toBeNull();
    expect(completed!.file_size_original).toEqual(5000);
    expect(completed!.file_size_processed).toEqual(3000);
    expect(completed!.created_at).toBeInstanceOf(Date);
    expect(completed!.completed_at).toBeInstanceOf(Date);
    expect(completed!.id).toBeDefined();

    // Check failed job fields
    const failed = result.find(job => job.id === failedJob[0].id);
    expect(failed).toBeDefined();
    expect(failed!.original_filename).toEqual('failed.png');
    expect(failed!.original_file_url).toEqual('https://example.com/failed.png');
    expect(failed!.processed_file_url).toBeNull();
    expect(failed!.status).toEqual('failed');
    expect(failed!.error_message).toEqual('Processing failed due to invalid format');
    expect(failed!.file_size_original).toEqual(2000);
    expect(failed!.file_size_processed).toBeNull();
    expect(failed!.created_at).toBeInstanceOf(Date);
    expect(failed!.completed_at).toBeNull();
    expect(failed!.id).toBeDefined();
  });

  it('should return jobs with different statuses', async () => {
    // Create jobs with different statuses
    const pendingJob = await db.insert(imageJobsTable)
      .values({
        original_filename: 'pending.jpg',
        original_file_url: 'https://example.com/pending.jpg',
        status: 'pending',
        file_size_original: 1000,
      })
      .returning()
      .execute();

    const processingJob = await db.insert(imageJobsTable)
      .values({
        original_filename: 'processing.png',
        original_file_url: 'https://example.com/processing.png',
        status: 'processing',
        file_size_original: 1500,
      })
      .returning()
      .execute();

    const result = await getImageJobs();

    expect(result).toHaveLength(2);
    
    const statuses = result.map(job => job.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('processing');

    // Verify specific job details
    const pending = result.find(job => job.status === 'pending');
    expect(pending!.original_filename).toEqual('pending.jpg');
    
    const processing = result.find(job => job.status === 'processing');
    expect(processing!.original_filename).toEqual('processing.png');
  });

  it('should handle large number of jobs efficiently', async () => {
    // Create 10 jobs to test handling multiple records
    const jobPromises = Array.from({ length: 10 }, (_, i) => 
      db.insert(imageJobsTable)
        .values({
          original_filename: `test${i}.jpg`,
          original_file_url: `https://example.com/test${i}.jpg`,
          file_size_original: 1000 + i * 100,
        })
        .returning()
        .execute()
    );

    await Promise.all(jobPromises);

    const result = await getImageJobs();

    expect(result).toHaveLength(10);
    
    // Verify all jobs have unique IDs
    const ids = result.map(job => job.id);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(10);

    // Verify ordering is maintained (newest first)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].created_at >= result[i + 1].created_at).toBe(true);
    }

    // Verify all required fields are present on all jobs
    result.forEach(job => {
      expect(job.id).toBeDefined();
      expect(job.original_filename).toContain('test');
      expect(job.original_file_url).toContain('example.com');
      expect(job.status).toEqual('pending'); // Default status
      expect(job.file_size_original).toBeGreaterThan(0);
      expect(job.created_at).toBeInstanceOf(Date);
    });
  });
});