import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imageJobsTable } from '../db/schema';
import { type CreateImageJobInput } from '../schema';
import { createImageJob } from '../handlers/create_image_job';
import { eq } from 'drizzle-orm';

// Test input for image job creation
const testInput: CreateImageJobInput = {
  original_filename: 'test-image.jpg',
  original_file_url: 'https://example.com/uploads/test-image.jpg',
  file_size_original: 1024000, // 1MB in bytes
};

describe('createImageJob', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an image job', async () => {
    const result = await createImageJob(testInput);

    // Basic field validation
    expect(result.original_filename).toEqual('test-image.jpg');
    expect(result.original_file_url).toEqual(testInput.original_file_url);
    expect(result.file_size_original).toEqual(1024000);
    expect(result.status).toEqual('pending');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);

    // Nullable fields should be null initially
    expect(result.processed_file_url).toBeNull();
    expect(result.error_message).toBeNull();
    expect(result.completed_at).toBeNull();
    expect(result.file_size_processed).toBeNull();
  });

  it('should save image job to database', async () => {
    const result = await createImageJob(testInput);

    // Query using proper drizzle syntax
    const jobs = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, result.id))
      .execute();

    expect(jobs).toHaveLength(1);
    const savedJob = jobs[0];
    
    expect(savedJob.original_filename).toEqual('test-image.jpg');
    expect(savedJob.original_file_url).toEqual(testInput.original_file_url);
    expect(savedJob.file_size_original).toEqual(1024000);
    expect(savedJob.status).toEqual('pending');
    expect(savedJob.created_at).toBeInstanceOf(Date);
    
    // Verify nullable fields are null
    expect(savedJob.processed_file_url).toBeNull();
    expect(savedJob.error_message).toBeNull();
    expect(savedJob.completed_at).toBeNull();
    expect(savedJob.file_size_processed).toBeNull();
  });

  it('should handle different file types and sizes', async () => {
    const pngInput: CreateImageJobInput = {
      original_filename: 'large-image.png',
      original_file_url: 'https://cdn.example.com/images/large-image.png',
      file_size_original: 5242880, // 5MB in bytes
    };

    const result = await createImageJob(pngInput);

    expect(result.original_filename).toEqual('large-image.png');
    expect(result.original_file_url).toEqual(pngInput.original_file_url);
    expect(result.file_size_original).toEqual(5242880);
    expect(result.status).toEqual('pending');

    // Verify it's saved to database
    const jobs = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, result.id))
      .execute();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].file_size_original).toEqual(5242880);
  });

  it('should create multiple jobs independently', async () => {
    const input1: CreateImageJobInput = {
      original_filename: 'image1.jpg',
      original_file_url: 'https://example.com/image1.jpg',
      file_size_original: 500000,
    };

    const input2: CreateImageJobInput = {
      original_filename: 'image2.png',
      original_file_url: 'https://example.com/image2.png',
      file_size_original: 750000,
    };

    const result1 = await createImageJob(input1);
    const result2 = await createImageJob(input2);

    // Should have different IDs
    expect(result1.id).not.toEqual(result2.id);

    // Both should be in database
    const allJobs = await db.select()
      .from(imageJobsTable)
      .execute();

    expect(allJobs).toHaveLength(2);
    
    const job1 = allJobs.find(job => job.id === result1.id);
    const job2 = allJobs.find(job => job.id === result2.id);

    expect(job1).toBeDefined();
    expect(job2).toBeDefined();
    expect(job1!.original_filename).toEqual('image1.jpg');
    expect(job2!.original_filename).toEqual('image2.png');
  });

  it('should set created_at timestamp correctly', async () => {
    const beforeCreation = new Date();
    const result = await createImageJob(testInput);
    const afterCreation = new Date();

    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());

    // Verify timestamp is also saved correctly in database
    const jobs = await db.select()
      .from(imageJobsTable)
      .where(eq(imageJobsTable.id, result.id))
      .execute();

    expect(jobs[0].created_at).toBeInstanceOf(Date);
    expect(jobs[0].created_at.getTime()).toEqual(result.created_at.getTime());
  });
});