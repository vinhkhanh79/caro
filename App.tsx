import React, { useState, useEffect, useRef } from 'react';
import { GRID_SIZE, INITIAL_BALANCE, MIN_BET, WIN_MULTIPLIER } from './constants';
import { Player, GameState, UserProfile, GameMode } from './types';
import { checkWinner, formatCurrency } from './utils/gameLogic';
import { Timer } from 'lucide-react';
import { getAIMove } from './services/gemini';
import {
  Trophy,
  Coins,
  User,
  Wallet,
  ShieldCheck,
  Bot,
  Users,
  Zap,
  Sword,
  Cpu,
  Home,
  LogOut,
  ChevronLeft,
  Star,
  Activity,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  X,
  CreditCard,
  QrCode,
  Banknote,
  Building,
  CheckCircle2,
  Medal,
  Crown,
  TrendingUp
} from 'lucide-react';

type View = 'auth' | 'lobby' | 'game' | 'profile' | 'leaderboard';
type AuthMode = 'login' | 'register';
type LeaderboardTab = 'balance' | 'wins';

const App: React.FC = () => {
  // --- Auth & Profile State ---
  const [currentView, setCurrentView] = useState<View>('auth');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<UserProfile | null>(null);

  // Form inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // --- Modal State ---
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState(50000);
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('Vietcombank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  // --- Leaderboard State ---
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('balance');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Thêm state mới vào component
  const [searchTime, setSearchTime] = useState(0);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Game State ---
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'random' | 'private' | null>(null);
  const [matchCode, setMatchCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [myRole, setMyRole] = useState<Player>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const API_BASE = 'http://localhost:5000/api';
  const [gameState, setGameState] = useState<GameState>({
    board: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    currentPlayer: 'X',
    winner: null,
    winningLine: null,
    status: 'betting',
    currentBet: MIN_BET,
    mode: 'ai'
  });

  // --- Initialization ---
  useEffect(() => {

  }, []);


  // --- Socket Connection ---
  useEffect(() => {
    socketRef.current = new WebSocket('ws://localhost:8080'); // Thay bằng URL server thật của bạn

    socketRef.current.onopen = () => console.log('Connected to WebSocket server');

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleSocketMessage(data);
    };

    socketRef.current.onclose = () => console.log('Disconnected from server');

    return () => {
      socketRef.current?.close();
    };
  }, []);

  // const handleSocketMessage = (data: any) => {
  //   switch (data.type) {
  //     case 'MATCH_FOUND':
  //       setIsSearching(false);
  //       setMatchCode(data.roomId);
  //       setMyRole(data.role);
  //       setGameState(prev => ({ ...prev, mode: 'pvp', status: 'betting', currentBet: data.bet }));
  //       setCurrentView('game');
  //       break;
  //     case 'GAME_START':
  //       setGameState(prev => ({ ...prev, status: 'playing', board: data.board }));
  //       break;
  //     case 'MOVE':
  //       applyRemoteMove(data.row, data.col, data.player);
  //       break;
  //     case 'GAME_OVER':
  //       handleWin(data.winner, data.winningLine);
  //       break;
  //   }
  // };
  // Cập nhật hàm startMatchmaking
const startMatchmaking = (mode: 'random' | 'private', specificCode?: string) => {
  if (!user || user.balance < gameState.currentBet) {
    alert("Số dư không đủ!");
    return;
  }
  
  const roomId = specificCode || (mode === 'private' ? Math.floor(1000 + Math.random() * 9000).toString() : 'RANDOM');
  
  // Gửi yêu cầu tìm trận
  socketRef.current?.send(JSON.stringify({
    type: 'JOIN_QUEUE',
    userId: user.id,
    username: user.username,
    bet: gameState.currentBet,
    mode,
    roomId
  }));
  
  setIsSearching(true);
  setSearchMode(mode);
  setMatchCode(roomId);
  setSearchTime(0); // Reset timer
  
  // Bắt đầu đếm thời gian
  if (searchTimerRef.current) {
    clearInterval(searchTimerRef.current);
  }
  
  searchTimerRef.current = setInterval(() => {
    setSearchTime(prev => prev + 1);
  }, 1000);
};

// Thêm useEffect để dọn dẹp timer
useEffect(() => {
  return () => {
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
    }
  };
}, []);

// Cập nhật handleSocketMessage để dừng timer khi tìm thấy đối thủ
const handleSocketMessage = (data: any) => {
  switch (data.type) {
    case 'MATCH_FOUND':
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      setIsSearching(false);
      setMatchCode(data.roomId);
      setMyRole(data.role);
      setGameState(prev => ({ 
        ...prev, 
        mode: 'pvp', 
        status: 'betting', 
        currentBet: data.bet 
      }));
      setCurrentView('game');
      break;
      
    // ... rest of the cases remain the same
  }
};

  // --- Handlers ---
  const handleAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  setAuthError('');

  const endpoint = authMode === 'login' ? '/login' : '/register';
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput,
        password: passwordInput,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setAuthError(data.error || 'Lỗi không xác định');
      return;
    }

    login(data); // data là UserProfile từ server
  } catch (err) {
    setAuthError('Không kết nối được server');
  }
};

