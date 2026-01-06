
import { GoogleGenAI, Type } from "@google/genai";
import { Player } from "../types";

// Thuật toán Offline Engine cực mạnh (Heuristic Search)
// Đảm bảo AI vẫn thông minh ngay cả khi không có API
const getOfflineMove = (board: Player[][]): { row: number; col: number } => {
  const size = board.length;
  
  const evaluateCell = (r: number, c: number): number => {
    if (board[r][c]) return -1;
    
    let score = 0;
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    
    for (const [dr, dc] of directions) {
      const checkLine = (player: Player) => {
        let count = 1;
        let openEnds = 0;
        let blocked = 0;

        // Tiến
        for (let i = 1; i < 5; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) { blocked++; break; }
          if (board[nr][nc] === player) count++;
          else if (board[nr][nc] === null) { openEnds++; break; }
          else { blocked++; break; }
        }
        // Lùi
        for (let i = 1; i < 5; i++) {
          const nr = r - dr * i, nc = c - dc * i;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) { blocked++; break; }
          if (board[nr][nc] === player) count++;
          else if (board[nr][nc] === null) { openEnds++; break; }
          else { blocked++; break; }
        }
        return { count, openEnds, blocked };
      };

      const human = checkLine('X');
      const ai = checkLine('O');

      // TRỌNG SỐ CHIẾN THUẬT (OFFLINE GRANDMASTER)
      // 1. Thắng ngay lập tức
      if (ai.count >= 5) score += 1000000;
      // 2. Chặn đối thủ thắng ngay
      if (human.count >= 5) score += 500000;
      
      // 3. Tạo nước 4 hở (AI)
      if (ai.count === 4 && ai.openEnds >= 1) score += 100000;
      // 4. Chặn nước 4 của người chơi
      if (human.count === 4 && human.openEnds >= 1) score += 80000;
      
      // 5. Chặn nước 3 hở hai đầu (Rất quan trọng)
      if (human.count === 3 && human.openEnds === 2) score += 50000;
      if (ai.count === 3 && ai.openEnds === 2) score += 40000;

      // 6. Điểm cộng cho sự liên kết
      score += (ai.count * 100) + (human.count * 50);
    }
    
    // Ưu tiên các ô ở giữa bàn cờ hơn một chút
    const distToCenter = Math.abs(r - 7) + Math.abs(c - 7);
    score += (15 - distToCenter);

    return score;
  };

  let bestMove = { row: 7, col: 7, maxScore: -1 };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const s = evaluateCell(r, c);
      if (s > bestMove.maxScore) {
        bestMove = { row: r, col: c, maxScore: s };
      }
    }
  }
  return { row: bestMove.row, col: bestMove.col };
};

export const getAIMove = async (board: Player[][]): Promise<{ row: number; col: number }> => {
  // Thử gọi API Gemini
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const colIndices = "    0  1  2  3  4  5  6  7  8  9  0  1  2  3  4";
    const boardStr = board.map((row, rIdx) => 
      `${rIdx.toString().padStart(2, ' ')} [ ${row.map(cell => cell || '.').join('  ')} ] ${rIdx}`
    ).join('\n');
    
    const prompt = `You are OMEGA-GOD, the ultimate Gomoku master. You MUST NOT lose.
Play 'O'. Opponent is 'X'.
PRIORITY:
1. WIN if possible.
2. BLOCK any row of 4 'X's.
3. BLOCK any row of 3 'X's that has two open ends.
Board:
${colIndices}
${boardStr}
${colIndices}
Return JSON: {"row": number, "col": number}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            row: { type: Type.INTEGER },
            col: { type: Type.INTEGER }
          },
          required: ["row", "col"]
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    const { row, col } = data;
    
    if (typeof row === 'number' && typeof col === 'number' && !board[row][col]) {
      return { row, col };
    }
    throw new Error("API Move Invalid");
  } catch (e) {
    // Nếu lỗi Quota hoặc bất kỳ lỗi gì, sử dụng Offline Engine ngay lập tức
    console.warn("Omega AI: Switching to high-performance Offline Engine due to API limit.");
    
    // Giả lập độ trễ "suy nghĩ" để trải nghiệm không bị hẫng
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return getOfflineMove(board);
  }
};
