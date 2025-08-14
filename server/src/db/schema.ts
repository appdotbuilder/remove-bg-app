import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

// Enum for image processing status
export const imageJobStatusEnum = pgEnum('image_job_status', ['pending', 'processing', 'completed', 'failed']);

export const imageJobsTable = pgTable('image_jobs', {
  id: serial('id').primaryKey(),
  original_filename: text('original_filename').notNull(),
  original_file_url: text('original_file_url').notNull(),
  processed_file_url: text('processed_file_url'), // Nullable - will be set after processing
  status: imageJobStatusEnum('status').notNull().default('pending'),
  error_message: text('error_message'), // Nullable - only set if processing fails
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'), // Nullable - set when processing completes
  file_size_original: integer('file_size_original').notNull(), // Original file size in bytes
  file_size_processed: integer('file_size_processed'), // Nullable - processed file size in bytes
});

// TypeScript types for the table schema
export type ImageJob = typeof imageJobsTable.$inferSelect; // For SELECT operations
export type NewImageJob = typeof imageJobsTable.$inferInsert; // For INSERT operations

// Important: Export all tables and relations for proper query building
export const tables = { imageJobs: imageJobsTable };