const login = (userData: UserProfile) => {
  setUser(userData);
  setCurrentView('lobby');
  setUsernameInput('');
  setPasswordInput('');
  setConfirmPasswordInput('');
};

const handleLogout = () => {
  setUser(null);
  setCurrentView('auth');
  resetGame();
};

// Cập nhật user sau khi thắng game
const handleWin = async (player: Player, line: [number, number][]) => {
  const isLocalWin = player === myRole || (gameState.mode === 'ai' && player === 'X');
  const prize = isLocalWin ? Math.floor(gameState.currentBet * WIN_MULTIPLIER) : 0;
  const netEarned = isLocalWin ? prize - gameState.currentBet : -gameState.currentBet;

  if (!user) return;

  const updatedUser = {
    ...user,
    balance: user.balance + (isLocalWin ? prize : 0),
    gamesPlayed: user.gamesPlayed + 1,
    gamesWon: isLocalWin ? user.gamesWon + 1 : user.gamesWon,
    totalEarned: user.totalEarned + netEarned,
  };

  setUser(updatedUser);

  // Gọi API cập nhật lên MongoDB
  try {
    await fetch(API_BASE + '/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        balance: updatedUser.balance,
        gamesPlayed: updatedUser.gamesPlayed,
        gamesWon: updatedUser.gamesWon,
        totalEarned: updatedUser.totalEarned,
      }),
    });
  } catch (err) {
    console.error('Lỗi cập nhật user:', err);
  }
};

// Nạp tiền ảo (chỉ tăng balance)
const handleDeposit = async () => {
  if (!user) return;
  setIsProcessingDeposit(true);

  const newBalance = user.balance + depositAmount;
  const updatedUser = { ...user, balance: newBalance };

  setUser(updatedUser);

  try {
    await fetch(API_BASE + '/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        balance: newBalance,
      }),
    });
  } catch (err) {
    alert('Lỗi nạp tiền');
  }

  setIsProcessingDeposit(false);
  setShowDepositModal(false);
};

// Rút tiền (giả lập)
const handleWithdraw = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) return;

  const amount = parseInt(withdrawAmount);
  if (amount < 50000 || amount > user.balance) {
    alert('Số tiền rút không hợp lệ');
    return;
  }

  setIsProcessingWithdraw(true);
  const newBalance = user.balance - amount;
  const updatedUser = { ...user, balance: newBalance };

  setUser(updatedUser);

  try {
    await fetch(API_BASE + '/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        balance: newBalance,
      }),
    });
    alert('Yêu cầu rút tiền thành công! (Giả lập)');
  } catch (err) {
    alert('Lỗi xử lý rút tiền');
  }

  setIsProcessingWithdraw(false);
  setShowWithdrawModal(false);
  setWithdrawAmount('');
};

