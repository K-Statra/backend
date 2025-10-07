const express = require('express');
const cors = require('cors');
require('dotenv').config();

const healthRouter = require('./routes/health');

const app = express();

// 미들웨어
app.use(cors());
app.use(express.json());

// 루트
app.get('/', (req, res) => {
  res.send('K-Statra API 서버 실행 중!');
});

// 헬스체크
app.use('/health', healthRouter);

// 포트 (기본 4000)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API Server listening at http://localhost:${PORT}`);
});