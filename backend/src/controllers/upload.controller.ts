import type { Request, Response } from 'express';
import type { UploadService } from '../services/upload.service';
import { signUploadSchema } from '../validators/upload.validators';

export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  /** Lets the client decide whether to render an upload box or a URL input. */
  capabilities = async (_req: Request, res: Response): Promise<void> => {
    res.json(this.uploads.getCapabilities());
  };

  createSignature = async (req: Request, res: Response): Promise<void> => {
    const { draftId } = signUploadSchema.parse(req.body);
    // Deliberately not cached: the signature is time-limited.
    res.set('Cache-Control', 'no-store');
    res.json(this.uploads.createSignedUpload(draftId));
  };
}
