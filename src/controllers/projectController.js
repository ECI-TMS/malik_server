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


export const updateProject = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const thumbnailFile = req.files?.image?.[0] || null;
    const galleryFiles = req.files?.images || [];

    // 1. Check if project exists
    const [projectRows] = await connection.query(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );

    const existingProject = projectRows[0];
    if (!existingProject) {
      // Delete uploaded files
      const allFiles = [...(req.files?.image || []), ...(req.files?.images || [])];
      allFiles.forEach(file => {
        const filePath = path.resolve(file.path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });

      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // 2. Begin transaction
    await connection.beginTransaction();

    // 3. Delete old thumbnail if new one provided
    let image_path = existingProject.image_path;
    if (thumbnailFile) {
      const oldImagePath = path.resolve(`.${existingProject.image_path}`);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      image_path = `/uploads/${path.basename(thumbnailFile.path)}`;
    }

    // 4. Update `projects` table
    await connection.query(
      'UPDATE projects SET title = ?, description = ?, image_path = ? WHERE id = ?',
      [title, description, image_path, id]
    );

    // 5. Handle gallery images
    if (galleryFiles.length > 0) {
      // a. Delete old gallery images
      const [oldGalleryRows] = await connection.query(
        'SELECT image_path FROM project_images WHERE project_id = ?',
        [id]
      );

      for (const row of oldGalleryRows) {
        const imgPath = path.resolve(`.${row.image_path}`);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }

      await connection.query(
        'DELETE FROM project_images WHERE project_id = ?',
        [id]
      );

      // b. Insert new gallery images
      const galleryInsertValues = galleryFiles.map(file => [
        id,
        `/uploads/${path.basename(file.path)}`
      ]);

      await connection.query(
        'INSERT INTO project_images (project_id, image_path) VALUES ?',
        [galleryInsertValues]
      );
    }

    // 6. Commit transaction
    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: {
        id,
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
      const filePath = path.resolve(file.path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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