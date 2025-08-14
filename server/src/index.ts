import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schema types
import { 
  uploadFileInputSchema, 
  createImageJobInputSchema, 
  removeBackgroundInputSchema,
  getImageJobInputSchema,
  updateImageJobStatusInputSchema
} from './schema';

// Import handlers
import { uploadFile } from './handlers/upload_file';
import { createImageJob } from './handlers/create_image_job';
import { removeBackground } from './handlers/remove_background';
import { getImageJob } from './handlers/get_image_job';
import { getImageJobs } from './handlers/get_image_jobs';
import { updateImageJobStatus } from './handlers/update_image_job_status';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Upload file endpoint
  uploadFile: publicProcedure
    .input(uploadFileInputSchema)
    .mutation(({ input }) => uploadFile(input)),

  // Create image processing job
  createImageJob: publicProcedure
    .input(createImageJobInputSchema)
    .mutation(({ input }) => createImageJob(input)),

  // Start background removal process
  removeBackground: publicProcedure
    .input(removeBackgroundInputSchema)
    .mutation(({ input }) => removeBackground(input)),

  // Get specific image job by ID
  getImageJob: publicProcedure
    .input(getImageJobInputSchema)
    .query(({ input }) => getImageJob(input)),

  // Get all image jobs
  getImageJobs: publicProcedure
    .query(() => getImageJobs()),

  // Update image job status (internal use)
  updateImageJobStatus: publicProcedure
    .input(updateImageJobStatusInputSchema)
    .mutation(({ input }) => updateImageJobStatus(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();