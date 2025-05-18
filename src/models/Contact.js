import pool from '../config/database.js';

class Contact {
  static async create(contactData) {
    try {
      const { name, company, email, phone_number, message } = contactData;
      const [result] = await pool.query(
        'INSERT INTO contacts (name, company, email, phone_number, message) VALUES (?, ?, ?, ?, ?)',
        [name, company || null, email, phone_number, message || null]
      );
      return { id: result.insertId, ...contactData };
    } catch (error) {
      throw error;
    }
  }

  static async getAll() {
    try {
      const [rows] = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getById(id) {
    try {
      const [rows] = await pool.query('SELECT * FROM contacts WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, contactData) {
    try {
      const { name, company, email, phone_number, message } = contactData;
      await pool.query(
        'UPDATE contacts SET name = ?, company = ?, email = ?, phone_number = ?, message = ? WHERE id = ?',
        [name, company || null, email, phone_number, message || null, id]
      );
      return { id, ...contactData };
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM contacts WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
}

export default Contact;