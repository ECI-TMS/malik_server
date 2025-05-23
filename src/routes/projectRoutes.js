import express from 'express';
import { 
  createProject, 
  getAllProjects, 
  getProjectById, 
  updateProject, 
  deleteProject 
} from '../controllers/projectController.js';
import { validateProject, validateId } from '../middleware/validation.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Routes for /api/projects
// router.post('/', upload.single('image'), validateProject, createProject);
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },      // For thumbnail or cover image
    { name: 'images', maxCount: 10 },    // For multiple additional images
  ]),
  validateProject,
  createProject
);

router.get('/', getAllProjects);
router.get('/:id', validateId, getProjectById);
router.put(
  '/:id',
  validateId,
  upload.fields([
    { name: 'image', maxCount: 1 },      // For thumbnail
    { name: 'images', maxCount: 10 },    // For gallery
  ]),
  validateProject,
  updateProject
);

router.delete('/:id', validateId, deleteProject);

export default router;