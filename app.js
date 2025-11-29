document.addEventListener('DOMContentLoaded', () => {

    // --- 0. 日志与工具 ---
    const debugEl = document.getElementById('debug-console');
    function log(msg) {
        if (!debugEl) return;
        const line = document.createElement('div');
        line.innerText = `> ${msg}`;
        debugEl.appendChild(line);
        debugEl.scrollTop = debugEl.scrollHeight;
        console.log(msg);
    }

    // --- 1. 配置 (STUN Servers) ---
    // 关键修复：显式定义 STUN 服务器，帮助穿透 NAT
    const PEER_CONFIG = {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ]
        }
    };

    const PREFIX = 'wojak-v12-'; // 升级版本号隔离
    const DB_KEY = 'wojak_v12_db';

    // --- 2. 数据初始化 ---
    let db = JSON.parse(localStorage.getItem(DB_KEY));
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

    // UI Render
    document.getElementById('my-id-display').innerText = MY_ID_SHORT;
    document.getElementById('card-id-text').innerText = MY_ID_SHORT;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    if(window.QRCode) new QRCode(document.getElementById("qrcode"), { text: MY_ID_SHORT, width: 120, height: 120 });

    log(`Init ID: ${MY_ID_SHORT}`);

    // --- 3. 网络状态管理 ---
    let activeChatId = null;
    let connections = {}; 
    let connectingLocks = {}; // 关键：防止重复连接锁
    let peer = null;

    try {
        peer = new Peer(MY_ID_FULL, PEER_CONFIG);

        peer.on('open', (id) => {
            log(`Server Connected.`);
            document.getElementById('my-status').innerText = "ONLINE";
            document.getElementById('my-status').className = "status-badge green";
            reconnectAll();
        });

        peer.on('connection', (conn) => {
            handleConnection(conn, 'incoming');
        });

        peer.on('error', (err) => {
            // 忽略非致命错误
            if (err.type === 'peer-unavailable') {
                // 对方不在线，这是正常的，等待下次重连
            } else if (err.type === 'disconnected') {
                log("Disconnected. Reconnecting...");
                peer.reconnect();
            } else {
                log(`Err: ${err.type}`);
            }
        });
        
        peer.on('disconnected', () => {
            document.getElementById('my-status').innerText = "DISCONNECTED";
            document.getElementById('my-status').className = "status-badge red";
            // 尝试重连 PeerServer
            setTimeout(() => { if(peer && !peer.destroyed) peer.reconnect(); }, 2000);
        });

    } catch(e) { log("PeerJS Crash"); }

    // 主动连接逻辑
    function connectTo(shortId) {
        if (shortId === MY_ID_SHORT) return;
        
        // 1. 检查是否已经连接
        if (connections[shortId] && connections[shortId].open) return;
        
        // 2. 检查是否正在连接中 (防止 Negotiation failed)
        if (connectingLocks[shortId]) return;

        const fullId = PREFIX + shortId;
        log(`Dialing ${shortId}...`);
        
        // 加锁
        connectingLocks[shortId] = true;
        
        // 5秒后自动解锁，防止死锁
        setTimeout(() => { connectingLocks[shortId] = false; }, 5000);

        const conn = peer.connect(fullId, {
            reliable: true,
            serialization: 'json'
        });
        handleConnection(conn, 'outgoing');
    }

    function handleConnection(conn, type) {
        const remoteShortId = conn.peer.replace(PREFIX, '');

        conn.on('open', () => {
            log(`Link OK: ${remoteShortId} (${type})`);
            
            // 连接成功，移除锁
            connectingLocks[remoteShortId] = false;
            connections[remoteShortId] = conn;

            // 确保好友在列表
            addFriendLocal(remoteShortId);
            
            // ★ 延迟握手：等待 WebRTC 通道稳定 ★
            setTimeout(() => {
                conn.send({ type: 'SYN', from: MY_ID_SHORT });
            }, 500);

            renderFriends();
            updateChatStatus(remoteShortId);
        });

        conn.on('data', (d) => {
            if (d.type === 'SYN') {
                log(`Rx SYN < ${d.from}`);
                addFriendLocal(d.from); 
                renderFriends();
                // 回复 ACK
                conn.send({ type: 'ACK', from: MY_ID_SHORT });
            } 
            else if (d.type === 'ACK') {
                log(`Rx ACK < ${d.from}. Ready.`);
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
            log(`Link Closed: ${remoteShortId}`);
            delete connections[remoteShortId];
            connectingLocks[remoteShortId] = false;
            renderFriends();
            updateChatStatus(remoteShortId);
        });

        conn.on('error', (err) => {
            log(`ConnErr ${remoteShortId}: ${err}`);
            connectingLocks[remoteShortId] = false;
        });
    }

    // 慢速重连 (改为5秒，给协商留出时间)
    function reconnectAll() {
        db.friends.forEach(f => {
            const conn = connections[f.id];
            if (!conn || !conn.open) {
                connectTo(f.id);
            }
        });
    }
    setInterval(reconnectAll, 5000);


    // --- 4. 业务逻辑 (好友/消息) ---
    function addFriendLocal(id) {
        if (!id || id.length !== 4) return;
        if (!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
            log(`Added friend ${id}`);
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        
        db.friends.forEach(f => {
            const isOnline = connections[f.id] && connections[f.id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            
            const statusColor = isOnline ? '#00FF00' : '#FF0000';
            const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
            
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${f.id}</div>
                    <div style="font-size:12px; font-weight:bold; color:${statusColor}">${statusText}</div>
                </div>
            `;
            
            // 长按删除
            div.oncontextmenu = (e) => {
                e.preventDefault();
                if(confirm(`Delete ${f.id}?`)) {
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

    function handleIncomingMsg(id, content, type) {
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

    // --- 5. UI 事件绑定 ---
    document.getElementById('chat-send-btn').onclick = sendText;
    document.getElementById('chat-input').onkeypress = (e) => { if(e.key==='Enter') sendText(); };
    
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // 模态框逻辑
    const hideAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    }
    window.hideAllModals = hideAllModals;

    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            hideAllModals();
            addFriendLocal(id);
            connectTo(id); // 立即尝试连接
            openChat(id);
        } else { alert("ID must be 4 digits"); }
    };

    document.getElementById('scan-btn').onclick = () => {
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            alert("HTTPS Required for Camera"); return;
        }
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

    // Nav
    const tabs = document.querySelectorAll('.nav-btn');
    tabs.forEach(btn => {
        btn.onclick = () => {
            tabs.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });

    // Stickers
    const stickerGrid = document.getElementById('sticker-grid');
    if(stickerGrid) {
        ['crying', 'angry', 'happy', 'clown', 'chad'].forEach(s => {
            const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${s}`;
            const img = document.createElement('img');
            img.src = url; img.className = 'sticker-img'; img.style.width='60px';
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
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
