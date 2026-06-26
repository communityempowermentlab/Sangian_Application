const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');

const getElements = async (req, res) => {
    try {
        const { test_id, asset_type } = req.query;
        let query = 'SELECT * FROM test_elements WHERE 1=1';
        const params = [];

        if (test_id) {
            query += ' AND test_id = ?';
            params.push(test_id);
        }
        if (asset_type) {
            query += ' AND asset_type = ?';
            params.push(asset_type);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
        res.json({ success: true, elements: rows });
    } catch (error) {
        console.error('getElements error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch elements' });
    }
};

const getAllElementsPublic = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM test_elements');
        res.json({ success: true, elements: rows });
    } catch (error) {
        console.error('getAllElementsPublic error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch elements' });
    }
};

const uploadElement = async (req, res) => {
    try {
        const { test_id, asset_type, language } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        if (!test_id || !asset_type || !language) {
            // Cleanup the uploaded file if we are rejecting the request
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const file_name = req.file.originalname;
        const file_path = `/uploads/elements/${req.file.filename}`;

        // Insert or Update logic:
        // We will check if it already exists to overwrite or we can rely on UNIQUE KEY if we use INSERT ... ON DUPLICATE KEY UPDATE
        const insertQuery = `
            INSERT INTO test_elements (test_id, asset_type, language, file_name, file_path)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                file_name = VALUES(file_name),
                file_path = VALUES(file_path),
                updated_at = CURRENT_TIMESTAMP
        `;

        await pool.query(insertQuery, [test_id, asset_type, language, file_name, file_path]);

        res.json({ success: true, message: 'Element uploaded successfully', file_path });
    } catch (error) {
        console.error('uploadElement error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload element' });
    }
};

const deleteElement = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch the file path to delete the physical file if it's an uploaded one
        const [rows] = await pool.query('SELECT file_path FROM test_elements WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Element not found' });
        }

        const filePath = rows[0].file_path;

        await pool.query('DELETE FROM test_elements WHERE id = ?', [id]);

        // Only delete physical file if it was uploaded to /uploads/elements/
        if (filePath.startsWith('/uploads/elements/')) {
            const absolutePath = path.join(__dirname, '..', '..', filePath);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
        }

        res.json({ success: true, message: 'Element deleted successfully' });
    } catch (error) {
        console.error('deleteElement error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete element' });
    }
};

module.exports = {
    getElements,
    getAllElementsPublic,
    uploadElement,
    deleteElement
};
