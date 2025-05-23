import express from 'express';
import { 
  createProject, 
  getAllProjects, 
  getProjectById, 
  editProject,
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
router.put('/project/:projectId', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), editProject);

router.delete('/:id', validateId, deleteProject);

export default router;