// Load leaderboard từ server
useEffect(() => {
  if (currentView === 'leaderboard') {
    fetch(API_BASE + '/leaderboard')
      .then(res => res.json())
      .then(data => setAllUsers(data))
      .catch(() => setAllUsers([]));
  }
}, [currentView]);

  // const startMatchmaking = (mode: 'random' | 'private', specificCode?: string) => {
  //   if (!user || user.balance < gameState.currentBet) return alert("Số dư không đủ!");
  //   const roomId = specificCode || (mode === 'private' ? Math.floor(1000 + Math.random() * 9000).toString() : 'RANDOM');
  //   socketRef.current?.send(JSON.stringify({
  //     type: 'JOIN_QUEUE',
  //     userId: user.id,
  //     username: user.username,
  //     bet: gameState.currentBet,
  //     mode,
  //     roomId
  //   }));
  //   setIsSearching(true);
  //   setSearchMode(mode);
  //   setMatchCode(roomId);
  // };

  const handleStartGame = (mode: GameMode) => {
    if (!user || user.balance < gameState.currentBet) return alert("Số dư không đủ!");
    const initialBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    setUser(prev => prev ? ({ ...prev, balance: prev.balance - gameState.currentBet }) : null);
    socketRef.current?.send(JSON.stringify({
      type: 'START_GAME',
      roomId: matchCode,
      board: initialBoard
    }));
    setGameState(prev => ({ ...prev, status: 'playing', mode, board: initialBoard, winner: null, winningLine: null, currentPlayer: 'X' }));
  };

  const applyMove = (r: number, c: number, player: Player) => {
    setGameState(prev => {
      const newBoard = prev.board.map(row => [...row]);
      newBoard[r][c] = player;
      const winLine = checkWinner(newBoard, r, c);
      if (winLine) {
        setTimeout(() => {
          socketRef.current?.send(JSON.stringify({
            type: 'GAME_OVER',
            roomId: matchCode,
            winner: player,
            winningLine: winLine
          }));
        }, 10);
        return { ...prev, board: newBoard, winner: player, winningLine: winLine, status: 'finished' };
      }
      const nextPlayer = player === 'X' ? 'O' : 'X';
      if (prev.mode === 'ai' && nextPlayer === 'O') triggerAIMove(newBoard);
      if (prev.mode === 'pvp') {
        socketRef.current?.send(JSON.stringify({
          type: 'MOVE',
          roomId: matchCode,
          row: r,
          col: c,
          player
        }));
      }
      return { ...prev, board: newBoard, currentPlayer: nextPlayer };
    });
  };

  const triggerAIMove = async (currentBoard: Player[][]) => {
    setIsAIThinking(true);
    const move = await getAIMove(currentBoard);
    setTimeout(() => {
      applyMove(move.row, move.col, 'O');
      setIsAIThinking(false);
    }, 500);
  };


  const handleCellClick = (r: number, c: number) => {
    if (gameState.status !== 'playing' || gameState.board[r][c] || isAIThinking) return;
    if (gameState.mode === 'pvp' && gameState.currentPlayer !== myRole) return;
    applyMove(r, c, gameState.currentPlayer);
  };

  const applyRemoteMove = (r: number, c: number, player: Player) => {
    if (gameState.status !== 'playing') return;
    setGameState(prev => {
      const newBoard = prev.board.map(row => [...row]);
      newBoard[r][c] = player;
      const winLine = checkWinner(newBoard, r, c);
      if (winLine) {
        setGameState(prev => ({ ...prev, board: newBoard, winner: player, winningLine: winLine, status: 'finished' }));
        return { ...prev, board: newBoard, winner: player, winningLine: winLine, status: 'finished' };
      }
      const nextPlayer = player === 'X' ? 'O' : 'X';
      return { ...prev, board: newBoard, currentPlayer: nextPlayer };
    });
  };

  function resetGame() {
    setGameState(prev => ({ ...prev, board: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)), currentPlayer: 'X', winner: null, winningLine: null, status: 'betting' }));
    setMyRole(null);
    setIsSearching(false);
    setMatchCode('');
    setSearchMode(null);
    socketRef.current?.send(JSON.stringify({ type: 'LEAVE_ROOM', roomId: matchCode }));
  }

  // --- Sort Leaderboard Data ---
  const sortedUsers = [...allUsers].sort((a, b) => {
    if (leaderboardTab === 'balance') return b.balance - a.balance;
    return b.gamesWon - a.gamesWon;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-inter select-none overflow-x-hidden relative">
      
      {/* --- Auth View --- */}
      {currentView === 'auth' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>
          <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-500">
            <div className="text-center mb-10">
              <h1 className="text-5xl font-orbitron font-black text-white italic tracking-tighter mb-2">GOMOKU<span className="text-emerald-500">ROYAL</span></h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Đẳng Cấp Kỳ Thủ 2024</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
              <div className="flex gap-4 mb-10">
                <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}>Đăng Nhập</button>
                <button onClick={() => { setAuthMode('register'); setAuthError(''); }} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-white'}`}>Đăng Ký</button>
              </div>
              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Tên Kỳ Thủ</label>
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                    <input type="text" placeholder="Nhập username..." value={usernameInput} onChange={e => setUsernameInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-14 text-sm font-bold transition-all text-white placeholder:text-slate-700" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Mật Mã</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                    <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-14 text-sm font-bold transition-all text-white placeholder:text-slate-700" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  </div>
                </div>
                {authMode === 'register' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Xác Nhận Mật Mã</label>
                    <div className="relative group">
                      <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-14 text-sm font-bold transition-all text-white placeholder:text-slate-700" />
                    </div>
                  </div>
                )}
                {authError && <p className="text-red-500 text-[10px] font-bold text-center italic">{authError}</p>}
                <button type="submit" className={`w-full py-5 rounded-2xl font-orbitron font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 ${authMode === 'login' ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/10' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/10'}`}>
                  {authMode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
                  {authMode === 'login' ? 'VÀO SÒNG' : 'TẠO TÀI KHOẢN'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- Main App UI --- */}
      {currentView !== 'auth' && (
        <>
          <nav className="h-20 bg-slate-900/50 border-b border-slate-800 backdrop-blur-xl sticky top-0 z-40 px-6 flex items-center justify-between shrink-0">
            <div onClick={() => { if(gameState.status !== 'playing') setCurrentView('lobby'); }} className="cursor-pointer group flex items-center gap-2">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"><Sword className="text-slate-950" size={20} /></div>
              <span className="font-orbitron font-black text-lg tracking-tighter">GOMOKU<span className="text-emerald-500">ROYAL</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div onClick={() => setShowDepositModal(true)} className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 flex items-center gap-3 cursor-pointer hover:border-emerald-500 transition-all">
                <Coins className="text-yellow-400" size={18} />
                <span className="font-orbitron font-black text-emerald-400">{formatCurrency(user?.balance || 0)}</span>
              </div>
              <button onClick={() => setCurrentView('profile')} className="flex items-center gap-3 bg-slate-800/50 p-1.5 pr-4 rounded-2xl border border-slate-700">
                <img src={user?.avatar} className="w-8 h-8 rounded-xl object-cover" alt="avatar" />
                <span className="text-xs font-bold hidden md:block">{user?.username}</span>
              </button>
            </div>
          </nav>

          <main className="flex-1 flex flex-col relative overflow-y-auto">
            {/* --- Lobby View --- */}
            {currentView === 'lobby' && (
  <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
    <div className="w-full max-w-xl space-y-8">
      <div className="text-center">
        <h1 className="text-6xl font-orbitron font-black text-white tracking-tighter italic mb-2">
          GOMOKU<span className="text-emerald-500">ROYAL</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-xs">
          Chào mừng, {user?.username}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Mode Button */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-emerald-500/50 transition-all group cursor-pointer shadow-2xl relative overflow-hidden"
             onClick={() => { 
               setGameState(prev => ({ ...prev, mode: 'ai', status: 'betting' })); 
               setMyRole('X'); 
               setCurrentView('game'); 
             }}>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Bot size={120} />
          </div>
          <Cpu className="text-emerald-500 mb-6 group-hover:scale-110 transition-transform" size={48} />
          <h3 className="text-2xl font-orbitron font-black text-white mb-2 uppercase">Thách Đấu AI</h3>
          <div className="mt-8 flex items-center text-emerald-500 font-bold text-xs gap-2">
            CHỌN CHẾ ĐỘ <Zap size={14} className="animate-pulse" />
          </div>
        </div>
        
        {/* PvP Mode Button */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-blue-500/50 transition-all group cursor-pointer shadow-2xl relative overflow-hidden"
             onClick={() => {
               setSearchMode('private');
               setIsSearching(false);
               setInputCode('');
               setSearchTime(0);
             }}>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={120} />
          </div>
          <Users className="text-blue-500 mb-6 group-hover:scale-110 transition-transform" size={48} />
          <h3 className="text-2xl font-orbitron font-black text-white mb-2 uppercase">Chơi Với Người</h3>
          <div className="mt-8 flex items-center text-blue-500 font-bold text-xs gap-2">
            CHỌN CHẾ ĐỘ <ArrowRight size={14} className="animate-pulse" />
          </div>
        </div>
      </div>
      
      {/* PvP Options Panel - HIỆN THỊ KHI CHỌN CHƠI VỚI NGƯỜI */}
      {searchMode === 'private' && !isSearching && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-xl font-orbitron font-black text-white mb-6 text-center uppercase tracking-tight">
            CHỌN PHƯƠNG THỨC CHƠI PVP
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tìm Nhanh */}
            <div className="bg-slate-950 border border-slate-800 hover:border-blue-500 p-6 rounded-3xl transition-all cursor-pointer group"
                 onClick={() => startMatchmaking('random')}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="text-blue-500" size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-blue-500 font-black text-lg">Tìm Nhanh</p>
                  <p className="text-[10px] text-slate-500 font-medium">Hệ thống tự tìm đối thủ cùng mức cược</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>• Ghép đối ngẫu nhiên</span>
                <ArrowRight size={12} />
              </div>
            </div>
            
            {/* Chơi Với Bạn */}
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl flex flex-col gap-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                  <Users className="text-emerald-500" size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-emerald-500 font-black text-lg">Chơi Với Bạn</p>
                  <p className="text-[10px] text-slate-500 font-medium">Nhập mã để chơi cùng bạn bè</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      maxLength={4} 
                      placeholder="Nhập mã 4 số" 
                      value={inputCode} 
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setInputCode(value);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-white font-orbitron font-bold text-center outline-none focus:border-emerald-500 transition-all"
                    />
                    {inputCode.length === 4 && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      if (inputCode.length === 4) {
                        startMatchmaking('private', inputCode);
                      }
                    }}
                    disabled={inputCode.length !== 4}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRight size={16} /> Kết Nối
                  </button>
                </div>
                
                <div className="flex items-center justify-center gap-4">
                  <div className="flex-1 h-px bg-slate-800"></div>
                  <span className="text-[10px] text-slate-500 font-black uppercase">Hoặc</span>
                  <div className="flex-1 h-px bg-slate-800"></div>
                </div>
                
                <button 
                  onClick={() => {
                    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
                    setInputCode(randomCode);
                    startMatchmaking('private', randomCode);
                  }}
                  className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 py-3 rounded-2xl font-black text-xs uppercase transition-all border border-blue-500/30"
                >
                  Tạo Mã Mới
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Hiển thị khi đang tìm đối thủ */}
      {isSearching && (
        <div className="text-center p-10 bg-slate-900 rounded-[2.5rem] border border-blue-500/30 animate-in zoom-in duration-300">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
                <Users className="text-blue-500" size={32} />
              </div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            
            <div>
              <p className="font-orbitron font-black text-xl text-blue-500 mb-2 uppercase tracking-tight">
                {searchMode === 'private' ? 'ĐANG KẾT NỐI...' : 'ĐANG TÌM ĐỐI THỦ...'}
              </p>
              
              {/* Hiển thị thời gian countup */}
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Timer size={16} />
                <span className="font-orbitron font-black text-lg">
                  {Math.floor(searchTime / 60).toString().padStart(2, '0')}:
                  {(searchTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
          
          {searchMode === 'private' && inputCode && (
            <div className="mb-6 p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
              <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Mã Phòng</p>
              <p className="font-orbitron font-black text-2xl text-emerald-400 tracking-widest">
                {inputCode}
              </p>
              <p className="text-[10px] text-slate-600 mt-2">
                Chia sẻ mã này cho bạn bè để cùng chơi
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            <p className="text-[10px] text-slate-500 font-medium">
              {searchMode === 'random' 
                ? 'Hệ thống đang tìm đối thủ cùng mức cược...' 
                : 'Đang chờ đối thủ kết nối vào phòng...'}
            </p>
            
            <button 
              onClick={() => {
                setIsSearching(false);
                setSearchTime(0);
                if (searchTimerRef.current) {
                  clearInterval(searchTimerRef.current);
                  searchTimerRef.current = null;
                }
                // Gửi yêu cầu rời hàng đợi
                socketRef.current?.send(JSON.stringify({
                  type: 'LEAVE_QUEUE',
                  roomId: matchCode
                }));
              }} 
              className="px-6 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl text-xs font-black uppercase transition-all border border-red-600/20"
            >
              Hủy Tìm
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}

            {/* --- Game View --- */}
            {currentView === 'game' && (
              <div className="flex-1 flex flex-col md:flex-row p-4 gap-6 animate-in zoom-in-95 duration-300">
                <aside className="w-full md:w-80 space-y-4 shrink-0">
                   <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
                         <p className="text-[9px] text-slate-500 font-black mb-1">MỨC CƯỢC</p>
                         <p className="text-2xl font-orbitron font-black text-yellow-400">{formatCurrency(gameState.currentBet)}</p>
                      </div>
                      <div className="space-y-2">
                        <div className={`p-4 rounded-xl flex items-center justify-between ${gameState.currentPlayer === 'X' ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-800'}`}>
                           <span className="font-black text-xs">NGƯỜI CHƠI (X)</span>
                           {gameState.currentPlayer === 'X' && <Zap size={14} className="text-emerald-500 animate-pulse" />}
                        </div>
                        <div className={`p-4 rounded-xl flex items-center justify-between ${gameState.currentPlayer === 'O' ? 'bg-red-500/20 border border-red-500/50' : 'bg-slate-800'}`}>
                           <span className="font-black text-xs">ĐỐI THỦ (O)</span>
                           {gameState.currentPlayer === 'O' && <Zap size={14} className="text-red-500 animate-pulse" />}
                        </div>
                      </div>
                      {gameState.status === 'playing' && (
                        <button onClick={() => { if(confirm("Đầu hàng?")) resetGame(); }} className="w-full mt-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Đầu hàng</button>
                      )}
                   </div>
                </aside>
                <div className="flex-1 flex flex-col items-center justify-center relative">
                   <div className="w-full max-w-2xl bg-slate-900 p-4 rounded-[3rem] shadow-2xl border border-slate-800 relative">
                      <div className="grid gap-0 mx-auto bg-slate-950 p-2 rounded-2xl border border-slate-800 relative" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`, width: 'fit-content' }}>
                        {gameState.board.map((row, r) => row.map((cell, c) => (
                          <button key={`${r}-${c}`} onClick={() => handleCellClick(r, c)} 
                                  disabled={gameState.status !== 'playing' || isAIThinking || !!cell || (gameState.mode === 'pvp' && gameState.currentPlayer !== myRole)}
                                  className={`w-[20px] h-[20px] sm:w-[32px] sm:h-[32px] md:w-[38px] md:h-[38px] border-[0.5px] border-slate-900/50 flex items-center justify-center transition-all duration-100 hover:bg-slate-900`}>
                            {cell === 'X' && <span className="text-emerald-400 font-black text-sm sm:text-2xl animate-in zoom-in-50">X</span>}
                            {cell === 'O' && <span className="text-red-500 font-black text-sm sm:text-2xl animate-in zoom-in-50">O</span>}
                          </button>
                        )))}
                      </div>
                      {gameState.status === 'finished' && (
                        <div className="absolute inset-0 bg-slate-950/95 z-50 rounded-[3.5rem] flex items-center justify-center p-8 backdrop-blur-md">
                           <div className="text-center animate-in zoom-in duration-300">
                             <Trophy size={80} className="mx-auto mb-4 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                             <h2 className="text-5xl font-orbitron font-black mb-6 text-white uppercase italic">{gameState.winner === myRole || (gameState.mode === 'ai' && gameState.winner === 'X') ? 'CHIẾN THẮNG' : 'THẤT BẠI'}</h2>
                             <button onClick={() => { setCurrentView('lobby'); resetGame(); }} className="w-full bg-white text-slate-950 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-400 transition-all">Về Sảnh</button>
                           </div>
                        </div>
                      )}
                      {gameState.status === 'betting' && (
                        <div className="absolute inset-0 bg-slate-950/95 z-50 rounded-[3.5rem] flex items-center justify-center p-8 backdrop-blur-md">
                           <div className="text-center w-full max-w-xs animate-in zoom-in duration-300">
                             <h2 className="text-3xl font-orbitron font-black text-white mb-8 italic">MỨC CƯỢC</h2>
                             <div className="grid grid-cols-2 gap-3 mb-8">
                                {[5000, 20000, 50000, 200000].map(val => (
                                  <button key={val} onClick={() => setGameState(p => ({ ...p, currentBet: val }))}
                                          className={`p-4 rounded-2xl border text-[10px] font-black tracking-widest transition-all ${gameState.currentBet === val ? 'bg-yellow-400 text-slate-950 border-yellow-400 shadow-lg shadow-yellow-400/20' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}>{formatCurrency(val)}</button>
                                ))}
                             </div>
                             <div className="flex gap-4">
                                <button onClick={() => { setCurrentView('lobby'); resetGame(); }} className="flex-1 py-4 bg-slate-900 text-slate-500 rounded-2xl font-black text-xs uppercase hover:text-white">Thoát</button>
                                {(gameState.mode === 'ai' || myRole === 'X') && (
                                  <button onClick={() => handleStartGame(gameState.mode)} className="flex-[2] py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 shadow-xl shadow-emerald-500/20">Bắt Đầu</button>
                                )}
                             </div>
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            )}

            {/* --- Leaderboard View --- */}
            {currentView === 'leaderboard' && (
              <div className="flex-1 max-w-4xl mx-auto w-full p-4 animate-in slide-in-from-right-10 duration-500">
                 <div className="text-center mb-8">
                    <h2 className="text-4xl font-orbitron font-black text-white italic tracking-tighter">BẢNG XẾP HẠNG</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Vinh Danh Những Kỳ Thủ Xuất Sắc</p>
                 </div>

                 <div className="flex gap-4 mb-8">
                    <button onClick={() => setLeaderboardTab('balance')} 
                            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${leaderboardTab === 'balance' ? 'bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-400/20' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                       <Coins size={18} /> TÀI PHÚ
                    </button>
                    <button onClick={() => setLeaderboardTab('wins')} 
                            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${leaderboardTab === 'wins' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                       <Trophy size={18} /> CHIẾN THẦN
                    </button>
                 </div>

                 <div className="space-y-3 pb-10">
                    {sortedUsers.slice(0, 20).map((u, idx) => (
                      <div key={u.id} className={`flex items-center gap-4 p-5 rounded-[2rem] border transition-all ${u.id === user?.id ? 'bg-slate-800/50 border-emerald-500/50 shadow-xl' : 'bg-slate-900/50 border-slate-800'}`}>
                         <div className="w-10 text-center">
                            {idx === 0 ? <Crown size={24} className="text-yellow-400 mx-auto" /> : 
                             idx === 1 ? <Medal size={24} className="text-slate-300 mx-auto" /> :
                             idx === 2 ? <Medal size={24} className="text-orange-400 mx-auto" /> :
                             <span className="text-slate-500 font-orbitron font-black">{idx + 1}</span>}
                         </div>
                         <img src={u.avatar} className="w-12 h-12 rounded-xl bg-slate-800 border-2 border-slate-700" alt="avatar" />
                         <div className="flex-1">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                               {u.username}
                               {u.id === user?.id && <span className="bg-emerald-500/10 text-emerald-500 text-[8px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-black uppercase">Bạn</span>}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-medium">Rank: {idx < 3 ? 'Huyền Thoại' : idx < 10 ? 'Cao Thủ' : 'Tân Thủ'}</p>
                         </div>
                         <div className="text-right">
                            {leaderboardTab === 'balance' ? (
                               <div className="flex items-center justify-end gap-1.5 text-yellow-400 font-orbitron font-black text-sm">
                                  <Coins size={14} /> {formatCurrency(u.balance)}
                               </div>
                            ) : (
                               <div className="flex items-center justify-end gap-1.5 text-emerald-400 font-orbitron font-black text-sm">
                                  <Trophy size={14} /> {u.gamesWon} <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">TRẬN</span>
                               </div>
                            )}
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {/* --- Profile View --- */}
            {currentView === 'profile' && (
              <div className="flex-1 max-w-4xl mx-auto w-full p-4 animate-in slide-in-from-bottom-10 duration-500">
                <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                  <div className="h-48 bg-gradient-to-r from-emerald-600 to-blue-600 relative">
                    <button onClick={() => setCurrentView('lobby')} className="absolute top-6 left-6 bg-black/20 hover:bg-black/40 p-3 rounded-full text-white backdrop-blur-md transition-all"><ChevronLeft size={24} /></button>
                    <div className="absolute top-6 right-6 flex gap-2">
                       <button onClick={() => setShowWithdrawModal(true)} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-white backdrop-blur-md transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Banknote size={16} /> Rút Tiền</button>
                       <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 p-3 rounded-2xl text-white shadow-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><LogOut size={16} /> Đăng Xuất</button>
                    </div>
                  </div>
                  <div className="px-10 pb-10">
                    <div className="flex flex-col md:flex-row items-end gap-6 -mt-16 mb-10">
                      <div className="relative group"><img src={user?.avatar} className="w-40 h-40 rounded-[2.5rem] border-8 border-slate-900 bg-slate-800 shadow-2xl object-cover" alt="Avatar" /></div>
                      <div className="flex-1 pb-4">
                        <h2 className="text-4xl font-orbitron font-black text-white italic">{user?.username}</h2>
                        <div className="flex gap-4 mt-2">
                           <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs"><Coins size={14} /> {formatCurrency(user?.balance || 0)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 text-center">
                        <Activity className="mx-auto text-blue-500 mb-4" size={32} />
                        <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Ván Đấu</p>
                        <p className="text-3xl font-orbitron font-black text-white">{user?.gamesPlayed}</p>
                      </div>
                      <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 text-center">
                        <Trophy className="mx-auto text-yellow-500 mb-4" size={32} />
                        <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Ván Thắng</p>
                        <p className="text-3xl font-orbitron font-black text-white">{user?.gamesWon}</p>
                      </div>
                      <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 text-center">
                        <Star className="mx-auto text-emerald-500 mb-4" size={32} />
                        <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Tổng Lời</p>
                        <p className={`text-2xl font-orbitron font-black ${user?.totalEarned && user.totalEarned >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(user?.totalEarned || 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-4 sticky bottom-0 z-40">
            <button onClick={() => { if(gameState.status !== 'playing') setCurrentView('lobby'); }} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'lobby' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}><Home size={24} /><span className="text-[9px] font-black uppercase">Trang Chủ</span></button>
            <button onClick={() => setShowDepositModal(true)} className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300"><Wallet size={24} /><span className="text-[9px] font-black uppercase">Nạp Tiền</span></button>
            <button onClick={() => setCurrentView('leaderboard')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'leaderboard' ? 'text-yellow-500' : 'text-slate-500 hover:text-slate-300'}`}><TrendingUp size={24} /><span className="text-[9px] font-black uppercase">Xếp Hạng</span></button>
            <button onClick={() => setCurrentView('profile')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'profile' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}><User size={24} /><span className="text-[9px] font-black uppercase">Cá Nhân</span></button>
          </footer>
        </>
      )}

      {/* --- Deposit Modal --- */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                 <h2 className="text-2xl font-orbitron font-black text-white italic">NẠP TIỀN ẢO</h2>
                 <button onClick={() => setShowDepositModal(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                 <div className="grid grid-cols-2 gap-4">
                    {[50000, 100000, 500000, 1000000].map(amt => (
                      <button key={amt} onClick={() => setDepositAmount(amt)} className={`p-6 rounded-3xl border-2 transition-all text-center ${depositAmount === amt ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                         <p className="text-[10px] font-black uppercase mb-1">Mức Nạp</p>
                         <p className="text-lg font-orbitron font-black">{formatCurrency(amt)}</p>
                      </button>
                    ))}
                 </div>
                 <div className="bg-slate-950 p-6 rounded-[2.5rem] border border-slate-800 space-y-6">
                    <div className="flex items-center gap-4 text-emerald-500 bg-emerald-500/5 p-4 rounded-2xl">
                       <QrCode size={40} />
                       <div>
                          <p className="font-black text-xs uppercase">Quét QR Mã Thanh Toán</p>
                          <p className="text-[10px] text-slate-500">Mã giao dịch: ROYAL-{Date.now()}</p>
                       </div>
                    </div>
                    <div className="aspect-square bg-white rounded-3xl flex items-center justify-center p-6 mx-auto w-48 shadow-xl">
                       <div className="w-full h-full bg-slate-100 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-slate-200 grid grid-cols-4 gap-1 opacity-20">
                             {Array(16).fill(0).map((_, i) => <div key={i} className="bg-black"></div>)}
                          </div>
                          <QrCode size={100} className="text-slate-950 relative z-10" />
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-950 border-t border-slate-800">
                 <button onClick={handleDeposit} disabled={isProcessingDeposit}
                         className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-orbitron font-black uppercase tracking-widest shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-3 disabled:opacity-50">
                   {isProcessingDeposit ? (
                     <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-4 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></div>
                        ĐANG XỬ LÝ...
                     </div>
                   ) : (
                     <>XÁC NHẬN NẠP <ArrowRight size={20} /></>
                   )}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- Withdraw Modal --- */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                 <h2 className="text-2xl font-orbitron font-black text-white italic uppercase tracking-tighter">RÚT TIỀN <span className="text-blue-500">ROYAL</span></h2>
                 <button onClick={() => setShowWithdrawModal(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleWithdraw} className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                 <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 flex items-center gap-3">
                    <CheckCircle2 className="text-blue-500" size={20} />
                    <p className="text-[10px] text-slate-400 font-medium">Lệnh rút sẽ được phê duyệt tự động sau khi đối soát số dư.</p>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Ngân Hàng</label>
                       <div className="relative">
                          <Building className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                          <select value={bankName} onChange={e => setBankName(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white appearance-none transition-all cursor-pointer">
                             {['Vietcombank', 'MB Bank', 'Techcombank', 'BIDV', 'Agribank', 'Momo'].map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Số Tài Khoản</label>
                       <div className="relative">
                          <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                          <input type="text" placeholder="Ví dụ: 0123456789..." value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                                 className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white transition-all" />
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Tên Chủ Tài Khoản</label>
                       <div className="relative">
                          <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                          <input type="text" placeholder="NGUYEN VAN A..." value={accountName} onChange={e => setAccountName(e.target.value.toUpperCase())}
                                 className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white transition-all uppercase" />
                       </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Số Tiền Rút (Số dư: {formatCurrency(user?.balance || 0)})</label>
                       <div className="relative">
                          <Coins className="absolute left-5 top-1/2 -translate-y-1/2 text-yellow-500" size={18} />
                          <input type="number" placeholder="Tối thiểu 50.000đ" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                                 className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white transition-all" />
                       </div>
                       <p className="text-[10px] text-slate-600 italic ml-4">Phí giao dịch: 0đ</p>
                    </div>
                 </div>

                 <button type="submit" disabled={isProcessingWithdraw}
                         className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-orbitron font-black uppercase tracking-widest shadow-xl shadow-blue-500/10 flex items-center justify-center gap-3 disabled:opacity-50 transition-all">
                    {isProcessingWithdraw ? (
                      <div className="flex items-center gap-2">
                         <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                         ĐANG GỬI YÊU CẦU...
                      </div>
                    ) : (
                      <>XÁC NHẬN RÚT TIỀN <ArrowRight size={20} /></>
                    )}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
