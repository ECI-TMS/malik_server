import Project from '../models/Project.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { CLIENT_RENEG_LIMIT } from 'tls';

// ES6 module support for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createProject = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { title, description } = req.body;

    const thumbnailFile = req.files?.image?.[0];
    const galleryFiles = req.files?.images || [];
    
    
    console.log(thumbnailFile)
    if (!thumbnailFile) {
      return res.status(400).json({
        success: false,
        message: 'Project thumbnail image is required'
      });
    }

    const image_path = `/uploads/${path.basename(thumbnailFile.path)}`;
    await connection.beginTransaction();

    // 1. Insert into `projects` table
    const [projectResult] = await connection.query(
      'INSERT INTO projects (title, description, image_path) VALUES (?, ?, ?)',
      [title, description, image_path]
    );
    const projectId = projectResult.insertId;

    // 2. Insert into `project_images` table
    // const galleryFiles = req.files?.images || [];
    if (galleryFiles.length > 0) {
      const galleryInsertValues = galleryFiles.map(file => [
        projectId,
        `/uploads/${path.basename(file.path)}`
      ]);

      await connection.query(
        'INSERT INTO project_images (project_id, image_path) VALUES ?',
        [galleryInsertValues]
      );
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: {
        id: projectId,
        title,
        description,
        image_path,
        gallery_images: galleryFiles.map(file => `/uploads/${path.basename(file.path)}`)
      }
    });
  } catch (error) {
    await connection.rollback();

    // Delete uploaded files on error
    const allFiles = [...(req.files?.image || []), ...(req.files?.images || [])];
    allFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', '..', file.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    next(error);
  } finally {
    connection.release();
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

    // Add full URL for main thumbnail image
    project.image_url = `${req.protocol}://${req.get('host')}${project.image_path}`;

    // Add full URLs for multiple images if exist
    if (Array.isArray(project.images_paths)) {
      project.images_urls = project.images_paths.map(path => `${req.protocol}://${req.get('host')}${path}`);
    } else {
      project.images_urls = [];
    }

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


export const editProject = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { projectId } = req.params;
    const { title, description } = req.body;
    
    // Parse retainedServerImageUrls from JSON string
    let retainedServerImageUrls = [];
    try {
      retainedServerImageUrls = req.body.retainedServerImageUrls 
        ? JSON.parse(req.body.retainedServerImageUrls) 
        : [];
    } catch (parseError) {
      console.warn('Failed to parse retainedServerImageUrls:', parseError);
      retainedServerImageUrls = [];
    }

    const thumbnailFile = req.files?.image?.[0];
    const newGalleryFiles = req.files?.images || [];
    
    console.log('Thumbnail file:', thumbnailFile);
    console.log('New gallery files:', newGalleryFiles);
    console.log('Retained server URLs:', retainedServerImageUrls);

    await connection.beginTransaction();

    // 1. Update basic project info
    let updateQuery = 'UPDATE projects SET title = ?, description = ?';
    let updateValues = [title, description];
    
    let newThumbnailPath = null;
    if (thumbnailFile) {
      newThumbnailPath = `/uploads/${path.basename(thumbnailFile.path)}`;
      updateQuery += ', image_path = ?';
      updateValues.push(newThumbnailPath);
    }
    
    updateQuery += ' WHERE id = ?';
    updateValues.push(projectId);

    await connection.query(updateQuery, updateValues);

    // 2. Handle gallery images - Get existing images
    const [existingImages] = await connection.query(
      'SELECT id, image_path FROM project_images WHERE project_id = ?',
      [projectId]
    );

    // 3. Remove deleted gallery images
    const imagesToDelete = existingImages.filter(img => 
      !retainedServerImageUrls.includes(img.image_path)
    );

    if (imagesToDelete.length > 0) {
      const idsToDelete = imagesToDelete.map(img => img.id);
      await connection.query(
        'DELETE FROM project_images WHERE id IN (?)',
        [idsToDelete]
      );

      // Delete files from storage
      imagesToDelete.forEach(img => {
        const filePath = path.join(__dirname, '..', '..', img.image_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    // 4. Insert new gallery images
    if (newGalleryFiles.length > 0) {
      const galleryInsertValues = newGalleryFiles.map(file => [
        projectId,
        `/uploads/${path.basename(file.path)}`
      ]);

      await connection.query(
        'INSERT INTO project_images (project_id, image_path) VALUES ?',
        [galleryInsertValues]
      );
    }

    await connection.commit();
    
    res.json({
      success: true,
      message: 'Project updated successfully',
      data: {
        id: projectId,
        title,
        description,
        image_path: newThumbnailPath,
        retained_images: retainedServerImageUrls,
        new_gallery_images: newGalleryFiles.map(file => `/uploads/${path.basename(file.path)}`)
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update project error:', error);

    // Delete uploaded files on error
    const allFiles = [...(req.files?.image || []), ...(req.files?.images || [])];
    allFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', '..', file.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    next(error);
  } finally {
    connection.release();
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