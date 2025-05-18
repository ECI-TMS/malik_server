import Project from '../models/Project.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES6 module support for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createProject = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Project image is required'
      });
    }
    
    const { title, description } = req.body;
    // const image_path = req.file.path.replace(/\\/g, '/'); // Normalize path for cross-platform compatibility
     // Extract just the filename and prefix it with /uploads/
    const filename = path.basename(req.file.path);
    const image_path = `/uploads/${filename}`;

    
    const projectData = {
      title,
      description,
      image_path
    };
    
    const newProject = await Project.create(projectData);
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: newProject
    });
  } catch (error) {
    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(__dirname, '..', '..', req.file.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
};

export const getAllProjects = async (req, res, next) => {
  try {
    const projects = await Project.getAll();
    
    // Add full URL for images
    const projectsWithImageUrl = projects.map(project => {
      return {
        ...project,
        image_url: `${req.protocol}://${req.get('host')}/${project.image_path}`
      };
    });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projectsWithImageUrl
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.getById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Add full URL for image
    project.image_url = `${req.protocol}://${req.get('host')}/${project.image_path}`;
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

// export const updateProject = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//     const { title, description } = req.body;
    
//     // Check if project exists
//     const existingProject = await Project.getById(id);
//     if (!existingProject) {
//       // Delete uploaded file if there was one
//       if (req.file) {
//         const filePath = path.join(__dirname, '..', '..', req.file.path);
//         if (fs.existsSync(filePath)) {
//           fs.unlinkSync(filePath);
//         }
//       }
      
//       return res.status(404).json({
//         success: false,
//         message: 'Project not found'
//       });
//     }
    
//     // Prepare update data
//     const projectData = {
//       title,
//       description
//     };
    
//     // Add image path if new file was uploaded
//     if (req.file) {
//       projectData.image_path = req.file.path.replace(/\\/g, '/');
//     }
    
//     const updatedProject = await Project.update(id, projectData);
    
//     res.status(200).json({
//       success: true,
//       message: 'Project updated successfully',
//       data: updatedProject
//     });
//   } catch (error) {
//     // Delete uploaded file if there was an error
//     if (req.file) {
//       const filePath = path.join(__dirname, '..', '..', req.file.path);
//       if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//       }
//     }
//     next(error);
//   }
// };


export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // Check if project exists
    const existingProject = await Project.getById(id);
    if (!existingProject) {
      // Delete uploaded file if project not found
      if (req.file) {
        const filePath = path.resolve(req.file.path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // If new file uploaded, remove the old image
    if (req.file && existingProject.image_path) {
      const oldImagePath = path.resolve(`.${existingProject.image_path}`);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }

    // Prepare data for update
    const projectData = {
      title,
      description,
    };

    // Normalize image path like in createProject
    if (req.file) {
      const filename = path.basename(req.file.path);
      projectData.image_path = `/uploads/${filename}`;
    }

    const updatedProject = await Project.update(id, projectData);

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject,
    });
  } catch (error) {
    // Delete uploaded file on error
    if (req.file) {
      const filePath = path.resolve(req.file.path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    next(error);
  }
};




export const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const existingProject = await Project.getById(id);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    await Project.delete(id);
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};