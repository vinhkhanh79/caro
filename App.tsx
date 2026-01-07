
import React, { useState, useEffect, useRef } from 'react';
import { GRID_SIZE, INITIAL_BALANCE, MIN_BET, WIN_MULTIPLIER } from './constants';
import { Player, GameState, UserProfile, GameMode } from './types';
import { checkWinner, formatCurrency } from './utils/gameLogic';
import { getAIMove } from './services/gemini';
import { 
  Trophy, 
  Coins, 
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
  Lock,
  Copy,
  Hash,
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
  LogIn
} from 'lucide-react';

type View = 'auth' | 'lobby' | 'game' | 'profile';
type AuthMode = 'login' | 'register';

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

  // --- App State ---
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  // --- Multiplayer & Matchmaking State ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'random' | 'private' | null>(null);
  const [matchCode, setMatchCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [searchTimer, setSearchTimer] = useState(0);
  const searchIntervalRef = useRef<number | null>(null);
  const [myRole, setMyRole] = useState<Player>(null); 
  const pvpChannelRef = useRef<BroadcastChannel | null>(null);

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

  // --- Initialization & Persistance ---
  useEffect(() => {
    const session = localStorage.getItem('gomoku_session');
    if (session) {
      const users: UserProfile[] = JSON.parse(localStorage.getItem('gomoku_users') || '[]');
      const foundUser = users.find(u => u.id === session);
      if (foundUser) {
        setUser(foundUser);
        setCurrentView('lobby');
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      const users: UserProfile[] = JSON.parse(localStorage.getItem('gomoku_users') || '[]');
      const updatedUsers = users.map(u => u.id === user.id ? user : u);
      localStorage.setItem('gomoku_users', JSON.stringify(updatedUsers));
    }
  }, [user]);

  // --- Communication Logic ---
  useEffect(() => {
    if (!pvpChannelRef.current) return;

    const handleMessage = (e: MessageEvent) => {
      const { type, payload } = e.data;
      switch (type) {
        case 'SEEKING':
          if (isSearching && !myRole) {
            pvpChannelRef.current?.postMessage({ type: 'MATCHED', payload: { bet: gameState.currentBet } });
            setupPvPGame('X'); 
          }
          break;
        case 'MATCHED':
          if (isSearching) setupPvPGame('O'); 
          break;
        case 'MOVE':
          applyRemoteMove(payload.r, payload.c, payload.player);
          break;
        case 'START_CONFIRMED':
          setGameState(prev => ({ ...prev, status: 'playing', board: payload.board }));
          break;
      }
    };

    pvpChannelRef.current.onmessage = handleMessage;
    return () => { if (pvpChannelRef.current) pvpChannelRef.current.onmessage = null; };
  }, [isSearching, myRole, gameState.currentBet, matchCode]);

  useEffect(() => {
    return () => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      if (pvpChannelRef.current) pvpChannelRef.current.close();
    };
  }, []);

  // --- Auth Handlers ---
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!usernameInput || !passwordInput || (authMode === 'register' && !confirmPasswordInput)) {
      setAuthError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (authMode === 'register' && passwordInput !== confirmPasswordInput) {
      setAuthError('Mật khẩu xác nhận không khớp');
      return;
    }

    const users: UserProfile[] = JSON.parse(localStorage.getItem('gomoku_users') || '[]');

    if (authMode === 'register') {
      if (users.find(u => u.username.toLowerCase() === usernameInput.toLowerCase())) {
        setAuthError('Tên người dùng đã tồn tại');
        return;
      }

      const newUser: UserProfile = {
        id: Date.now().toString(),
        username: usernameInput,
        password: passwordInput,
        balance: INITIAL_BALANCE,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${usernameInput}`,
        gamesPlayed: 0,
        gamesWon: 0,
        totalEarned: 0
      };

      users.push(newUser);
      localStorage.setItem('gomoku_users', JSON.stringify(users));
      login(newUser);
    } else {
      const foundUser = users.find(u => 
        u.username.toLowerCase() === usernameInput.toLowerCase() && 
        u.password === passwordInput
      );

      if (foundUser) {
        login(foundUser);
      } else {
        setAuthError('Sai tài khoản hoặc mật khẩu');
      }
    }
  };

  const login = (userData: UserProfile) => {
    setUser(userData);
    localStorage.setItem('gomoku_session', userData.id);
    setCurrentView('lobby');
    setUsernameInput('');
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleLogout = () => {
    localStorage.removeItem('gomoku_session');
    setUser(null);
    setCurrentView('auth');
    resetGame();
  };

  // --- Game Handlers ---
  const addLog = (msg: string) => {
    setHistory(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const setupPvPGame = (role: Player) => {
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    setIsSearching(false);
    setMyRole(role);
    setGameState(prev => ({ ...prev, mode: 'pvp', status: 'betting' }));
    setCurrentView('game');
    addLog(`Đã kết nối! Bạn là quân ${role}.`);
  };

  const startMatchmaking = (mode: 'random' | 'private', specificCode?: string) => {
    if (!user || user.balance < gameState.currentBet) {
      alert("Số dư không đủ!");
      return;
    }

    if (pvpChannelRef.current) pvpChannelRef.current.close();

    const code = specificCode || (mode === 'private' ? Math.floor(1000 + Math.random() * 9000).toString() : 'RANDOM');
    setMatchCode(code);
    setSearchMode(mode);
    setIsSearching(true);
    setSearchTimer(0);
    setMyRole(null);

    pvpChannelRef.current = new BroadcastChannel(`gomoku_royal_pvp_${code}`);
    
    searchIntervalRef.current = window.setInterval(() => {
      setSearchTimer(prev => prev + 1);
      pvpChannelRef.current?.postMessage({ type: 'SEEKING', payload: { bet: gameState.currentBet } });
    }, 1000);
  };

  const handleStartGame = (mode: GameMode) => {
    if (!user || user.balance < gameState.currentBet) {
      alert("Số dư không đủ!");
      return;
    }
    
    const initialBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    
    if (mode === 'pvp') {
      pvpChannelRef.current?.postMessage({ type: 'START_CONFIRMED', payload: { board: initialBoard } });
    }

    setUser(prev => prev ? ({ ...prev, balance: prev.balance - gameState.currentBet }) : null);
    setGameState(prev => ({ 
      ...prev, 
      status: 'playing', 
      mode, 
      board: initialBoard,
      winner: null,
      winningLine: null,
      currentPlayer: 'X'
    }));
  };

  const handleCellClick = async (r: number, c: number) => {
    if (gameState.status !== 'playing' || gameState.board[r][c] || isAIThinking) return;
    if (gameState.mode === 'pvp' && gameState.currentPlayer !== myRole) return;

    const currentPlayer = gameState.currentPlayer;
    if (gameState.mode === 'pvp') {
      pvpChannelRef.current?.postMessage({ type: 'MOVE', payload: { r, c, player: currentPlayer } });
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
      if (prev.mode === 'ai' && nextPlayer === 'O') triggerAIMove(newBoard);
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

  const handleWin = (player: Player, line: [number, number][], board: Player[][]) => {
    const isLocalWin = player === myRole || (gameState.mode === 'ai' && player === 'X');
    const prize = isLocalWin ? Math.floor(gameState.currentBet * WIN_MULTIPLIER) : 0;
    
    setUser(prev => {
      if (!prev) return null;
      return { 
        ...prev, 
        balance: prev.balance + (isLocalWin ? prize : 0),
        gamesPlayed: prev.gamesPlayed + 1,
        gamesWon: isLocalWin ? prev.gamesWon + 1 : prev.gamesWon,
        totalEarned: isLocalWin ? prev.totalEarned + (prize - gameState.currentBet) : prev.totalEarned
      };
    });

    addLog(isLocalWin ? `THẮNG! +${formatCurrency(prize)}` : `THUA! -${formatCurrency(gameState.currentBet)}`);
  };

  // --- Views ---

  const AuthView = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-orbitron font-black text-white italic tracking-tighter mb-2">GOMOKU<span className="text-emerald-500">ROYAL</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Đẳng Cấp Kỳ Thủ 2024</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
          <div className="flex gap-4 mb-10">
            <button onClick={() => { setAuthMode('login'); setAuthError(''); }} 
                    className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}>
              Đăng Nhập
            </button>
            <button onClick={() => { setAuthMode('register'); setAuthError(''); }} 
                    className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-white'}`}>
              Đăng Ký
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Tên Kỳ Thủ</label>
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input type="text" placeholder="Nhập username..." value={usernameInput} onChange={e => setUsernameInput(e.target.value)}
                       className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 outline-none rounded-2xl py-4 pl-14 pr-6 text-sm font-bold transition-all text-white placeholder:text-slate-700" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Mật Mã</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                       className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 outline-none rounded-2xl py-4 pl-14 pr-14 text-sm font-bold transition-all text-white placeholder:text-slate-700" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {authMode === 'register' && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Xác Nhận Mật Mã</label>
                <div className="relative group">
                  <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)}
                         className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none rounded-2xl py-4 pl-14 pr-14 text-sm font-bold transition-all text-white placeholder:text-slate-700" />
                </div>
              </div>
            )}

            {authError && <p className="text-red-500 text-[10px] font-bold text-center italic">{authError}</p>}

            <button type="submit" className={`w-full py-5 rounded-2xl font-orbitron font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 ${authMode === 'login' ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/10' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/10'}`}>
              {authMode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
              {authMode === 'login' ? 'XÁC NHẬN VÀO SÒNG' : 'TẠO TÀI KHOẢN MỚI'}
            </button>
          </form>

          <p className="text-center mt-8 text-[10px] text-slate-600 font-medium">
            Bằng cách tiếp tục, bạn đồng ý với các quy tắc đặt cược ảo của Gomoku Royal.
          </p>
        </div>
      </div>
    </div>
  );

  const LobbyView = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="text-6xl font-orbitron font-black text-white tracking-tighter italic mb-2">GOMOKU<span className="text-emerald-500">ROYAL</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-xs">Chào mừng, {user?.username}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-emerald-500/50 transition-all group cursor-pointer shadow-2xl relative overflow-hidden"
               onClick={() => { setGameState(prev => ({ ...prev, mode: 'ai', status: 'betting' })); setMyRole('X'); setCurrentView('game'); }}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Bot size={120} /></div>
            <Cpu className="text-emerald-500 mb-6 group-hover:scale-110 transition-transform" size={48} />
            <h3 className="text-2xl font-orbitron font-black text-white mb-2 uppercase">Thách Đấu AI</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Omega AI Engine v3.0.</p>
            <div className="mt-8 flex items-center text-emerald-500 font-bold text-xs gap-2">CHỌN CHẾ ĐỘ <Zap size={14} className="animate-pulse" /></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-blue-500/50 transition-all group cursor-pointer shadow-2xl relative overflow-hidden"
               onClick={() => setSearchMode('private')}>
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Users size={120} /></div>
            <Users className="text-blue-500 mb-6 group-hover:scale-110 transition-transform" size={48} />
            <h3 className="text-2xl font-orbitron font-black text-white mb-2 uppercase">Chơi Với Người</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Mã trận riêng tư.</p>
            <div className="mt-8 flex items-center text-blue-500 font-bold text-xs gap-2">CHỌN CHẾ ĐỘ <ArrowRight size={14} className="animate-pulse" /></div>
          </div>
        </div>

        {searchMode === 'private' && !isSearching && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => startMatchmaking('random')} className="bg-slate-950 border border-slate-800 hover:border-blue-500 p-6 rounded-3xl transition-all">
                   <p className="text-blue-500 font-black text-lg mb-1">Tìm Nhanh</p>
                </button>
                <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl flex flex-col gap-4">
                   <div className="flex gap-2">
                      <input type="text" maxLength={4} placeholder="MÃ" value={inputCode} onChange={e => setInputCode(e.target.value)}
                             className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-orbitron font-bold text-center w-24 outline-none" />
                      <button onClick={() => { if(inputCode.length === 4) startMatchmaking('private', inputCode); }} 
                              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-all flex-1">Kết Nối</button>
                   </div>
                </div>
             </div>
             <button onClick={() => setSearchMode(null)} className="w-full mt-6 text-[10px] text-slate-600 font-black uppercase hover:text-white">Quay Lại</button>
          </div>
        )}
      </div>
    </div>
  );

  const ProfileView = () => (
    <div className="flex-1 max-w-4xl mx-auto w-full p-4 animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="h-48 bg-gradient-to-r from-emerald-600 to-blue-600 relative">
          <button onClick={() => setCurrentView('lobby')} className="absolute top-6 left-6 bg-black/20 hover:bg-black/40 p-3 rounded-full text-white backdrop-blur-md transition-all"><ChevronLeft size={24} /></button>
          <button onClick={handleLogout} className="absolute top-6 right-6 bg-red-600 hover:bg-red-500 p-3 rounded-2xl text-white shadow-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><LogOut size={16} /> Đăng Xuất</button>
        </div>
        
        <div className="px-10 pb-10">
          <div className="flex flex-col md:flex-row items-end gap-6 -mt-16 mb-10">
            <div className="relative group">
              <img src={user?.avatar} className="w-40 h-40 rounded-[2.5rem] border-8 border-slate-900 bg-slate-800 shadow-2xl object-cover" alt="Avatar" />
            </div>
            <div className="flex-1 pb-4">
              <h2 className="text-4xl font-orbitron font-black text-white italic">{user?.username}</h2>
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
              <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Rank</p>
              <p className="text-3xl font-orbitron font-black text-white">PRO</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-inter select-none overflow-x-hidden">
      {currentView === 'auth' ? (
        <AuthView />
      ) : (
        <>
          <nav className="h-20 bg-slate-900/50 border-b border-slate-800 backdrop-blur-xl sticky top-0 z-40 px-6 flex items-center justify-between shrink-0">
            <div onClick={() => { if(gameState.status !== 'playing') setCurrentView('lobby'); }} className="cursor-pointer group flex items-center gap-2">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"><Sword className="text-slate-950" size={20} /></div>
              <span className="font-orbitron font-black text-lg tracking-tighter">GOMOKU<span className="text-emerald-500">ROYAL</span></span>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 flex items-center gap-3">
                <Coins className="text-yellow-400" size={18} />
                <span className="font-orbitron font-black text-emerald-400">{formatCurrency(user?.balance || 0)}</span>
              </div>
              <button onClick={() => setCurrentView('profile')} className="flex items-center gap-3 bg-slate-800/50 p-1.5 pr-4 rounded-2xl border border-slate-700">
                <img src={user?.avatar} className="w-8 h-8 rounded-xl object-cover" />
                <span className="text-xs font-bold hidden md:block">{user?.username}</span>
              </button>
            </div>
          </nav>

          <main className="flex-1 flex flex-col relative overflow-y-auto">
            {currentView === 'lobby' && <LobbyView />}
            {currentView === 'profile' && <ProfileView />}
            {currentView === 'game' && (
              <div className="flex-1 flex flex-col md:flex-row p-4 gap-6 animate-in zoom-in-95 duration-300">
                {/* Game logic remains same as previous but with user context */}
                <aside className="w-full md:w-80 space-y-4 shrink-0">
                   <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
                         <p className="text-[9px] text-slate-500 font-black mb-1">MỨC CƯỢC</p>
                         <p className="text-2xl font-orbitron font-black text-yellow-400">{formatCurrency(gameState.currentBet)}</p>
                      </div>
                      {gameState.status === 'playing' && (
                        <button onClick={() => { if(confirm("Đầu hàng?")) resetGame(); }} className="w-full mt-6 py-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Đầu hàng</button>
                      )}
                   </div>
                </aside>

                <div className="flex-1 flex flex-col items-center justify-center">
                   <div className="w-full max-w-2xl bg-slate-900 p-4 rounded-[3rem] shadow-2xl border border-slate-800 relative">
                      <div className="grid gap-0 mx-auto bg-slate-950 p-2 rounded-2xl border border-slate-800 relative" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`, width: 'fit-content' }}>
                        {gameState.board.map((row, r) => row.map((cell, c) => (
                          <button key={`${r}-${c}`} onClick={() => handleCellClick(r, c)} 
                                  disabled={gameState.status !== 'playing' || isAIThinking || !!cell || (gameState.mode === 'pvp' && gameState.currentPlayer !== myRole)}
                                  className={`w-[20px] h-[20px] sm:w-[32px] sm:h-[32px] md:w-[38px] md:h-[38px] border-[0.5px] border-slate-900/50 flex items-center justify-center transition-all duration-100`}>
                            {cell === 'X' && <span className="text-emerald-400 font-black text-sm sm:text-2xl animate-in zoom-in-50">X</span>}
                            {cell === 'O' && <span className="text-red-500 font-black text-sm sm:text-2xl animate-in zoom-in-50">O</span>}
                          </button>
                        )))}
                      </div>

                      {gameState.status === 'finished' && (
                        <div className="absolute inset-0 bg-slate-950/95 z-50 rounded-[3.5rem] flex items-center justify-center p-8">
                           <div className="text-center">
                             <Trophy size={64} className="mx-auto mb-4 text-yellow-400" />
                             <h2 className="text-4xl font-orbitron font-black mb-6">{gameState.winner === myRole ? 'CHIẾN THẮNG' : 'THẤT BẠI'}</h2>
                             <button onClick={() => { setCurrentView('lobby'); resetGame(); }} className="w-full bg-white text-slate-950 py-4 rounded-2xl font-black uppercase tracking-widest">Về Sảnh</button>
                           </div>
                        </div>
                      )}

                      {gameState.status === 'betting' && (
                        <div className="absolute inset-0 bg-slate-950/95 z-50 rounded-[3.5rem] flex items-center justify-center p-8">
                           <div className="text-center w-full max-w-xs">
                             <h2 className="text-2xl font-orbitron font-black text-white mb-8 italic">MỨC CƯỢC</h2>
                             <div className="grid grid-cols-2 gap-3 mb-8">
                                {[5000, 20000, 50000, 200000].map(val => (
                                  <button key={val} onClick={() => setGameState(p => ({ ...p, currentBet: val }))}
                                          className={`p-4 rounded-2xl border text-[10px] font-black tracking-widest transition-all ${gameState.currentBet === val ? 'bg-yellow-400 text-slate-950 border-yellow-400' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>{formatCurrency(val)}</button>
                                ))}
                             </div>
                             <div className="flex gap-4">
                                <button onClick={() => { setCurrentView('lobby'); resetGame(); }} className="flex-1 py-4 bg-slate-900 text-slate-500 rounded-2xl font-black text-xs uppercase">Thoát</button>
                                {(gameState.mode === 'ai' || myRole === 'X') && (
                                  <button onClick={() => handleStartGame(gameState.mode)} className="flex-[2] py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest">Bắt Đầu</button>
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

          <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-4 sticky bottom-0 z-40">
            <button onClick={() => { if(gameState.status !== 'playing') setCurrentView('lobby'); }} className={`flex flex-col items-center gap-1 ${currentView === 'lobby' ? 'text-emerald-500' : 'text-slate-500'}`}><Home size={24} /><span className="text-[9px] font-black uppercase">Trang Chủ</span></button>
            <button onClick={() => setCurrentView('profile')} className={`flex flex-col items-center gap-1 ${currentView === 'profile' ? 'text-emerald-500' : 'text-slate-500'}`}><User size={24} /><span className="text-[9px] font-black uppercase">Cá Nhân</span></button>
          </footer>
        </>
      )}
    </div>
  );

  function resetGame() {
    if (pvpChannelRef.current) pvpChannelRef.current.close();
    setGameState(prev => ({
      ...prev,
      board: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
      currentPlayer: 'X',
      winner: null,
      winningLine: null,
      status: 'betting'
    }));
    setMyRole(null);
    setMatchCode('');
    setIsAIThinking(false);
  }
};

export default App;
