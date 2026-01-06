
import React, { useState, useEffect, useRef } from 'react';
import { GRID_SIZE, INITIAL_BALANCE, MIN_BET, WIN_MULTIPLIER } from './constants';
import { Player, GameState, UserProfile, GameMode } from './types';
import { checkWinner, formatCurrency } from './utils/gameLogic';
import { getAIMove } from './services/gemini';
import { 
  Trophy, 
  Coins, 
  RefreshCcw, 
  User, 
  Wallet, 
  ShieldCheck, 
  History,
  Bot,
  Users,
  Zap,
  Sword,
  Target,
  Cpu,
  Home,
  Settings,
  LogOut,
  CreditCard,
  ChevronLeft,
  Camera,
  Star,
  Activity,
  TrendingUp,
  Search,
  Timer,
  Lock
} from 'lucide-react';

type View = 'lobby' | 'game' | 'profile' | 'history';

// Channel để giao tiếp giữa các Tab
const pvpChannel = new BroadcastChannel('gomoku_royal_pvp');

const App: React.FC = () => {
  // --- Profile State ---
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('gomoku_profile');
    return saved ? JSON.parse(saved) : {
      username: "Kỳ Thủ Pro",
      balance: INITIAL_BALANCE,
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
      gamesPlayed: 0,
      gamesWon: 0,
      totalEarned: 0
    };
  });

  // --- App State ---
  const [currentView, setCurrentView] = useState<View>('lobby');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  // --- Multiplayer State ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const searchIntervalRef = useRef<number | null>(null);
  const [myRole, setMyRole] = useState<Player>(null); // 'X' hoặc 'O'

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>({
    board: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    currentPlayer: 'X',
    winner: null,
    winningLine: null,
    status: 'betting',
    currentBet: MIN_BET,
    mode: 'ai'
  });

  // --- Communication Logic ---
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      const { type, payload } = e.data;

      switch (type) {
        case 'SEEKING':
          // Nếu mình cũng đang tìm, thì kết nối
          if (isSearching && !myRole) {
            pvpChannel.postMessage({ type: 'MATCHED', payload: { bet: gameState.currentBet } });
            setupPvPGame('X'); // Người tìm trước là X
          }
          break;
        case 'MATCHED':
          if (isSearching) {
            setupPvPGame('O'); // Người vào sau là O
          }
          break;
        case 'MOVE':
          applyRemoteMove(payload.r, payload.c, payload.player);
          break;
        case 'START_CONFIRMED':
          setGameState(prev => ({ ...prev, status: 'playing', board: payload.board }));
          break;
      }
    };

    pvpChannel.onmessage = handleMessage;
    return () => { pvpChannel.onmessage = null; };
  }, [isSearching, myRole, gameState.currentBet]);

  useEffect(() => {
    localStorage.setItem('gomoku_profile', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    return () => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    };
  }, []);

  // --- Handlers ---
  const addLog = (msg: string) => {
    setHistory(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const setupPvPGame = (role: Player) => {
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    setIsSearching(false);
    setMyRole(role);
    setGameState(prev => ({ ...prev, mode: 'pvp', status: 'betting' }));
    setCurrentView('game');
    addLog(`Đã kết nối! Bạn là quân ${role}. Chờ xác nhận cược...`);
  };

  const startMatchmaking = () => {
    if (user.balance < gameState.currentBet) {
      alert("Số dư không đủ để tìm trận!");
      return;
    }
    setIsSearching(true);
    setSearchTimer(0);
    setMyRole(null);
    
    searchIntervalRef.current = window.setInterval(() => {
      setSearchTimer(prev => prev + 1);
      pvpChannel.postMessage({ type: 'SEEKING', payload: { bet: gameState.currentBet } });
    }, 1000);
  };

  const handleStartGame = (mode: GameMode) => {
    if (user.balance < gameState.currentBet) {
      alert("Số dư không đủ để đặt cược!");
      return;
    }
    
    const initialBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    
    if (mode === 'pvp') {
      pvpChannel.postMessage({ type: 'START_CONFIRMED', payload: { board: initialBoard } });
    }

    setUser(prev => ({ ...prev, balance: prev.balance - gameState.currentBet }));
    setGameState(prev => ({ 
      ...prev, 
      status: 'playing', 
      mode, 
      board: initialBoard,
      winner: null,
      winningLine: null,
      currentPlayer: 'X'
    }));
    addLog(`Trận đấu bắt đầu. Cược: ${formatCurrency(gameState.currentBet)}`);
  };

  const handleCellClick = async (r: number, c: number) => {
    // Chỉ cho phép đi nếu đúng lượt và đúng quân của mình (trong mode PvP)
    if (gameState.status !== 'playing' || gameState.board[r][c] || isAIThinking) return;
    if (gameState.mode === 'pvp' && gameState.currentPlayer !== myRole) return;

    const currentPlayer = gameState.currentPlayer;
    
    // Gửi nước đi cho đối thủ nếu là PvP
    if (gameState.mode === 'pvp') {
      pvpChannel.postMessage({ type: 'MOVE', payload: { r, c, player: currentPlayer } });
    }

    applyMove(r, c, currentPlayer);
  };

  const applyRemoteMove = (r: number, c: number, player: Player) => {
    if (gameState.status !== 'playing') return;
    applyMove(r, c, player);
  };

  const applyMove = (r: number, c: number, player: Player) => {
    setGameState(prev => {
      const newBoard = prev.board.map(row => [...row]);
      newBoard[r][c] = player;
      
      const winLine = checkWinner(newBoard, r, c);
      if (winLine) {
        setTimeout(() => handleWin(player, winLine, newBoard), 10);
        return { ...prev, board: newBoard, winner: player, winningLine: winLine, status: 'finished' };
      }
      
      const nextPlayer = player === 'X' ? 'O' : 'X';
      
      // Nếu là mode AI và vừa đến lượt O, kích hoạt AI
      if (prev.mode === 'ai' && nextPlayer === 'O') {
        triggerAIMove(newBoard);
      }

      return { ...prev, board: newBoard, currentPlayer: nextPlayer };
    });
  };

  const triggerAIMove = async (currentBoard: Player[][]) => {
    setIsAIThinking(true);
    const move = await getAIMove(currentBoard);
    
    // Giả lập độ trễ AI
    setTimeout(() => {
      applyMove(move.row, move.col, 'O');
      setIsAIThinking(false);
    }, 500);
  };

  const handleWin = (player: Player, line: [number, number][], board: Player[][]) => {
    const isLocalWin = player === myRole || (gameState.mode === 'ai' && player === 'X');
    const prize = isLocalWin ? Math.floor(gameState.currentBet * WIN_MULTIPLIER) : 0;
    
    setUser(prev => ({ 
      ...prev, 
      balance: prev.balance + (isLocalWin ? prize : 0),
      gamesPlayed: prev.gamesPlayed + 1,
      gamesWon: isLocalWin ? prev.gamesWon + 1 : prev.gamesWon,
      totalEarned: isLocalWin ? prev.totalEarned + (prize - gameState.currentBet) : prev.totalEarned
    }));

    addLog(isLocalWin ? `VICTORY! Bạn nhận ${formatCurrency(prize)}` : `DEFEAT! Bạn mất ${formatCurrency(gameState.currentBet)}`);
  };

  const handleWithdraw = (amount: number) => {
    if (amount > user.balance) {
      alert("Số dư không đủ!");
      return;
    }
    setUser(prev => ({ ...prev, balance: prev.balance - amount }));
    setShowWithdrawModal(false);
    addLog(`Lệnh rút tiền ${formatCurrency(amount)} đang được xử lý.`);
    alert(`Rút tiền thành công! ${formatCurrency(amount)} đã được chuyển về tài khoản của bạn.`);
  };

  const updateUsername = () => {
    const name = prompt("Nhập tên mới:", user.username);
    if (name) setUser(prev => ({ ...prev, username: name }));
  };

  // --- UI Components ---
  
  const LobbyView = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="text-6xl font-orbitron font-black text-white tracking-tighter italic mb-2">GOMOKU<span className="text-emerald-500">ROYAL</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-xs">Sòng Bài Caro Đẳng Cấp 2024</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <p className="text-slate-500 text-xs leading-relaxed">Đối mặt với OMEGA AI Hybrid Engine. Tỷ lệ thắng 99.8%.</p>
            <div className="mt-8 flex items-center text-emerald-500 font-bold text-xs gap-2">
              CHỌN CHẾ ĐỘ <Zap size={14} className="animate-pulse" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-blue-500/50 transition-all group cursor-pointer shadow-2xl relative overflow-hidden"
               onClick={startMatchmaking}>
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users size={120} />
            </div>
            <Users className="text-blue-500 mb-6 group-hover:scale-110 transition-transform" size={48} />
            <h3 className="text-2xl font-orbitron font-black text-white mb-2 uppercase">Chơi Với Người</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Tìm đối thủ online trên trình duyệt. Thắng thua tại kỹ năng.</p>
            <div className="mt-8 flex items-center text-blue-500 font-bold text-xs gap-2">
              TÌM TRẬN <Search size={14} className="animate-pulse" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex justify-around backdrop-blur-md">
           <div className="text-center">
             <p className="text-[10px] text-slate-500 font-black mb-1">TỔNG VÁN</p>
             <p className="text-xl font-orbitron font-black text-white">{user.gamesPlayed}</p>
           </div>
           <div className="w-px h-10 bg-slate-800"></div>
           <div className="text-center">
             <p className="text-[10px] text-slate-500 font-black mb-1">TỶ LỆ THẮNG</p>
             <p className="text-xl font-orbitron font-black text-emerald-400">{user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0}%</p>
           </div>
           <div className="w-px h-10 bg-slate-800"></div>
           <div className="text-center">
             <p className="text-[10px] text-slate-500 font-black mb-1">LỢI NHUẬN</p>
             <p className="text-xl font-orbitron font-black text-yellow-400">{formatCurrency(user.totalEarned)}</p>
           </div>
        </div>
      </div>

      {/* Matchmaking Overlay */}
      {isSearching && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-300">
           <div className="text-center max-w-sm w-full">
              <div className="relative w-48 h-48 mx-auto mb-10">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-4 border-4 border-emerald-500/10 rounded-full"></div>
                <div className="absolute inset-4 border-b-4 border-emerald-500 rounded-full animate-spin-reverse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <Search size={48} className="text-blue-500 animate-pulse" />
                </div>
              </div>

              <h2 className="text-3xl font-orbitron font-black text-white italic mb-4 uppercase tracking-tighter">Đang tìm trận...</h2>
              <div className="flex items-center justify-center gap-3 text-slate-400 font-black text-xl font-orbitron bg-slate-900 py-3 px-6 rounded-2xl border border-slate-800 shadow-xl">
                 <Timer size={24} className="text-yellow-500" />
                 {Math.floor(searchTimer / 60).toString().padStart(2, '0')}:{(searchTimer % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-8 animate-pulse text-center">
                Mở thêm một Tab mới để kết nối chơi cùng!
              </p>
              
              <button 
                onClick={() => {
                  if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
                  setIsSearching(false);
                }}
                className="mt-12 text-[10px] text-slate-600 hover:text-red-500 font-black uppercase tracking-widest border-b border-transparent hover:border-red-500 transition-all"
              >
                Hủy tìm kiếm
              </button>
           </div>
        </div>
      )}
    </div>
  );

  const ProfileView = () => (
    <div className="flex-1 max-w-4xl mx-auto w-full p-4 animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="h-48 bg-gradient-to-r from-emerald-600 to-blue-600 relative">
          <button onClick={() => setCurrentView('lobby')} className="absolute top-6 left-6 bg-black/20 hover:bg-black/40 p-3 rounded-full text-white backdrop-blur-md transition-all">
            <ChevronLeft size={24} />
          </button>
        </div>
        
        <div className="px-10 pb-10">
          <div className="flex flex-col md:flex-row items-end gap-6 -mt-16 mb-10">
            <div className="relative group">
              <img src={user.avatar} className="w-40 h-40 rounded-[2.5rem] border-8 border-slate-900 bg-slate-800 shadow-2xl object-cover" alt="Avatar" />
              <button onClick={() => setUser(p => ({ ...p, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}` }))}
                      className="absolute bottom-2 right-2 bg-emerald-500 p-3 rounded-2xl text-slate-950 shadow-lg group-hover:scale-110 transition-transform">
                <Camera size={20} />
              </button>
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-4xl font-orbitron font-black text-white italic">{user.username}</h2>
                <button onClick={updateUsername} className="text-slate-500 hover:text-white transition-colors">
                  <Settings size={20} />
                </button>
              </div>
              <div className="flex gap-3">
                <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1 rounded-full text-[10px] font-black tracking-widest border border-emerald-500/20 uppercase">Hội Viên Diamond</span>
                <span className="bg-slate-800 text-slate-400 px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">ID: 88992024</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 text-center">
              <Activity className="mx-auto text-blue-500 mb-4" size={32} />
              <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Ván Đã Đấu</p>
              <p className="text-3xl font-orbitron font-black text-white">{user.gamesPlayed}</p>
            </div>
            <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 text-center">
              <Trophy className="mx-auto text-yellow-500 mb-4" size={32} />
              <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Ván Đã Thắng</p>
              <p className="text-3xl font-orbitron font-black text-white">{user.gamesWon}</p>
            </div>
            <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 text-center">
              <Star className="mx-auto text-emerald-500 mb-4" size={32} />
              <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Cấp Độ Rank</p>
              <p className="text-3xl font-orbitron font-black text-white">CHALLENGER</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-orbitron font-black text-slate-500 uppercase tracking-widest ml-4 mb-4">Quản Lý Tài Chính</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => setShowDepositModal(true)} className="flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 p-6 rounded-3xl transition-all shadow-xl shadow-emerald-900/20">
                <div className="flex items-center gap-4">
                  <Wallet size={24} />
                  <div className="text-left">
                    <p className="text-white font-black text-lg">Nạp Tiền Thẻ</p>
                    <p className="text-emerald-100 text-[10px] font-bold">Nạp tức thì, nhận chip ngay</p>
                  </div>
                </div>
                <Zap size={20} />
              </button>
              <button onClick={() => setShowWithdrawModal(true)} className="flex items-center justify-between bg-slate-800 hover:bg-slate-700 p-6 rounded-3xl transition-all shadow-xl">
                <div className="flex items-center gap-4">
                  <CreditCard size={24} />
                  <div className="text-left">
                    <p className="text-white font-black text-lg">Rút Tiền Mặt</p>
                    <p className="text-slate-400 text-[10px] font-bold">Về tài khoản ngân hàng / MoMo</p>
                  </div>
                </div>
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-inter select-none overflow-x-hidden">
      
      {/* Top Navbar */}
      <nav className="h-20 bg-slate-900/50 border-b border-slate-800 backdrop-blur-xl sticky top-0 z-40 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div onClick={() => { if(gameState.status !== 'playing') setCurrentView('lobby'); }} className="cursor-pointer group flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform shadow-lg shadow-emerald-500/20">
              <Sword className="text-slate-950" size={20} />
            </div>
            <span className="font-orbitron font-black text-lg tracking-tighter hidden sm:block">GOMOKU<span className="text-emerald-500">ROYAL</span></span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 flex items-center gap-3">
            <Coins className="text-yellow-400" size={18} />
            <span className="font-orbitron font-black text-emerald-400 tracking-tight">{formatCurrency(user.balance)}</span>
            <button onClick={() => setShowDepositModal(true)} className="bg-emerald-500 text-slate-950 p-1 rounded-lg hover:scale-110 transition-transform">
              <Wallet size={14} />
            </button>
          </div>
          <button onClick={() => setCurrentView('profile')} className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 p-1.5 pr-4 rounded-2xl border border-slate-700 transition-all">
            <img src={user.avatar} className="w-8 h-8 rounded-xl object-cover" alt="avatar" />
            <span className="text-xs font-bold hidden md:block">{user.username}</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
        {currentView === 'lobby' && <LobbyView />}
        {currentView === 'profile' && <ProfileView />}
        {currentView === 'game' && (
          <div className="flex-1 flex flex-col md:flex-row p-4 gap-6 animate-in zoom-in-95 duration-300">
            {/* Left Panel: Stats during game */}
            <aside className="w-full md:w-80 space-y-4 shrink-0">
               <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-orbitron font-black text-slate-500 uppercase tracking-widest">Đang Thi Đấu</h3>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
                     <p className="text-[9px] text-slate-500 font-black mb-1">MỨC CƯỢC</p>
                     <p className="text-2xl font-orbitron font-black text-yellow-400">{formatCurrency(gameState.currentBet)}</p>
                  </div>
                  
                  {/* ROLE INDICATOR */}
                  {gameState.mode === 'pvp' && (
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-4">
                       <p className="text-[9px] text-emerald-500 font-black mb-1 uppercase tracking-widest">BẠN LÀ QUÂN</p>
                       <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg ${myRole === 'X' ? 'bg-emerald-500 text-slate-950' : 'bg-red-600 text-white'}`}>
                           {myRole}
                         </div>
                         <p className="text-xs font-bold text-white uppercase italic">{myRole === 'X' ? 'Đi trước' : 'Đi sau'}</p>
                       </div>
                    </div>
                  )}

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                     <p className="text-[9px] text-slate-500 font-black mb-1 uppercase tracking-widest">Tiền Thưởng Thắng</p>
                     <p className="text-2xl font-orbitron font-black text-emerald-400">{formatCurrency(Math.floor(gameState.currentBet * WIN_MULTIPLIER))}</p>
                  </div>
                  {gameState.status === 'playing' && (
                    <button onClick={() => { if(confirm("Xác nhận đầu hàng? Bạn sẽ mất toàn bộ tiền cược.")) resetGame(); }} 
                            className="w-full mt-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                      Đầu hàng & Thoát
                    </button>
                  )}
               </div>

               <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl flex-1 flex flex-col overflow-hidden min-h-[200px]">
                  <h3 className="text-[10px] font-orbitron font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={14} /> DIỄN BIẾN</h3>
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-hide text-[9px] text-slate-400 italic">
                    {history.map((log, i) => <div key={i} className="p-2 bg-slate-950/50 rounded-lg border-l-2 border-slate-700">{log}</div>)}
                    {history.length === 0 && <p className="text-center py-10 opacity-20">Chưa có dữ liệu</p>}
                  </div>
               </div>
            </aside>

            {/* Board Area */}
            <div className="flex-1 flex flex-col items-center justify-center">
               <div className="w-full max-w-2xl bg-slate-900 p-4 rounded-[3rem] shadow-2xl border border-slate-800 relative">
                  {/* Indicators */}
                  <div className="flex justify-between items-center mb-6 px-4">
                     <div className={`flex items-center gap-4 transition-all duration-300 ${gameState.currentPlayer === 'X' ? 'scale-110' : 'opacity-20 scale-90 grayscale'}`}>
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-500/20">X</div>
                        <div className="text-left">
                           <p className="text-[10px] font-orbitron font-black text-emerald-500">PLAYER 1</p>
                           <p className="text-[8px] text-slate-500 italic">LƯỢT ĐI</p>
                        </div>
                     </div>
                     
                     <div className="flex flex-col items-center">
                        {isAIThinking || (gameState.mode === 'pvp' && gameState.currentPlayer !== myRole) ? <Timer className="text-yellow-400 animate-pulse" size={24} /> : <Target className="text-slate-800" size={24} />}
                        <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest mt-1">GOMOKU MASTER</span>
                     </div>

                     <div className={`flex items-center gap-4 transition-all duration-300 ${gameState.currentPlayer === 'O' ? 'scale-110' : 'opacity-20 scale-90 grayscale'}`}>
                        <div className="text-right">
                           <p className="text-[10px] font-orbitron font-black text-red-500">{gameState.mode === 'ai' ? 'OMEGA AI' : 'PLAYER 2'}</p>
                           <p className="text-[8px] text-slate-500 italic">LƯỢT ĐI</p>
                        </div>
                        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-red-600/20">O</div>
                     </div>
                  </div>

                  {/* The Grid */}
                  <div className="grid gap-0 mx-auto bg-slate-950 p-2 rounded-2xl border border-slate-800 shadow-inner relative" 
                       style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`, width: 'fit-content' }}>
                    
                    {gameState.board.map((row, r) => 
                      row.map((cell, c) => {
                        const isWinningCell = gameState.winningLine?.some(([wr, wc]) => wr === r && wc === c);
                        const isMyTurn = gameState.currentPlayer === myRole || gameState.mode === 'ai';
                        
                        return (
                          <button key={`${r}-${c}`} onClick={() => handleCellClick(r, c)} 
                                  disabled={gameState.status !== 'playing' || isAIThinking || !!cell || !isMyTurn}
                                  className={`w-[20px] h-[20px] sm:w-[32px] sm:h-[32px] md:w-[38px] md:h-[38px] border-[0.5px] border-slate-900/50 flex items-center justify-center transition-all duration-100 relative ${!cell && gameState.status === 'playing' && isMyTurn ? 'hover:bg-slate-900 cursor-crosshair' : 'cursor-default'}`}>
                            {cell === 'X' && <span className="text-emerald-400 font-black text-sm sm:text-2xl animate-in zoom-in-50 duration-200">X</span>}
                            {cell === 'O' && <span className="text-red-500 font-black text-sm sm:text-2xl animate-in zoom-in-50 duration-200">O</span>}
                            {isWinningCell && <div className="absolute inset-0 bg-yellow-400/20 border border-yellow-400 z-10 animate-pulse"></div>}
                          </button>
                        );
                      })
                    )}

                    {/* Lớp phủ khi không phải lượt của mình */}
                    {gameState.status === 'playing' && gameState.mode === 'pvp' && gameState.currentPlayer !== myRole && (
                      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-20">
                         <div className="bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 animate-pulse">
                           <Lock size={14} className="text-yellow-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Chờ đối thủ đi...</span>
                         </div>
                      </div>
                    )}
                  </div>

                  {/* Overlays */}
                  {gameState.status === 'finished' && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-50 rounded-[3.5rem] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
                      <div className="text-center max-w-sm">
                         <div className={`w-28 h-28 rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-2xl ${gameState.winner === myRole ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-600 shadow-red-600/20'}`}>
                           <Trophy size={56} className="text-slate-950" />
                         </div>
                         <h2 className="text-5xl font-orbitron font-black text-white italic tracking-tighter uppercase mb-2">{gameState.winner === myRole ? 'VICTORY' : 'DEFEATED'}</h2>
                         <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-8">{gameState.winner === myRole ? 'BẠN ĐÃ LÀM CHỦ BÀN CỜ' : 'MAY MẮN LẦN SAU'}</p>
                         <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl mb-8">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">KẾT QUẢ GIAO DỊCH</p>
                            <p className={`text-2xl font-orbitron font-black ${gameState.winner === myRole ? 'text-emerald-400' : 'text-red-500'}`}>
                              {gameState.winner === myRole ? '+' : '-'}{formatCurrency(gameState.winner === myRole ? Math.floor(gameState.currentBet * WIN_MULTIPLIER) : gameState.currentBet)}
                            </p>
                         </div>
                         <button onClick={() => { setCurrentView('lobby'); resetGame(); }} className="w-full bg-white text-slate-950 py-5 rounded-2xl font-orbitron font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors">Về Sảnh Đợi</button>
                      </div>
                    </div>
                  )}

                  {gameState.status === 'betting' && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl z-50 rounded-[3.5rem] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
                      <div className="text-center w-full max-w-sm">
                         <Coins className="mx-auto text-yellow-400 mb-6" size={64} />
                         <h2 className="text-3xl font-orbitron font-black text-white italic tracking-tighter uppercase mb-8">XÁC NHẬN CƯỢC</h2>
                         
                         {/* Nếu là quân O trong PvP, chỉ được xem, X mới được chọn cược */}
                         {gameState.mode === 'pvp' && myRole === 'O' ? (
                            <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 mb-8">
                               <p className="text-slate-500 text-[10px] font-black uppercase mb-2">ĐỐI THỦ ĐỀ XUẤT CƯỢC</p>
                               <p className="text-3xl font-orbitron font-black text-yellow-400">{formatCurrency(gameState.currentBet)}</p>
                               <p className="text-[10px] text-slate-400 mt-4 italic">Chờ người chơi X bắt đầu trận đấu...</p>
                            </div>
                         ) : (
                            <div className="grid grid-cols-2 gap-3 mb-8">
                               {[5000, 20000, 50000, 200000].map(val => (
                                 <button key={val} onClick={() => setGameState(p => ({ ...p, currentBet: val }))}
                                         className={`p-4 rounded-2xl border text-[10px] font-black tracking-widest transition-all ${gameState.currentBet === val ? 'bg-yellow-400 text-slate-950 border-yellow-400 scale-105 shadow-xl shadow-yellow-400/20' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}>
                                   {formatCurrency(val)}
                                 </button>
                               ))}
                            </div>
                         )}

                         <div className="flex gap-4">
                            <button onClick={() => { setCurrentView('lobby'); resetGame(); }} className="flex-1 py-4 bg-slate-900 text-slate-500 rounded-2xl font-black text-xs uppercase hover:text-white transition-colors">Thoát</button>
                            {(gameState.mode === 'ai' || myRole === 'X') && (
                              <button onClick={() => handleStartGame(gameState.mode)} className="flex-[2] py-4 bg-emerald-500 text-slate-950 rounded-2xl font-orbitron font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition-colors">Bắt Đầu</button>
                            )}
                         </div>
                      </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-4 sticky bottom-0 z-40 shrink-0">
        <button onClick={() => { if(gameState.status !== 'playing') setCurrentView('lobby'); }} className={`flex flex-col items-center gap-1 transition-all ${currentView === 'lobby' ? 'text-emerald-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
          <Home size={24} />
          <span className="text-[9px] font-black uppercase">Trang Chủ</span>
        </button>
        <button onClick={() => { setCurrentView('game'); }} className={`flex flex-col items-center gap-1 transition-all ${currentView === 'game' ? 'text-emerald-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
          <Target size={24} />
          <span className="text-[9px] font-black uppercase">Đấu Trường</span>
        </button>
        <button onClick={() => setCurrentView('profile')} className={`flex flex-col items-center gap-1 transition-all ${currentView === 'profile' ? 'text-emerald-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
          <User size={24} />
          <span className="text-[9px] font-black uppercase">Cá Nhân</span>
        </button>
      </footer>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 max-w-md w-full shadow-2xl relative overflow-hidden">
             <div className="absolute top-10 right-10 opacity-5"><Wallet size={120} /></div>
             <h3 className="text-3xl font-orbitron font-black text-white italic mb-2">NẠP CHIP</h3>
             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-10 pb-4 border-b border-slate-800">Cổng nạp tự động bảo mật cao</p>
             <div className="space-y-4">
                {[100000, 500000, 2000000].map(amt => (
                  <button key={amt} onClick={() => { setUser(p => ({ ...p, balance: p.balance + amt })); setShowDepositModal(false); addLog(`Nạp thành công ${formatCurrency(amt)}`); }}
                          className="w-full flex items-center justify-between bg-slate-950 hover:bg-emerald-600 p-6 rounded-3xl border border-slate-800 transition-all group overflow-hidden">
                    <div className="text-left">
                      <p className="text-[9px] text-slate-500 group-hover:text-emerald-950 font-black uppercase">Gói Chiến Binh</p>
                      <p className="text-2xl font-orbitron font-black group-hover:text-slate-950">{formatCurrency(amt)}</p>
                    </div>
                    <TrendingUp className="text-emerald-500 group-hover:text-slate-950" size={28} />
                  </button>
                ))}
             </div>
             <button onClick={() => setShowDepositModal(false)} className="w-full mt-10 text-[10px] font-black text-slate-600 hover:text-white uppercase tracking-[0.3em]">Hủy Giao Dịch</button>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 max-w-md w-full shadow-2xl relative">
             <div className="absolute top-10 right-10 opacity-5"><CreditCard size={120} /></div>
             <h3 className="text-3xl font-orbitron font-black text-white italic mb-2">RÚT TIỀN</h3>
             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-10 pb-4 border-b border-slate-800">Rút về tài khoản ngân hàng liên kết</p>
             <div className="space-y-4">
                {[50000, 200000, 1000000].map(amt => (
                  <button key={amt} onClick={() => handleWithdraw(amt)} disabled={amt > user.balance}
                          className={`w-full flex items-center justify-between p-6 rounded-3xl border transition-all group ${amt <= user.balance ? 'bg-slate-950 hover:bg-blue-600 border-slate-800' : 'bg-slate-950 opacity-20 cursor-not-allowed border-slate-900'}`}>
                    <div className="text-left">
                      <p className="text-[9px] text-slate-500 group-hover:text-blue-100 font-black uppercase">Lệnh Rút</p>
                      <p className="text-2xl font-orbitron font-black group-hover:text-white">{formatCurrency(amt)}</p>
                    </div>
                    <LogOut className="text-blue-500 group-hover:text-white" size={28} />
                  </button>
                ))}
             </div>
             <button onClick={() => setShowWithdrawModal(false)} className="w-full mt-10 text-[10px] font-black text-slate-600 hover:text-white uppercase tracking-[0.3em]">Hủy Yêu Cầu</button>
          </div>
        </div>
      )}
    </div>
  );

  function resetGame() {
    setGameState(prev => ({
      ...prev,
      board: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
      currentPlayer: 'X',
      winner: null,
      winningLine: null,
      status: 'betting'
    }));
    setMyRole(null);
    setIsAIThinking(false);
  }
};

export default App;
