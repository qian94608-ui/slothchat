document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --glass-bg: rgba(255, 255, 255, 0.95); --primary: #59BC10; --primary-dark: #46960C; --danger: #FF3B30; --shadow-sm: 0 2px 8px rgba(0,0,0,0.08); }
        body { background: #F2F2F7; font-family: -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; }
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 30px !important; }
        .k-list-item { background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px; box-shadow: var(--shadow-sm); transition: transform 0.1s; position: relative; }
        .k-list-item:active { transform: scale(0.98); background: #f2f2f2; }
        
        /* 编辑图标 (列表页) */
        .list-edit-btn {
            padding: 8px; color: #999; font-size: 16px; cursor: pointer; z-index: 10;
        }
        .list-edit-btn:active { color: var(--primary); }

        /* 拨号盘 */
        .numpad-container { display: flex; flex-direction: column; align-items: center; padding: 10px; }
        .id-display-screen { font-size: 36px; font-weight: 800; letter-spacing: 6px; color: var(--primary); margin-bottom: 20px; border-bottom: 2px solid #eee; width: 80%; text-align: center; height: 50px; line-height: 50px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 100%; max-width: 260px; }
        .num-btn { width: 65px; height: 65px; border-radius: 50%; background: #fff; box-shadow: 0 3px 0 #eee; border: 1px solid #ddd; font-size: 24px; font-weight: bold; color: #333; display: flex; justify-content: center; align-items: center; cursor: pointer; user-select: none; }
        .num-btn:active { transform: translateY(3px); box-shadow: none; background: #eee; }
        .num-btn.clear { color: var(--danger); font-size: 18px; }
        .num-btn.connect { background: var(--primary); color: #fff; border: none; box-shadow: 0 4px 10px rgba(89, 188, 16, 0.3); font-size: 30px; }
        .num-btn.connect:active { background: var(--primary-dark); }

        /* 气泡与媒体 */
        .bubble { border: none !important; border-radius: 18px !important; padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); max-width: 80%; }
        .msg-row.self .bubble { background: var(--primary); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; }
        .thumb-box { position: relative; display: inline-block; max-width: 200px; border-radius: 12px; overflow: hidden; background: #000; }
        .thumb-img { max-width: 100%; height: auto; display: block; object-fit: contain; }
        video.thumb-img { object-fit: cover; max-height: 200px; }
        .sticker-img { width: 80px !important; height: 80px !important; object-fit: contain !important; }
        
        /* 语音 */
        .voice-bubble { display: flex; align-items: center; gap: 8px; min-width: 100px; }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 16px; }
        .wave-bar { width: 3px; height: 30%; background: #ccc; border-radius: 2px; }
        .voice-bubble.playing .wave-bar { animation: wave 0.5s infinite ease-in-out; background: #fff !important; }
        .voice-bubble.other.playing .wave-bar { background: var(--primary) !important; }
        @keyframes wave { 0%,100%{height:30%;} 50%{height:100%;} }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        
        .audio-player { display: flex; align-items: center; gap: 8px; min-width: 140px; }
        .audio-btn { width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(255,255,255,0.3); color: inherit; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 12px; }
        .msg-row.other .audio-btn { background: #eee; color: #333; }

        .cancel-btn { position: absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:#fff; width:22px; height:22px; border-radius:50%; text-align:center; line-height:22px; font-size:12px; cursor:pointer; z-index:10; }
        .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.6) !important; backdrop-filter: blur(5px); }
        .modal-header { background: var(--primary) !important; color: #fff; border:none; }
        .close-x { color: #fff !important; background: rgba(0,0,0,0.2) !important; }
        .modal-box { border-radius: 20px; overflow: hidden; border: none; }
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
    `;
    document.head.appendChild(styleSheet);

    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95); z-index:99999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:100000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:44px; height:44px; border-radius:50%; font-size:24px;">✕</button>
        <a id="preview-download-btn" href="#" download style="position:absolute; top:40px; right:80px; z-index:100000; background:var(--primary); color:#fff; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; text-decoration:none;">⬇</a>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 数据与全局 ---
    const DB_KEY = 'pepe_v41_lan_final';
    const CHUNK_SIZE = 12 * 1024;
    let db;
    
    let socket = null;
    let activeChatId = null;
    let activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};
    let uploadQueue = [];
    let globalAudio = null;
    
    // ★ WebRTC P2P (局域网直连) 状态 ★
    let peerConnection = null;
    let dataChannel = null;
    let isP2PReady = false;

    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 核心 UI 函数 ---

    // 渲染好友 (★ 修复：列表页加笔形图标 ★)
    const renderFriends = () => {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            
            let nameHtml = `
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>
                    <div class="list-edit-btn" onclick="event.stopPropagation(); window.editContactAlias('${f.id}')">✎</div>
                </div>`;
                
            if(f.unread) {
                nameHtml = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>
                    <div class="marquee-box"><div class="marquee-text">📢 MESSAGE COMING...</div></div>
                </div>`;
            }
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px; height:45px; border-radius:50%; background:#eee;">
                    <div style="flex:1;">${nameHtml}<div style="font-size:12px; color:#888;">${f.unread ? '<span style="color:red">● New Message</span>' : 'Tap to chat'}</div></div>
                </div>
            `;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    };

    // ★ 新增：列表页修改昵称 ★
    window.editContactAlias = (fid) => {
        const f = db.friends.find(x => x.id === fid);
        if(f) {
            const n = prompt("Set Alias for " + fid, f.alias || fid);
            if(n) { f.alias = n; saveDB(); renderFriends(); }
        }
    };

    const appendMsgDOM = (msg, isSelf) => {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); 
        div.className = `msg-row ${isSelf?'self':'other'}`;
        const uid = Date.now() + Math.random().toString().substr(2,5); 
        let html = '';

        if(msg.type==='text') html=`<div class="bubble">${msg.content}</div>`;
        else if(msg.type==='sticker') html=`<div style="padding:5px;"><img src="${msg.content}" class="sticker-img"></div>`;
        else if(msg.type==='voice') {
            html=`<div class="bubble audio-player">
                    <span>🎤</span>
                    <button class="audio-btn" onclick="handleAudio('play', '${msg.content}')">▶</button>
                    <button class="audio-btn" onclick="handleAudio('pause', '${msg.content}')">⏸</button>
                    <button class="audio-btn" onclick="handleAudio('stop', '${msg.content}')">⏹</button>
                  </div>`;
        } 
        else if(msg.type==='image') html=`<div class="bubble" style="padding:4px; background:transparent; box-shadow:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type==='video') html=`<div class="bubble" style="padding:4px; background:transparent; box-shadow:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video><div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-size:30px; text-shadow:0 2px 4px rgba(0,0,0,0.5);">▶</div></div></div>`;
        else if(msg.type==='file') html=`<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}" style="text-decoration:underline; font-weight:bold;">Download</a></div>`;
        
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    };

    const sendData = (type, content) => {
        if(!activeChatId) { alert("Open chat first!"); return; }
        
        // 尝试走 P2P (文本/表情)
        if (isP2PReady && dataChannel && dataChannel.readyState === 'open') {
            try {
                const packet = { type: type, content: content };
                dataChannel.send(JSON.stringify(packet)); // 直连发送
                // 本地显示
                const msgObj = { type, content, isSelf: true, ts: Date.now() };
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push(msgObj); saveDB(); appendMsgDOM(msgObj, true);
                return;
            } catch(e) { console.log("P2P send failed, fallback to tunnel"); }
        }

        // 兜底走 Tunnel
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type });
        } else {
            alert("Connecting..."); return;
        }
        const msgObj = { type, content, isSelf: true, ts: Date.now() };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj); saveDB(); appendMsgDOM(msgObj, true);
    };

    // ★ 修复：强制返回主页 (Bug 1) ★
    window.goBack = () => { 
        // 强制移除 .active 类，强制添加 .right-sheet，不依赖 history
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('active');
        // 加一点延时让动画顺滑
        setTimeout(() => chatView.classList.add('right-sheet'), 50);
        
        activeChatId = null;
        
        // 关闭 WebRTC 连接以节省资源
        if(peerConnection) { peerConnection.close(); peerConnection = null; isP2PReady = false; }
        
        renderFriends();
    };

    // 打开聊天 (初始化 P2P)
    const openChat = (id) => {
        try { if('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch(e){}

        activeChatId = id; 
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        document.getElementById('chat-online-dot').className = "status-dot red";
        
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('right-sheet');
        chatView.classList.add('active');
        
        const container = document.getElementById('messages-container'); 
        container.innerHTML = '';
        const msgs = db.history[id] || []; 
        msgs.forEach(m => appendMsgDOM(m, m.isSelf));

        // ★ 尝试建立 P2P 直连 (局域网加速) ★
        initP2P(id, true); // 主动发起
    };

    const handleAddFriend = (id) => {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false });
            saveDB(); renderFriends();
        }
        openChat(id);
    };

    // --- 3. WebRTC P2P 逻辑 (局域网传输核心) ---
    const initP2P = async (targetId, isInitiator) => {
        if(peerConnection) { peerConnection.close(); }
        isP2PReady = false;

        const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }; // 使用公共 STUN 穿透
        peerConnection = new RTCPeerConnection(config);

        // 1. 处理 ICE 候选 (网络路径)
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('p2p_signal', { targetId, type: 'candidate', candidate: event.candidate });
            }
        };

        // 2. 状态变化
        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'connected') {
                document.getElementById('chat-online-dot').className = "status-dot green"; // P2P连通，变绿
                console.log("P2P Connected! LAN Mode Active.");
            }
        };

        if (isInitiator) {
            // 发起方：创建 DataChannel
            dataChannel = peerConnection.createDataChannel("chat");
            setupDataChannel(dataChannel);
            
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('p2p_signal', { targetId, type: 'offer', offer });
        } else {
            // 接收方：等待 DataChannel
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                setupDataChannel(dataChannel);
            };
        }
    };

    const setupDataChannel = (dc) => {
        dc.onopen = () => { isP2PReady = true; console.log("DataChannel Open"); };
        dc.onmessage = (e) => {
            // 收到 P2P 消息/文件
            try {
                const msg = JSON.parse(e.data);
                // 复用 tunnel 的逻辑处理 P2P 数据包
                handleTunnelPacket(msg, activeChatId); 
            } catch(e) {}
        };
    };

    // --- 4. 网络层 (Tunnel + P2P Signal) ---
    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'], upgrade: false });
        
        const registerSocket = () => { if(socket.connected) socket.emit('register', MY_ID); };
        
        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            registerSocket(); isSending = false; processQueue();
        });
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; isSending = false; });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (socket.disconnected) socket.connect(); else registerSocket(); } });

        // ★ P2P 信令交换 ★
        socket.on('p2p_signal', async (data) => {
            if (!peerConnection && data.type === 'offer') {
                // 被动接收方初始化
                initP2P(data.from, false);
            }
            if (!peerConnection) return;

            try {
                if (data.type === 'offer') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit('p2p_signal', { targetId: data.from, type: 'answer', answer });
                } else if (data.type === 'answer') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                } else if (data.type === 'candidate') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } catch(e) { console.error("P2P Signal Error", e); }
        });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let friend = db.friends.find(f => f.id === fid);
            if(!friend) { friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false }; db.friends.push(friend); }

            // 消息通知
            if(activeChatId !== fid) {
                friend.unread = true; saveDB(); renderFriends();
                if('speechSynthesis' in window && !window.speechSynthesis.speaking) {
                    const u = new SpeechSynthesisUtterance("Message coming");
                    window.speechSynthesis.speak(u);
                } else document.getElementById('msg-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(100);
            }

            // 处理普通消息
            if (msg.type !== 'tunnel_file_packet') {
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
                saveDB();
                if(activeChatId === fid) appendMsgDOM(msg, false);
            } 
            // 处理隧道文件
            else {
                try {
                    const p = JSON.parse(msg.content);
                    handleTunnelPacket(p, fid);
                } catch(e){}
            }
        });
    }

    // 统一处理文件包 (P2P 和 Tunnel 公用)
    function handleTunnelPacket(p, fid) {
        if(p.type && !p.subType) { 
            // P2P 传来的普通消息
            if(!db.history[fid]) db.history[fid] = [];
            db.history[fid].push({ type: p.type, content: p.content, isSelf: false, ts: Date.now() });
            saveDB();
            if(activeChatId === fid) appendMsgDOM({ type: p.type, content: p.content }, false);
            return;
        }

        // 文件切片
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastBytes:0, lastTime:Date.now(), fileName:p.fileName, fileType:p.fileType };
                if(activeChatId === fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
            }
            const dl = activeDownloads[p.fileId];
            dl.chunks.push(p.data);
            dl.receivedSize += Math.floor(p.data.length * 0.75);
            const now = Date.now();
            if(now - dl.lastTime > 500) {
                const spd = ((dl.receivedSize - dl.lastBytes)/1024)/((now-dl.lastTime)/1000);
                updateProgressUI(p.fileId, dl.receivedSize, dl.totalSize, spd);
                dl.lastBytes = dl.receivedSize; dl.lastTime = now;
            }
        } else if(p.subType === 'end') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(blob);
                let type = 'file';
                if(dl.fileType.startsWith('image')) type = 'image';
                else if(dl.fileType.startsWith('video')) type = 'video';
                else if(dl.fileType.startsWith('audio')) type = 'voice';
                
                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                replaceProgressWithContent(p.fileId, finalMsg);
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({...finalMsg, content: '[File Saved]', type: 'text'}); saveDB();
                delete activeDownloads[p.fileId];
                document.getElementById('success-sound').play().catch(()=>{});
            }
        }
    }

    // --- 队列发送 (支持双模) ---
    function addToQueue(file) { uploadQueue.push(file); processQueue(); }
    function processQueue() {
        if(isSending || uploadQueue.length === 0) return;
        const file = uploadQueue.shift();
        sendFileChunked(file);
    }

    function sendFileChunked(file) {
        if(!activeChatId) { alert("Connect first"); return; }
        // 如果没有 Socket 也没有 P2P，则不发
        if(!isP2PReady && (!socket || !socket.connected)) { alert("No Connection"); return; }
        
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset = 0; let lastTime = Date.now(); let lastBytes = 0; const total = file.size;
        
        // ★ 决定发送方式 ★
        const useP2P = isP2PReady && dataChannel && dataChannel.readyState === 'open';
        console.log(useP2P ? "Sending via LAN/P2P" : "Sending via Tunnel");

        const readNext = () => {
            if(cancelFlag[fileId]) { isSending = false; setTimeout(processQueue, 500); return; }
            if(!useP2P && !socket.connected) { isSending = false; setTimeout(processQueue, 500); return; }

            if(offset >= total) {
                const endP = JSON.stringify({ subType: 'end', fileId });
                if(useP2P) dataChannel.send(endP);
                else socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: endP });
                
                let type = 'file';
                if(sendType.startsWith('image')) type = 'image';
                else if(sendType.startsWith('video')) type = 'video';
                else if(sendType.startsWith('audio')) type = 'voice';
                const finalMsg = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true };
                replaceProgressWithContent(fileId, finalMsg);
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push({...finalMsg, content: '[File Sent]', type: 'text'}); saveDB();
                isSending = false; setTimeout(processQueue, 300); return;
            }

            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                const packet = JSON.stringify({ subType: 'chunk', fileId, data: b64, fileName: sendName, fileType: sendType, totalSize: total });
                
                if(useP2P) {
                    try { dataChannel.send(packet); } 
                    catch(e) { /* P2P断了，这里可以做降级逻辑，暂时简单处理停止 */ isSending=false; return; }
                } else {
                    socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: packet });
                }
                
                offset += chunk.size;
                const now = Date.now();
                if(now - lastTime > 200) {
                    const spd = ((offset - lastBytes)/1024)/((now - lastTime)/1000);
                    updateProgressUI(fileId, offset, total, spd);
                    lastTime = now; lastBytes = offset;
                }
                // P2P 很快，间隔可以更短；Tunnel 慢一点
                setTimeout(readNext, useP2P ? 5 : 30); 
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    function traverseFileTree(item, path) {
        if (item.isFile) { item.file(function(file) { addToQueue(file); }); } 
        else if (item.isDirectory) {
            var dirReader = item.createReader();
            dirReader.readEntries(function(entries) {
                for (var i = 0; i < entries.length; i++) traverseFileTree(entries[i], path + item.name + "/");
            });
        }
    }

    // --- UI Helpers ---
    function b64toBlob(b64, type) {
        try {
            const bin = atob(b64); const arr = new Uint8Array(bin.length);
            for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], {type});
        } catch(e) { return new Blob([], {type}); }
    }

    // 音频控制
    window.handleAudio = (action, url) => {
        if (!globalAudio) globalAudio = new Audio();
        if (action === 'play') {
            if (globalAudio.src !== url) globalAudio.src = url;
            globalAudio.play().catch(e=>alert("Err: "+e.message));
        } else if (action === 'pause') {
            globalAudio.pause();
        } else if (action === 'stop') {
            globalAudio.pause(); globalAudio.currentTime = 0;
        }
    };

    // 录音
    const vBtn = document.getElementById('voice-record-btn');
    let rec, chunks;
    const reqPerms = async () => { try { await navigator.mediaDevices.getUserMedia({audio:true}); } catch(e){} };
    document.body.addEventListener('click', reqPerms, {once:true});

    const startR = async(e) => {
        e.preventDefault();
        try {
            const s = await navigator.mediaDevices.getUserMedia({audio:true});
            let mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            rec = new MediaRecorder(s, {mimeType:mime}); chunks=[];
            rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
            rec.onstop = () => {
                const b = new Blob(chunks, {type:mime});
                const f = new File([b], "voice.wav", {type:mime});
                addToQueue(f); s.getTracks().forEach(t=>t.stop());
            };
            rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording');
        } catch(e){ alert("Mic Required!"); }
    };
    const stopR = (e) => {
        e.preventDefault();
        if(rec && rec.state!=='inactive') { rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; }
    };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    // 文本发送
    const handleSend = () => {
        const t = document.getElementById('chat-input');
        if(t.value.trim()) { sendData('text', t.value); t.value=''; }
    };
    document.getElementById('chat-send-btn').onclick = handleSend;
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });

    // 历史返回 (Fix)
    window.addEventListener('popstate', () => {
        const preview = document.getElementById('media-preview-modal');
        if(!preview.classList.contains('hidden')) { window.closePreview(); return; }
        
        // 执行返回
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null; 
        
        if(peerConnection) { peerConnection.close(); peerConnection=null; isP2PReady=false; }
        
        renderFriends();
    });

    // 拖拽
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(!activeChatId) return;
        const items = e.dataTransfer.items;
        if(items) {
            for(let i=0; i<items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if(item) traverseFileTree(item);
            }
        } else if(e.dataTransfer.files[0]) addToQueue(e.dataTransfer.files[0]);
    });

    // 绑定
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(window.Html5Qrcode) {
                const s = new Html5Qrcode("qr-reader"); window.scanner = s;
                s.start({facingMode:"environment"}, {fps:10, qrbox:200}, t => {
                    s.stop().then(()=>{ window.closeAllModals(); if(t.length===4) handleAddFriend(t); });
                });
            } else alert("Scanner Loading...");
        }, 300);
    };

    document.getElementById('mode-switch-btn').onclick = () => {
        const v = document.getElementById('voice-record-btn'); const t = document.getElementById('text-input-wrapper'); const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); t.style.display='flex'; v.classList.add('hidden'); v.style.display='none'; b.innerText='🎤'; } 
        else { t.classList.add('hidden'); t.style.display='none'; v.classList.remove('hidden'); v.style.display='block'; b.innerText='⌨️'; }
    };

    document.getElementById('file-btn').onclick = () => document.getElementById('chat-file-input').click();
    document.getElementById('chat-file-input').onchange = e => { if(e.target.files[0]) addToQueue(e.target.files[0]); };
    
    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = '';
    for(let i=0; i<12; i++) {
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        img.className='sticker-item'; 
        img.style.cssText = "width:60px; height:60px; object-fit:contain; cursor:pointer;";
        img.onclick = () => { if(activeChatId) { sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    window.closeAllModals = () => { document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden')); if(window.scanner) window.scanner.stop().catch(()=>{}); };
    window.cancelTransfer = (id, isSelf) => { if(isSelf) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble" style="color:red;font-size:12px;">🚫 Cancelled</div>'; };
    
    window.previewMedia = (url, type) => {
        const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML='';
        const dlBtn = document.getElementById('preview-download-btn');
        if(dlBtn) { dlBtn.href = url; dlBtn.download = `file_${Date.now()}`; }
        let el = type==='image' ? document.createElement('img') : document.createElement('video');
        el.src = url; el.style.maxWidth='100%'; el.style.maxHeight='100vh'; if(type==='video') { el.controls=true; el.autoplay=true; }
        c.appendChild(el); m.classList.remove('hidden'); m.style.display='flex'; 
        window.history.pushState({p:1},"");
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); document.getElementById('media-preview-modal').style.display='none'; };
    
    // 初始化
    renderProfile(); renderFriends(); setupDialpad();
    document.body.addEventListener('click', () => { document.getElementById('msg-sound').load(); }, {once:true});
});
