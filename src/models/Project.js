import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES6 module support for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Project {
  static async create(projectData) {
    try {
      const { title, description, image_path } = projectData;
      const [result] = await pool.query(
        'INSERT INTO projects (title, description, image_path) VALUES (?, ?, ?)',
        [title, description, image_path]
      );
      return { id: result.insertId, ...projectData };
    } catch (error) {
      throw error;
    }
  }

  static async getAll() {
    try {
      const [rows] = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getById(id) {
    try {
      const connection = await pool.getConnection();
      try {
        // Fetch main project
        const [projects] = await connection.query('SELECT * FROM projects WHERE id = ?', [id]);
  
        if (projects.length === 0) {
          return null;
        }
  
        const project = projects[0];
  
        // Fetch associated images from project_images table
        const [images] = await connection.query(
          'SELECT image_path FROM project_images WHERE project_id = ?',
          [id]
        );
  
        // Add the image paths as an array
        project.images_paths = images.map(img => img.image_path);
  
        return project;
      } finally {
        connection.release();
      }
    } catch (error) {
      throw error;
    }
  }
  

  static async update(id, projectData) {
    try {
      const { title, description, image_path } = projectData;
      
      // If image_path is provided, update it
      if (image_path) {
        // Get current project to find old image path
        const [currentProject] = await pool.query('SELECT image_path FROM projects WHERE id = ?', [id]);
        
        if (currentProject && currentProject[0]) {
          // Delete old image if it exists and is not the same as the new one
          const oldImagePath = path.join(__dirname, '..', '..', currentProject[0].image_path);
          if (fs.existsSync(oldImagePath) && currentProject[0].image_path !== image_path) {
            fs.unlinkSync(oldImagePath);
          }
        }
        
        await pool.query(
          'UPDATE projects SET title = ?, description = ?, image_path = ? WHERE id = ?',
          [title, description, image_path, id]
        );
      } else {
        await pool.query(
          'UPDATE projects SET title = ?, description = ? WHERE id = ?',
          [title, description, id]
        );
      }
      
      return { id, ...projectData };
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      // Get current project to find image path
      const [currentProject] = await pool.query('SELECT image_path FROM projects WHERE id = ?', [id]);
      
      // Delete project record
      const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
      
      // If project was found and deleted, also delete the image file
      if (result.affectedRows > 0 && currentProject && currentProject[0]) {
        const imagePath = path.join(__dirname, '..', '..', currentProject[0].image_path);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}

export default Project;