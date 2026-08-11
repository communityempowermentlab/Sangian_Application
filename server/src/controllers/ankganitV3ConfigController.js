const pool = require('mysql2/promise').createPool({
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sangian',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

if (process.env.DB_SOCKET) {
    pool.pool.config.socketPath = process.env.DB_SOCKET; // Note: In mysql2, modifying pool config after creation is tricky, but we'll stick to a standard import pattern below.
}

const mysql = require('mysql2/promise');
const poolConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sangian',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || '127.0.0.1';
  poolConfig.port = parseInt(process.env.DB_PORT) || 3306;
}
const dbPool = mysql.createPool(poolConfig);

// @desc    Get all categories and questions
// @route   GET /api/admin/ankganit-v3
// @access  Private (admin)
const getFullConfig = async (req, res) => {
    try {
        const [categories] = await dbPool.query('SELECT * FROM ankganit_v3_categories ORDER BY display_order ASC');
        const [questions] = await dbPool.query('SELECT * FROM ankganit_v3_questions ORDER BY display_order ASC');

        // Group questions by category
        const categoriesWithQuestions = categories.map(cat => ({
            ...cat,
            questions: questions.filter(q => q.category_id === cat.id)
        }));

        res.json({ success: true, categories: categoriesWithQuestions });
    } catch (error) {
        console.error('getFullConfig error:', error);
        res.status(500).json({ success: false, message: 'Failed to load configuration' });
    }
};

// @desc    Update a category
// @route   PUT /api/admin/ankganit-v3/categories/:id
// @access  Private (admin)
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, minimum_correct, evaluation_type, is_active } = req.body;

        await dbPool.query(
            'UPDATE ankganit_v3_categories SET name = ?, minimum_correct = ?, evaluation_type = ?, is_active = ? WHERE id = ?',
            [name, minimum_correct, evaluation_type, is_active, id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('updateCategory error:', error);
        res.status(500).json({ success: false, message: 'Failed to update category' });
    }
};

// @desc    Update a question
// @route   PUT /api/admin/ankganit-v3/questions/:id
// @access  Private (admin)
const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, title, correct_answer, remainder } = req.body;

        await dbPool.query(
            'UPDATE ankganit_v3_questions SET text = ?, title = ?, correct_answer = ?, remainder = ? WHERE id = ?',
            [text, title, correct_answer, remainder, id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('updateQuestion error:', error);
        res.status(500).json({ success: false, message: 'Failed to update question' });
    }
};

module.exports = {
    getFullConfig,
    updateCategory,
    updateQuestion
};
