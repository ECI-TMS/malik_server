import express from 'express';
import { 
  createContact, 
  getAllContacts, 
  getContactById, 
  updateContact, 
  deleteContact 
} from '../controllers/contactController.js';
import { validateContact, validateId } from '../middleware/validation.js';

const router = express.Router();

// Routes for /api/contacts
router.post('/', validateContact, createContact);
router.get('/', getAllContacts);
router.get('/:id', validateId, getContactById);
router.put('/:id', validateId, validateContact, updateContact);
router.delete('/:id', validateId, deleteContact);

export default router;