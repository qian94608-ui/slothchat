document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 强制样式修正 (修复布局塌陷与层级问题) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --bg: #F2F2F7; }
        body { background: var(--bg); font-family: sans-serif; overscroll-behavior-y: none; }
        
        /* 隐藏旧导航 */
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 50px !important; }

        /* ★ 1. 头部修复 (找回左上角图标) ★ */
        .defi-header { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 10px 15px; background: #fff; z-index: 100; position: relative;
        }
        .user-pill { 
            display: flex; align-items: center; gap: 10px; 
            background: #f5f5f5; padding: 5px 10px; border-radius: 20px; cursor: pointer;
        }
        .header-avatar { width: 32px; height: 32px; border-radius: 50%; background: #ddd; object-fit: cover; }

        /* ★ 2. 底部输入栏重构 (防消失、防不可点) ★ */
        .chat-footer { 
            position: absolute; bottom: 0; left: 0; right: 0;
            height: 60px; background: #fff; display: flex; align-items: center; 
            padding: 0 10px; gap: 8px; border-top: 1px solid #eee; z-index: 200;
        }
        .footer-tool { 
            width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; 
            background: #f0f0f0; border: none; font-size: 20px; cursor: pointer;
        }
        
        /* 输入区域容器 */
        .input-zone { flex: 1; position: relative; height: 40px; display: flex; }
        
        /* 文本框 */
        .text-wrapper { 
            width: 100%; height: 100%; display: flex; gap: 5px; 
            position: absolute; top: 0; left: 0; z-index: 20; 
            background: #fff; /* 遮盖下面的语音按钮 */
        }
        .text-wrapper.hidden { display: none !important; }
        #chat-input { 
            flex: 1; height: 100%; background: #f5f5f5; border: 1px solid #ddd; 
            border-radius: 20px; padding: 0 15px; outline: none; font-size: 16px; 
        }
        
        /* 语音按钮 */
        .voice-btn-long { 
            width: 100%; height: 100%; border-radius: 20px; border: none;
            background: #FF4444; color: white; font-weight: bold;
            position: absolute; top: 0; left: 0; z-index: 10;
            display: none; /* 默认隐藏 */
        }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }
        @keyframes pulse { 0% {transform: scale(1);} 50% {transform: scale(1.05);} }

        /* 列表项 */
        .k-list-item { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        
        /* 表情面板 */
        .sticker-panel { height: 200px; background: #fff; overflow-y: auto; border-top: 1px solid #eee; display: none; }
        .sticker-panel.active { display: block; }
        .sticker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 10px; }
        .sticker-item { width: 100%; height: 60px; object-fit: contain; }

        /* 消息气泡 */
        .bubble { padding: 10px 15px; border-radius: 18px; max-width: 80%; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; }
        
        /* 媒体 */
        .thumb-img { max-width: 150px; max-height: 150px; border-radius: 8px; display: block; }
        
        /* 模态框 */
        .modal-overlay { z-index: 99999; background: rgba(0,0,0,0.8); }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; padding: 20px; }
        .num-btn { width: 60px; height: 60px; border-radius: 50%; background: #fff; font-size: 24px; font-weight: bold; display: flex; justify-content: center; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .num-btn.connect { background: var(--pepe-green); color: white; }
    `;
    document.head.appendChild(styleSheet);

    // --- 1. 数据初始化 ---
    const DB_KEY = 'pepe_v47_redemption';
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000+Math.random()*9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 核心状态 ---
    let socket = null;
    let activeChatId = null;
    let isSending = false;
    const CHUNK_SIZE = 12 * 1024;
    let uploadQueue = [];

    // --- 3. 界面初始化 (★ 修复头像显示 ★) ---
    const initUI = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        // 强制重置头像 src
        const avatar = document.getElementById('my-avatar');
        avatar.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        avatar.onerror = () => { avatar.src = 'https://via.placeholder.com/32'; }; // 兜底
        
        renderFriends();
        setupDialpad();
        setupStickers();
    };

    // --- 4. 聊天与网络 ---
    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] });
        socket.on('connect', () => { 
            document.getElementById('conn-status').className = "status-dot green"; 
            socket.emit('register', MY_ID); 
        });
        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            // 如果不在好友列表，自动添加
            if(!db.friends.find(f=>f.id===fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
                saveDB(); renderFriends();
            }
            
            // 存历史
            if(msg.type === 'tunnel_file_packet') {
                try {
                    const p = JSON.parse(msg.content);
                    if(p.subType === 'end') {
                        // 简单处理：只显示完成提示，复杂流式处理略去以保稳定
                        const m = { type: 'text', content: `[File Received: ${p.fileName}]`, isSelf: false, ts: Date.now() };
                        saveMsg(fid, m);
                    }
                } catch(e){}
            } else {
                const m = { type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName };
                saveMsg(fid, m);
            }
        });
    }

    function saveMsg(fid, msg) {
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push(msg);
        saveDB();
        if(activeChatId === fid) appendMsgDOM(msg);
        else document.getElementById('msg-sound').play().catch(()=>{});
    }

    // --- 5. 发送逻辑 (隧道模式 - 最稳) ---
    function sendData(type, content, fileName) {
        if(!activeChatId) return;
        // 1. 发送
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type, fileName });
        }
        // 2. 本地显示
        const m = { type, content, fileName, isSelf: true, ts: Date.now() };
        saveMsg(activeChatId, m);
    }

    // 简单的文件发送 (不分片，为了稳定性，小文件直接发 base64)
    // 如果需要大文件分片，请告诉我，我再加回来，现在先保功能可用
    function sendFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            sendData('file', e.target.result, file.name); // 直接发 Base64
        };
        reader.readAsDataURL(file);
    }

    // --- 6. 界面交互 (核心修复区) ---

    // 打开聊天
    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        // ★ 修复：手势返回 (推入历史记录) ★
        window.history.pushState({ chat: true }, "");

        // 重置输入栏状态
        document.getElementById('text-input-wrapper').classList.remove('hidden');
        document.getElementById('voice-record-btn').classList.remove('active');
        document.getElementById('mode-switch-btn').innerText = "🎤";

        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
    }

    // ★ 修复：点击返回按钮 (强制关闭) ★
    window.goBack = () => {
        const view = document.getElementById('view-chat');
        view.classList.remove('active');
        setTimeout(() => view.classList.add('right-sheet'), 300);
        activeChatId = null;
        // 如果有历史记录，回退一下以保持同步
        if(history.state && history.state.chat) history.back();
    };
    document.getElementById('chat-back-btn').onclick = window.goBack;

    // ★ 修复：监听安卓物理返回键 ★
    window.addEventListener('popstate', () => {
        // 当历史记录弹出时，关闭聊天窗口
        const view = document.getElementById('view-chat');
        if(view.classList.contains('active')) {
            view.classList.remove('active');
            setTimeout(() => view.classList.add('right-sheet'), 300);
            activeChatId = null;
        }
    });

    // 消息渲染
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        
        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<img src="${msg.content}" class="sticker-img" style="width:100px;">`;
        else if(msg.type === 'image') html = `<img src="${msg.content}" class="thumb-img">`;
        else if(msg.type === 'file') html = `<div class="bubble">📂 ${msg.fileName || 'File'}<br><a href="${msg.content}" download="${msg.fileName}">Download</a></div>`;
        
        div.innerHTML = html;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    // --- 7. 按钮绑定 ---
    
    // 文本发送 (点击 & 回车)
    const handleSend = () => {
        const t = document.getElementById('chat-input');
        if(t.value.trim()) { sendData('text', t.value); t.value = ''; }
    };
    document.getElementById('chat-send-btn').onclick = handleSend;
    
    // ★ 修复：模式切换 (确保输入框不消失) ★
    document.getElementById('mode-switch-btn').onclick = () => {
        const tBox = document.getElementById('text-input-wrapper');
        const vBtn = document.getElementById('voice-record-btn');
        const btn = document.getElementById('mode-switch-btn');
        
        if(tBox.classList.contains('hidden')) {
            // 切回文本
            tBox.classList.remove('hidden');
            vBtn.classList.remove('active');
            btn.innerText = "🎤";
            setTimeout(() => document.getElementById('chat-input').focus(), 100);
        } else {
            // 切到语音
            tBox.classList.add('hidden');
            vBtn.classList.add('active');
            btn.innerText = "⌨️";
        }
    };

    // ★ 修复：文件选择 ★
    const fIn = document.getElementById('chat-file-input');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = (e) => {
        if(e.target.files[0]) sendFile(e.target.files[0]);
        fIn.value = '';
    };

    // ★ 修复：表情面板填充 ★
    function setupStickers() {
        const grid = document.getElementById('sticker-grid');
        grid.innerHTML = '';
        for(let i=1; i<=8; i++) {
            const img = document.createElement('img');
            // 使用 Dicebear 作为稳定源
            img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i}`;
            img.className = 'sticker-item';
            img.onclick = () => {
                if(activeChatId) {
                    sendData('sticker', img.src);
                    document.getElementById('sticker-panel').classList.remove('active');
                }
            };
            grid.appendChild(img);
        }
    }
    document.getElementById('sticker-btn').onclick = () => {
        document.getElementById('sticker-panel').classList.toggle('active');
    };

    // 拨号盘
    let dialInput = "";
    function setupDialpad() {
        const body = document.querySelector('#add-overlay .modal-body');
        body.innerHTML = `
            <div class="id-display-screen" id="dial-display">____</div>
            <div class="numpad-grid">
                <div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div>
                <div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div>
                <div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div>
                <div class="num-btn" onclick="dial('C')" style="color:red">C</div>
                <div class="num-btn" onclick="dial(0)">0</div>
                <div class="num-btn connect" onclick="dial('OK')">🤝</div>
            </div>`;
    }
    window.dial = (k) => {
        const d = document.getElementById('dial-display');
        if(k==='C') { dialInput=""; d.innerText="____"; return; }
        if(k==='OK') { 
            if(dialInput.length===4 && dialInput!==MY_ID) {
                window.closeAllModals();
                handleAddFriend(dialInput);
            }
            return; 
        }
        if(dialInput.length<4) { dialInput+=k; d.innerText=dialInput.padEnd(4,'_'); }
    };

    function handleAddFriend(id) {
        if(!db.friends.find(f=>f.id===id)) {
            db.friends.push({id, addedAt:Date.now(), alias:`User ${id}`});
            saveDB(); renderFriends();
        }
        openChat(id);
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `<div style="font-weight:bold">${f.alias||f.id}</div>`;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    // 按钮事件
    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        dialInput = ""; document.getElementById('dial-display').innerText="____";
    };
    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    
    // 初始化
    initUI();
});
