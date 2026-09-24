import Joi from 'joi';
import { Listing } from '../models/Listing.js';

const createSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid('textbooks', 'electronics', 'furniture', 'clothing', 'other'),
  condition: Joi.string().valid('new', 'like-new', 'used', 'worn'),
  status: Joi.string().valid('active', 'sold', 'removed'),
  seller: Joi.string().hex().length(24)
});

const updateSchema = Joi.object({
  title: Joi.string(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0),
  category: Joi.string().valid('textbooks', 'electronics', 'furniture', 'clothing', 'other'),
  condition: Joi.string().valid('new', 'like-new', 'used', 'worn'),
  seller: Joi.string().hex().length(24)
});

function publicListing(l) {
  return {
    id: l._id.toString(),
    title: l.title,
    description: l.description,
    price: l.price,
    category: l.category,
    condition: l.condition,
    status: l.status,
    seller: l.seller ? l.seller.toString() : null,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt
  };
}

function wantsRemoved(req) {
  return req.query.includeRemoved === 'true';
}

// GET /api/listings
export async function getAllListings(req, res, next) {
  try {
    const filter = wantsRemoved(req) ? {} : { status: { $ne: 'removed' } };
    const listings = await Listing.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ listings: listings.map(publicListing) });
  } catch (err) { next(err); }
}

// GET /api/listings/:id
export async function getListing(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status === 'removed' && !wantsRemoved(req)) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    res.json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

// POST /api/listings
export async function createListing(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.create(value);
    res.status(201).json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

// PATCH /api/listings/:id
export async function updateListing(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status === 'removed') {
      return res.status(409).json({ message: 'Cannot update a removed listing' });
    }
    if (listing.status === 'sold') {
      const locked = ['price', 'category'].filter((key) => value[key] !== undefined);
      if (locked.length) {
        return res.status(409).json({
          message: `Cannot change ${locked.join(' or ')} on a sold listing`
        });
      }
    }

    Object.assign(listing, value);
    await listing.save();
    res.json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

// POST /api/listings/:id/sold — status flip only, skips PATCH field rules
export async function markListingSold(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status === 'removed') {
      return res.status(409).json({ message: 'Cannot mark a removed listing as sold' });
    }

    if (listing.status !== 'sold') {
      listing.status = 'sold';
      await listing.save();
    }

    res.json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

// DELETE /api/listings/:id — soft delete: keep the document, mark it removed
export async function deleteListing(req, res, next) {
  try {
    const doc = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'removed' } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Listing not found' });
    res.json({ listing: publicListing(doc) });
  } catch (err) { next(err); }
}
