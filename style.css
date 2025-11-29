document.addEventListener('DOMContentLoaded', () => {

    // --- 0. 调试日志系统 ---
    function log(msg) {
        const consoleEl = document.getElementById('debug-console');
        const line = document.createElement('div');
        line.innerText = `> ${msg}`;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
        console.log(msg);
    }

    // --- 1. ID 系统 (固定4位) ---
    const PREFIX = 'wojak-v11-'; // 版本隔离
    const DB_KEY = 'wojak_v11_db';

    let db = JSON.parse(localStorage.getItem(DB_KEY));
    // 强制重置不合规ID
    if (!db || !db.profile || db.profile.id.length !== 4) {
        db = {
            profile: { 
                id: String(Math.floor(1000 + Math.random() * 9000)), 
                avatarSeed: Math.random() 
            },
            friends: [],
            history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    const MY_ID_SHORT = db.profile.id;
    const MY_ID_FULL = PREFIX + MY_ID_SHORT;

    // UI 显示
    document.getElementById('my-id-display').innerText = MY_ID_SHORT;
    document.getElementById('card-id-text').innerText = MY_ID_SHORT;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    if(window.QRCode) new QRCode(document.getElementById("qrcode"), { text: MY_ID_SHORT, width: 120, height: 120 });

    log(`Init. My ID: ${MY_ID_SHORT}`);


    // --- 2. 状态管理 ---
    let activeChatId = null;
    let connections = {}; // { shortId: conn }
    let peer = null;


    // --- 3. 网络层 (PeerJS) ---
    try {
        peer = new Peer(MY_ID_FULL); // 使用长ID注册

        peer.on('open', (id) => {
            log(`Connected to Server.`);
            document.getElementById('my-status').innerText = "ONLINE";
            document.getElementById('my-status').className = "status-badge green";
            reconnectAll();
        });

        peer.on('connection', (conn) => {
            handleConnection(conn);
        });

        peer.on('error', (err) => {
            log(`Err: ${err.type}`);
        });

    } catch(e) { log("Peer Init Failed"); }

    // 主动连接函数
    function connectTo(targetShortId) {
        if(targetShortId === MY_ID_SHORT) return;
        
        // 检查是否已经连接
        if(connections[targetShortId] && connections[targetShortId].open) return;

        const targetFull = PREFIX + targetShortId;
        log(`Connecting to ${targetShortId}...`);
        
        const conn = peer.connect(targetFull);
        handleConnection(conn);
    }

    // 连接处理逻辑 (核心握手)
    function handleConnection(conn) {
        // 从长ID中解析出短ID
        const remoteShortId = conn.peer.replace(PREFIX, '');

        conn.on('open', () => {
            log(`Link Opened: ${remoteShortId}`);
            connections[remoteShortId] = conn;

            // ★ 步骤 1: 发送握手信号 (SYN) ★
            conn.send({ type: 'SYN', from: MY_ID_SHORT });
            
            // 无论我是主动还是被动，只要连通了，确保对方在好友列表
            addFriendLocal(remoteShortId);
            renderFriends();
            updateChatStatus(remoteShortId);
        });

        conn.on('data', (d) => {
            if (d.type === 'SYN') {
                log(`Got SYN from ${d.from}`);
                addFriendLocal(d.from); // 被动方自动添加
                renderFriends();
                // ★ 步骤 2: 回复确认 (ACK) ★
                conn.send({ type: 'ACK', from: MY_ID_SHORT });
            } 
            else if (d.type === 'ACK') {
                log(`Got ACK from ${d.from}. Connected!`);
                // 握手完成，连接稳定
                renderFriends();
                updateChatStatus(d.from);
            }
            else if (d.type === 'text') {
                handleIncomingMsg(remoteShortId, d.content, 'text');
            }
            else if (d.type === 'sticker') {
                handleIncomingMsg(remoteShortId, d.url, 'sticker');
            }
        });

        conn.on('close', () => {
            log(`Closed: ${remoteShortId}`);
            delete connections[remoteShortId];
            renderFriends();
            updateChatStatus(remoteShortId);
        });
        
        conn.on('error', (e) => log(`Conn Err: ${e}`));
    }

    // 自动重连机制
    function reconnectAll() {
        db.friends.forEach(f => {
            const conn = connections[f.id];
            if(!conn || !conn.open) {
                connectTo(f.id);
            }
        });
    }
    setInterval(reconnectAll, 3000); // 每3秒尝试重连掉线好友


    // --- 4. 业务逻辑 ---
    function addFriendLocal(id) {
        if(!id || id.length !== 4) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
            log(`Friend ${id} added to DB`);
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const isOnline = connections[f.id] && connections[f.id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            // 如果在线，显示绿色
            const statusColor = isOnline ? '#00FF00' : '#FF0000';
            const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
            
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${f.id}</div>
                    <div style="font-size:12px; font-weight:bold; color:${statusColor}">${statusText}</div>
                </div>
            `;
            
            // 左滑删除模拟 (简化为长按删除，防止滑动冲突)
            div.oncontextmenu = (e) => {
                e.preventDefault();
                if(confirm("Delete friend?")) {
                    db.friends = db.friends.filter(x => x.id !== f.id);
                    saveDB();
                    renderFriends();
                }
            };
            
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        
        // 渲染历史
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg.content, msg.isSelf, msg.type));
        
        updateChatStatus(id);
    }

    function updateChatStatus(id) {
        if(activeChatId !== id) return;
        const isOnline = connections[id] && connections[id].open;
        const dot = document.getElementById('chat-status-dot');
        dot.className = isOnline ? 'status-square online' : 'status-square';
    }

    // 消息处理
    function handleIncomingMsg(id, content, type) {
        // 存入历史
        if(!db.history[id]) db.history[id] = [];
        db.history[id].push({ type, content, isSelf: false, ts: Date.now() });
        saveDB();

        if(activeChatId === id) {
            appendMsgDOM(content, false, type);
        } else {
            document.getElementById('msg-sound').play().catch(()=>{});
            log(`Msg from ${id}`);
        }
    }

    function sendText() {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if(txt && activeChatId) {
            const conn = connections[activeChatId];
            if(conn && conn.open) {
                conn.send({ type: 'text', content: txt });
                
                // 本地保存
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push({ type:'text', content:txt, isSelf:true, ts: Date.now() });
                saveDB();
                
                appendMsgDOM(txt, true, 'text');
                input.value = '';
            } else {
                alert("OFFLINE. Cannot send.");
            }
        }
    }

    function appendMsgDOM(content, isSelf, type) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        if(type === 'text') div.innerHTML = `<div class="bubble">${content}</div>`;
        else if(type === 'sticker') div.innerHTML = `<img src="${content}" class="sticker-img">`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // --- 5. UI 交互 ---
    document.getElementById('chat-send-btn').onclick = sendText;
    
    // 返回按钮
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // 模态框逻辑
    window.hideAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };

    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
    };

    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            hideAllModals();
            addFriendLocal(id);
            connectTo(id);
            openChat(id);
        } else { alert("ID must be 4 digits"); }
    };

    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, (txt)=>{
                hideAllModals();
                document.getElementById('scan-sound').play().catch(()=>{});
                if(txt.length === 4) {
                    addFriendLocal(txt);
                    connectTo(txt);
                    openChat(txt);
                }
            });
        }, 300);
    };

    // 导航
    const tabs = document.querySelectorAll('.nav-btn');
    tabs.forEach(btn => {
        btn.onclick = () => {
            tabs.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });

    // 表情包
    const stickerSeeds = ['crying', 'angry', 'happy', 'clown', 'chad'];
    const stickerGrid = document.getElementById('sticker-grid');
    stickerSeeds.forEach(s => {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${s}`;
        const img = document.createElement('img');
        img.src = url;
        img.className = 'sticker-img';
        img.style.width='60px';
        img.onclick = () => {
            if(activeChatId && connections[activeChatId] && connections[activeChatId].open) {
                connections[activeChatId].send({type:'sticker', url:url});
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push({ type:'sticker', content:url, isSelf:true, ts: Date.now() });
                saveDB();
                appendMsgDOM(url, true, 'sticker');
                document.getElementById('sticker-panel').classList.add('hidden');
            }
        };
        stickerGrid.appendChild(img);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // 启动
    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
