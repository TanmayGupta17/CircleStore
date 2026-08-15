import type { Request, Response } from 'express';
import { presentListing, presentListingList } from '../presenters/listing.presenter';
import type { ListingService } from '../services/listing.service';
import { createListingSchema, listListingsSchema } from '../validators/listing.validators';

/**
 * Controllers are deliberately thin: parse and validate the request shape,
 * delegate to a service, present the result. No business rules, no database
 * access. Errors propagate to the central error handler.
 */
export class ListingController {
  constructor(private readonly listings: ListingService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = listListingsSchema.parse(req.query);
    const page = await this.listings.list(query);
    res.json(presentListingList(page));
  };

  getBySlug = async (req: Request, res: Response): Promise<void> => {
    const listing = await this.listings.getBySlug(String(req.params.slug));
    res.json(presentListing(listing));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = createListingSchema.parse(req.body);
    const listing = await this.listings.create(input);
    res.status(201).json(presentListing(listing));
  };
}
