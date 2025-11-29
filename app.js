document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 配置与状态 ---
    const PREFIX = 'wojak-v15-';
    const DB_KEY = 'wojak_v15_db';
    
    // TURN 服务器 (解决 4G)
    const PEER_CONFIG = {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
            ],
            sdpSemantics: 'unified-plan'
        }
    };

    // 本地数据
    let db = JSON.parse(localStorage.getItem(DB_KEY));
    if (!db || !db.profile || db.profile.id.length !== 4) {
        db = {
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random() },
            friends: [], history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    const MY_ID = db.profile.id;
    
    // UI 初始化
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    if(window.QRCode) new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 120, height: 120 });

    // --- 2. 状态变量 ---
    let activeChatId = null;
    let connections = {}; // { 4digitId: conn }
    let peer = null;
    
    // 传输队列 (Mochi 逻辑)
    const Transfer = {
        queue: [],
        isSending: false,
        chunkSize: 16 * 1024,
        maxBuffer: 64 * 1024,
        rx: {} // 接收状态 { fileId: { buffer, received, meta } }
    };

    // --- 3. 网络层 ---
    try {
        peer = new Peer(PREFIX + MY_ID, PEER_CONFIG);
        
        peer.on('open', () => {
            document.getElementById('my-status').innerText = "ONLINE";
            document.getElementById('my-status').className = "status-badge green";
            reconnectAll();
        });

        peer.on('connection', conn => handleConnection(conn));
        
        peer.on('error', err => {
            console.log(err);
            if(err.type === 'disconnected') setTimeout(()=>peer.reconnect(), 2000);
        });
    } catch(e){}

    function connectTo(id) {
        if(id === MY_ID || (connections[id] && connections[id].open)) return;
        console.log("Dialing", id);
        const conn = peer.connect(PREFIX + id, { reliable: true });
        handleConnection(conn);
    }

    function handleConnection(conn) {
        const remoteId = conn.peer.replace(PREFIX, '');
        
        conn.on('open', () => {
            connections[remoteId] = conn;
            addFriendLocal(remoteId);
            renderFriends();
            updateChatStatus(remoteId);
            // 握手
            conn.send({ type: 'handshake' });
        });

        conn.on('data', data => onDataReceived(remoteId, data)); // 核心数据处理

        conn.on('close', () => {
            delete connections[remoteId];
            renderFriends();
            updateChatStatus(remoteId);
        });
    }

    function reconnectAll() {
        db.friends.forEach(f => {
            if(!connections[f.id] || !connections[f.id].open) connectTo(f.id);
        });
    }
    setInterval(reconnectAll, 5000); // 5秒心跳重连

    // --- 4. 核心：数据接收逻辑 (Mochi 移植) ---
    function onDataReceived(senderId, data) {
        // A. 文件块
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
            // 需要配合当前的接收状态
            // 简化版：这里假设一次只传一个文件，或者通过 data channel 顺序保证
            // 为了稳健，我们查找当前正在接收的任务
            const rxId = Object.keys(Transfer.rx)[0]; // 简单取第一个
            if (!rxId) return;
            
            const state = Transfer.rx[rxId];
            const chunk = new Uint8Array(data);
            state.buffer.push(chunk);
            state.received += chunk.byteLength;
            
            // 更新进度 UI
            updateProgress(rxId, state.received, state.meta.size);

            // 接收完成
            if (state.received >= state.meta.size) {
                const blob = new Blob(state.buffer, { type: state.meta.mime });
                const url = URL.createObjectURL(blob);
                finishTransfer(rxId, url, state.meta.name, state.meta.mime);
                delete Transfer.rx[rxId];
            }
        }
        // B. 信令 JSON
        else if (data.type) {
            if (data.type === 'handshake') {
                addFriendLocal(senderId); renderFriends();
            }
            else if (data.type === 'text') {
                appendMsgDOM(data.content, false, 'text', senderId);
            }
            else if (data.type === 'sticker') {
                appendMsgDOM(data.url, false, 'sticker', senderId);
            }
            // Mochi 逻辑：文件头
            else if (data.type === 'header') {
                const fid = data.id;
                Transfer.rx[fid] = { buffer: [], received: 0, meta: data };
                appendMsgDOM({name: data.name, size: data.size, id: fid}, false, 'file_start', senderId);
                // 回复 ACK
                connections[senderId].send({ type: 'ack', id: fid });
            }
            // Mochi 逻辑：ACK
            else if (data.type === 'ack') {
                if (Transfer.pendingAckResolve) { Transfer.pendingAckResolve(); Transfer.pendingAckResolve = null; }
            }
        }
    }

    // --- 5. 核心：发送逻辑 (Mochi 移植) ---
    window.enqueueFile = (file) => {
        if(!activeChatId || !connections[activeChatId]) return alert("Offline");
        const id = Date.now() + Math.random().toString(16).slice(2);
        // 本地显示气泡
        appendMsgDOM({name: file.name, size: file.size, id: id}, true, 'file_start', activeChatId);
        
        Transfer.queue.push({ file: file, id: id, targetId: activeChatId });
        processQueue();
    };

    async function processQueue() {
        if (Transfer.isSending || Transfer.queue.length === 0) return;
        Transfer.isSending = true;
        const job = Transfer.queue.shift();
        const conn = connections[job.targetId];

        if(!conn || !conn.open) {
            alert("Connection lost");
            Transfer.isSending = false; return;
        }

        // 1. 发送 Header
        conn.send({ type: 'header', name: job.file.name, size: job.file.size, mime: job.file.type, id: job.id });

        // 2. 等待 ACK
        try {
            await new Promise((resolve, reject) => {
                Transfer.pendingAckResolve = resolve;
                setTimeout(() => reject("Timeout"), 5000);
            });
        } catch(e) {
            console.log("Ack Timeout");
            Transfer.isSending = false; processQueue(); return;
        }

        // 3. 发送 Chunks
        let offset = 0;
        while (offset < job.file.size) {
            if (conn.dataChannel.bufferedAmount > Transfer.maxBuffer) {
                await new Promise(r => setTimeout(r, 20)); continue;
            }
            const chunk = job.file.slice(offset, offset + Transfer.chunkSize);
            const buffer = await chunk.arrayBuffer();
            conn.send(new Uint8Array(buffer));
            offset += Transfer.chunkSize;
            
            // 更新本地进度
            updateProgress(job.id, offset, job.file.size);
        }

        // 4. 完成
        const url = URL.createObjectURL(job.file);
        finishTransfer(job.id, url, job.file.name, job.file.type);
        
        Transfer.isSending = false;
        processQueue();
    }

    // --- 6. UI 辅助函数 ---
    function updateProgress(id, current, total) {
        const bar = document.getElementById(`prog-${id}`);
        if(bar) bar.style.width = Math.floor((current/total)*100) + '%';
    }

    function finishTransfer(id, url, name, mime) {
        const container = document.getElementById(`file-content-${id}`);
        if(!container) return;
        
        if (mime.startsWith('image/')) {
            container.innerHTML = `<img src="${url}" class="img-preview" onclick="window.open('${url}')">`;
        } else {
            container.innerHTML = `<a href="${url}" download="${name}" style="color:blue; font-weight:bold; display:block; margin-top:5px;">📥 DOWNLOAD</a>`;
        }
        updateProgress(id, 1, 1); // 满条
    }

    function appendMsgDOM(content, isSelf, type, chatId) {
        // 如果不是当前聊天对象，就不显示（实际应用应该有未读消息逻辑）
        if (activeChatId !== chatId) return;

        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        
        if (type === 'text') {
            div.innerHTML = `<div class="bubble">${content}</div>`;
        } else if (type === 'sticker') {
            div.innerHTML = `<img src="${content}" class="sticker-img">`;
        } else if (type === 'file_start') {
            // content 是对象 {name, size, id}
            div.innerHTML = `
                <div class="bubble file-card">
                    <div>📄 ${content.name}</div>
                    <div class="progress-bar-container"><div class="progress-fill" id="prog-${content.id}"></div></div>
                    <div id="file-content-${content.id}"></div>
                </div>
            `;
        }
        
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // --- 7. 常规 UI 逻辑 ---
    function addFriendLocal(id) {
        if(!id || id.length!==4) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const isOnline = connections[f.id] && connections[f.id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${f.id}</div><div style="font-size:12px; color:${isOnline?'green':'red'}">${isOnline?'ONLINE':'OFFLINE'}</div></div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        document.getElementById('messages-container').innerHTML = ''; // Demo: 清空
        updateChatStatus(id);
    }

    function updateChatStatus(id) {
        if(activeChatId !== id) return;
        const isOnline = connections[id] && connections[id].open;
        document.getElementById('chat-status-dot').className = isOnline ? 'status-square online' : 'status-square';
    }

    // 事件绑定
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    document.getElementById('chat-send-btn').onclick = () => {
        const val = document.getElementById('chat-input').value;
        if(val && activeChatId && connections[activeChatId]) {
            connections[activeChatId].send({type:'text', content:val});
            appendMsgDOM(val, true, 'text', activeChatId);
            document.getElementById('chat-input').value = '';
        }
    };

    document.getElementById('chat-file-input').onchange = (e) => {
        if(e.target.files.length > 0) window.enqueueFile(e.target.files[0]);
    };

    // 模态框
    window.hideAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                hideAllModals(); document.getElementById('scan-sound').play().catch(()=>{});
                if(txt.length===4) { addFriendLocal(txt); connectTo(txt); openChat(txt); }
            });
        }, 300);
    };
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length===4) { hideAllModals(); addFriendLocal(id); connectTo(id); openChat(id); }
    };

    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });

    // Stickers
    const sGrid = document.getElementById('sticker-grid');
    ['crying','angry','happy','clown'].forEach(s => {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${s}`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-img'; img.style.width='60px';
        img.onclick = () => {
            if(activeChatId && connections[activeChatId]) {
                connections[activeChatId].send({type:'sticker', url:url});
                appendMsgDOM(url, true, 'sticker', activeChatId);
                document.getElementById('sticker-panel').classList.add('hidden');
            }
        }
        sGrid.appendChild(img);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
