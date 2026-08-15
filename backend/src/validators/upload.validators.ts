import { z } from 'zod';

export const signUploadSchema = z.object({
  /**
   * Client-generated id for the in-progress listing. Groups an abandoned
   * draft's uploads under one folder so they can be swept later.
   */
  draftId: z.string().trim().min(1, 'A draft id is required.').max(40),
});

export type SignUploadRequest = z.infer<typeof signUploadSchema>;
