// server.js
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/gomoku-royal')
  .then(() => console.log('✅ Kết nối MongoDB thành công'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Schema User
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 1000000 },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  avatar: { type: String, default: '' }
});

const User = mongoose.model('User', userSchema);

// API Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Tên tài khoản đã tồn tại' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashed,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
    });

    const userResponse = {
      id: user._id,
      username: user.username,
      balance: user.balance,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      totalEarned: user.totalEarned,
      avatar: user.avatar
    };

    res.json(userResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// API Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

    const userResponse = {
      id: user._id,
      username: user.username,
      balance: user.balance,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      totalEarned: user.totalEarned,
      avatar: user.avatar
    };

    res.json(userResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Cập nhật user
app.post('/api/user/update', async (req, res) => {
  try {
    const { userId, balance, gamesPlayed, gamesWon, totalEarned } = req.body;
    await User.findByIdAndUpdate(userId, { balance, gamesPlayed, gamesWon, totalEarned });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật' });
  }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ balance: -1 }).limit(50);
    const response = users.map(u => ({
      id: u._id,
      username: u.username,
      balance: u.balance,
      gamesWon: u.gamesWon,
      avatar: u.avatar
    }));
    res.json(response);
  } catch (err) {
    res.json([]);
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend chạy tại http://localhost:${PORT}`);
});