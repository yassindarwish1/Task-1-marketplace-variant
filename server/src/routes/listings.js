import { Router } from 'express';
import {
  getAllListings,
  getListing,
  createListing,
  updateListing,
  markListingSold,
  deleteListing
} from '../controllers/listingController.js';

const router = Router();

router.get('/', getAllListings);
router.post('/', createListing);
router.post('/:id/sold', markListingSold);
router.get('/:id', getListing);
router.patch('/:id', updateListing);
router.delete('/:id', deleteListing);

export default router;
