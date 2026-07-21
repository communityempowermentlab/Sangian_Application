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

// @desc    Get all questions for Lottery Ka Ticket V2
// @route   GET /api/admin/number-recall-v2/questions
// @route   GET /api/games/number-recall-v2/questions
// @access  Public (games) or Private (admin)
const getQuestions = async (req, res) => {
    try {
        const [questions] = await dbPool.query('SELECT * FROM number_recall_v2_questions ORDER BY display_order ASC');
        res.json({ success: true, questions });
    } catch (error) {
        console.error('getQuestions error:', error);
        res.status(500).json({ success: false, message: 'Failed to load configuration' });
    }
};

// @desc    Update a question
// @route   PUT /api/admin/number-recall-v2/questions/:id
// @access  Private (admin)
const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { correct_sequence, max_select, audio_file, teaching_audio } = req.body;
        
        await dbPool.query(
            'UPDATE number_recall_v2_questions SET correct_sequence = ?, max_select = ?, audio_file = ?, teaching_audio = ? WHERE id = ?',
            [correct_sequence, max_select, audio_file, teaching_audio, id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('updateQuestion error:', error);
        res.status(500).json({ success: false, message: 'Failed to update question' });
    }
};

module.exports = {
    getQuestions,
    updateQuestion
};
