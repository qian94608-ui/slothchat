document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (保持不变) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes wave { 0% { transform: scaleY(1); } 50% { transform: scaleY(2.5); background: #fff; } 100% { transform: scaleY(1); } }
        @keyframes wave-green { 0% { transform: scaleY(1); } 50% { transform: scaleY(2.5); background: #59BC10; } 100% { transform: scaleY(1); } }
        .voice-bubble { transition: all 0.2s; }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 12px; margin-left: 10px; }
        .wave-bar { width: 3px; height: 100%; background-color: #555; border-radius: 2px; transform-origin: bottom; }
        .voice-bubble.self.playing .wave-bar { animation: wave 0.6s infinite ease-in-out; background-color: #fff !important; }
        .voice-bubble.other.playing .wave-bar { animation: wave-green 0.6s infinite ease-in-out; background-color: #59BC10 !important; }
        .voice-bubble.playing .wave-bar:nth-child(1) { animation-delay: 0s; }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .voice-bubble.playing .wave-bar:nth-child(4) { animation-delay: 0.3s; }
        .thumb-box { position: relative; display: inline-block; max-width: 120px; border-radius: 8px; overflow: hidden; background: #000; min-height: 40px; }
        .thumb-img { max-width: 100%; max-height: 120px; object-fit: cover; display: block; }
        .preview-eye { position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.6); width: 30px; height: 30px; border-top-left-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .bubble { max-width: 85%; word-break: break-word; }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; }
    `;
    document.head.appendChild(styleSheet);

    // 预览模态框
    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:#000; z-index:9999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:10000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:40px; height:40px; border-radius:50%; font-size:20px;">✕</button>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 全局变量 ---
    const DB_KEY = 'pepe_v33_final';
    const CHUNK_SIZE = 16 * 1024; // 16KB 分片
    const activeDownloads = {};   // 接收队列
    const orphanChunks = {};      // 孤儿块队列
    let currentUpload = null;     // 发送任务
    let uploadTimer = null;       // 发送定时器
    
    // 预览逻辑
    window.previewMedia = (url, type) => {
        const modal = document.getElementById('media-preview-modal');
        const container = document.getElementById('preview-container');
        container.innerHTML = '';
        let el;
        if(type === 'image') {
            el = document.createElement('img'); el.src = url;
            el.style.width = '100%'; el.style.height = 'auto'; el.style.maxHeight = '100vh'; el.style.objectFit = 'contain';
        } else if(type === 'video') {
            el = document.createElement('video'); el.src = url; el.controls = true; el.autoplay = true;
            el.style.maxWidth = '100%'; el.style.maxHeight = '100vh';
        }
        if(el) {
            container.appendChild(el); modal.classList.remove('hidden'); modal.style.display = 'flex';
            window.history.pushState({preview: true}, "");
        }
    };
    window.closePreview = () => {
        const modal = document.getElementById('media-preview-modal');
        if(!modal.classList.contains('hidden')) {
            modal.classList.add('hidden'); modal.style.display = 'none';
            document.getElementById('preview-container').innerHTML = '';
            if(window.history.state && window.history.state.preview) window.history.back();
        }
    };
    window.addEventListener('popstate', () => {
        const modal = document.getElementById('media-preview-modal');
        if(!modal.classList.contains('hidden')) {
            modal.classList.add('hidden'); modal.style.display = 'none';
            document.getElementById('preview-container').innerHTML = '';
        }
    });

    // 语音播放
    window.playVoice = (audioUrl, elementId) => {
        document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
        document.querySelectorAll('.voice-bubble').forEach(b => b.classList.remove('playing'));
        const bubble = document.getElementById(elementId);
        const audio = new Audio(audioUrl);
        if(bubble) bubble.classList.add('playing');
        audio.play().catch(e => {
            console.error("Play Error:", e);
            alert("Playback failed. Format not supported.");
            if(bubble) bubble.classList.remove('playing');
        });
        audio.onended = () => { if(bubble) bubble.classList.remove('playing'); };
    };

    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => { if(e.id !== 'media-preview-modal') e.classList.add('hidden'); });
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };
    window.switchTab = (id) => {
        document.querySelectorAll('.page').forEach(p => {
            if(p.id === id) { p.classList.add('active'); p.classList.remove('right-sheet'); }
            else if(p.id !== 'view-main') p.classList.remove('active');
        });
        if(id === 'tab-identity') { document.getElementById('tab-identity').classList.remove('hidden'); document.getElementById('tab-identity').style.display = 'block'; }
    };
    window.closeIdentity = () => { document.getElementById('tab-identity').classList.add('hidden'); document.getElementById('tab-identity').style.display = 'none'; };
    window.goBack = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // --- 2. 数据层 ---
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Init");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // UI Init
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-nickname').innerText = db.profile.nickname;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    document.getElementById('card-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" });
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 60, height: 60 });
    }
    renderFriends();

    // --- 3. 核心功能 ---
    function handleAddFriend(id) {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}` });
            saveDB(); renderFriends();
        }
        openChat(id);
    }
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) { window.closeAllModals(); setTimeout(() => handleAddFriend(id), 100); document.getElementById('manual-id-input').value = ''; }
        else { alert("Must be 4 digits"); }
    };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader"); window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                document.getElementById('success-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);
                scanner.stop().then(() => { window.closeAllModals(); if(txt.length === 4) handleAddFriend(txt); else alert("Invalid Code"); })
                .catch(() => { window.closeAllModals(); });
            }).catch(()=>{ alert("Camera Error"); window.closeAllModals(); });
        }, 300);
    };

    // --- 4. 聊天与网络 (★ 重构：稳健接收逻辑) ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL, { 
            reconnection: true, 
            reconnectionAttempts: Infinity,
            transports: ['websocket'] 
        });
        
        const registerSocket = () => { if(socket.connected) socket.emit('register', MY_ID); };

        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            registerSocket();
            // 如果连接断开后恢复，且有正在进行的上传，尝试恢复发送（或由用户重试）
            if(currentUpload && currentUpload.step === 'streaming') {
                processNextStep();
            }
        });

        socket.on('reconnect', () => { registerSocket(); });
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; });
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (socket.disconnected) socket.connect();
                else registerSocket();
            }
        });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            if(!db.friends.find(f => f.id === fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` }); renderFriends();
            }

            // --- A. 发送端收到的确认信号 ---
            if (msg.type === 'sys_ack_start') {
                if (currentUpload && currentUpload.fileId === msg.fileId && currentUpload.step === 'handshake') {
                    // 握手成功，转入推流模式
                    currentUpload.step = 'streaming';
                    processNextStep(); 
                }
                return;
            }
            if (msg.type === 'sys_ack_end') {
                if (currentUpload && currentUpload.fileId === msg.fileId && currentUpload.step === 'finishing') {
                    // 对方确认结束，清理本地任务
                    completeUpload();
                }
                return;
            }

            // --- B. 接收端逻辑 ---
            
            // 1. 收到文件 Start
            if (msg.type === 'file_start') {
                // 如果已存在任务（可能是重复的Start包），忽略或重置
                if (!activeDownloads[msg.fileId]) {
                    activeDownloads[msg.fileId] = {
                        chunks: [],
                        totalSize: msg.totalSize || 0,
                        receivedSize: 0,
                        startTime: Date.now(),
                        lastBytes: 0, lastTime: Date.now(),
                        fileName: msg.fileName || `file_${msg.fileId}`,
                        fileType: msg.fileType || 'application/octet-stream'
                    };
                    if(activeChatId === fid) appendProgressBubble(fid, msg.fileId, activeDownloads[msg.fileId].fileName, msg.fileType, false);
                    
                    // ★ 检查孤儿队列：之前有没有先到的块？
                    if (orphanChunks[msg.fileId]) {
                        orphanChunks[msg.fileId].forEach(c => processReceivedChunk(msg.fileId, c));
                        delete orphanChunks[msg.fileId];
                    }
                }
                // ★ 立即回复 ACK (多次收到Start就多次回复，确保发送端收到)
                socket.emit('send_private', { targetId: fid, type: 'sys_ack_start', fileId: msg.fileId });
                return;
            }

            // 2. 收到文件 Chunk
            if (msg.type === 'file_chunk') {
                if (activeDownloads[msg.fileId]) {
                    processReceivedChunk(msg.fileId, msg.chunk);
                } else {
                    // ★ 还没收到 Start？存入孤儿队列，等 Start 来了再合并
                    if (!orphanChunks[msg.fileId]) orphanChunks[msg.fileId] = [];
                    orphanChunks[msg.fileId].push(msg.chunk);
                    // 可以在这里请求重发 Start，但简单的 Ack 机制通常能通过重试解决
                }
                return;
            }

            // 3. 收到文件 End
            if (msg.type === 'file_end') {
                // 收到结束信号，立即回复 ACK
                socket.emit('send_private', { targetId: fid, type: 'sys_ack_end', fileId: msg.fileId });
                
                const download = activeDownloads[msg.fileId];
                if(download) {
                    finalizeDownload(download, msg.fileId, fid);
                }
                return;
            }

            // 普通消息
            if (msg.type !== 'file_start' && msg.type !== 'file_chunk' && msg.type !== 'file_end' && !msg.type.startsWith('sys_')) {
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
                saveDB(); renderFriends();
                if(activeChatId === fid) appendMsgDOM(msg, false);
                else document.getElementById('msg-sound').play().catch(()=>{});
            }
        });
    }

    // 接收端辅助：处理单个块
    function processReceivedChunk(fileId, chunkBase64) {
        const download = activeDownloads[fileId];
        if (!download) return;
        
        download.chunks.push(chunkBase64);
        download.receivedSize += Math.floor(chunkBase64.length * 0.75); // 估算
        
        const now = Date.now();
        if(now - download.lastTime > 500) {
            const bytesDiff = download.receivedSize - download.lastBytes;
            const timeDiff = (now - download.lastTime) / 1000;
            const speed = (bytesDiff / 1024) / timeDiff; 
            download.lastBytes = download.receivedSize; download.lastTime = now;
            updateProgressUI(fileId, download.receivedSize, download.totalSize, speed);
        }
    }

    // 接收端辅助：完成下载
    function finalizeDownload(download, fileId, fid) {
        const blob = b64toBlob(download.chunks.join(''), download.fileType);
        const fileUrl = URL.createObjectURL(blob);
        
        let finalType = 'file';
        if (download.fileType.startsWith('image')) finalType = 'image';
        else if (download.fileType.startsWith('video')) finalType = 'video';
        else if (download.fileType.startsWith('audio')) finalType = 'voice';

        const finalMsg = {
            type: finalType, content: fileUrl, 
            fileName: download.fileName, 
            isSelf: false, ts: Date.now()
        };
        replaceProgressWithContent(fileId, finalMsg);
        
        if(!db.history[fid]) db.history[fid] = [];
        const saveMsg = { ...finalMsg, content: '[File Saved]', type: 'text' };
        db.history[fid].push(saveMsg); saveDB();
        
        delete activeDownloads[fileId];
        document.getElementById('success-sound').play().catch(()=>{});
    }


    // --- 5. 发送逻辑 (★ 核心重构：状态机驱动) ---
    
    // 主循环驱动
    function processNextStep() {
        if (!currentUpload) return;
        if (uploadTimer) clearTimeout(uploadTimer); // 清除旧定时器

        // 1. 握手阶段 (Wait for Ack)
        if (currentUpload.step === 'handshake') {
            const now = Date.now();
            if (now - currentUpload.lastActionTime > 1000) { // 每秒重试一次 Start
                socket.emit('send_private', {
                    targetId: currentUpload.targetId, type: 'file_start', fileId: currentUpload.fileId,
                    fileName: currentUpload.sendName, fileType: currentUpload.sendType, totalSize: currentUpload.totalSize
                });
                currentUpload.lastActionTime = now;
                currentUpload.retryCount++;
                if (currentUpload.retryCount > 15) { // 15秒超时
                    alert("Timeout: Receiver not responding.");
                    currentUpload = null; return;
                }
            }
            uploadTimer = setTimeout(processNextStep, 500); // Check loop
            return;
        }

        // 2. 推流阶段 (Streaming)
        if (currentUpload.step === 'streaming') {
            if (!socket.connected) {
                // 网络断开，等待连接恢复，暂停发送
                uploadTimer = setTimeout(processNextStep, 1000); 
                return; 
            }

            if (currentUpload.offset >= currentUpload.totalSize) {
                // 发送完毕，进入结束握手
                currentUpload.step = 'finishing';
                currentUpload.retryCount = 0;
                processNextStep();
                return;
            }

            // 读取并发送一块
            const chunkBlob = currentUpload.file.slice(currentUpload.offset, currentUpload.offset + CHUNK_SIZE);
            const reader = new FileReader();
            
            reader.onload = (e) => {
                if(!currentUpload) return;
                const base64Chunk = e.target.result.split(',')[1];
                
                socket.emit('send_private', { 
                    targetId: currentUpload.targetId, 
                    type: 'file_chunk', 
                    fileId: currentUpload.fileId, 
                    chunk: base64Chunk 
                });
                
                currentUpload.offset += chunkBlob.size;
                
                // 更新UI
                const now = Date.now();
                if(now - currentUpload.lastUpdate > 200) {
                    const speed = ((currentUpload.offset - currentUpload.lastBytes) / 1024) / ((now - currentUpload.lastUpdate)/1000);
                    updateProgressUI(currentUpload.fileId, currentUpload.offset, currentUpload.totalSize, speed);
                    currentUpload.lastUpdate = now; currentUpload.lastBytes = currentUpload.offset;
                }

                // ★ 30ms 间隔继续发送下一块
                uploadTimer = setTimeout(processNextStep, 30);
            };
            
            reader.onerror = () => { alert("Read Error"); currentUpload = null; };
            reader.readAsDataURL(chunkBlob);
            return;
        }

        // 3. 结束阶段 (Wait for End Ack)
        if (currentUpload.step === 'finishing') {
            const now = Date.now();
            if (now - currentUpload.lastActionTime > 1000) {
                socket.emit('send_private', { targetId: currentUpload.targetId, type: 'file_end', fileId: currentUpload.fileId });
                currentUpload.lastActionTime = now;
                currentUpload.retryCount++;
                if (currentUpload.retryCount > 10) {
                    // 超时也算完成（可能Ack丢了但对方收到了）
                    completeUpload(); 
                    return;
                }
            }
            uploadTimer = setTimeout(processNextStep, 500);
            return;
        }
    }

    function completeUpload() {
        if (!currentUpload) return;
        const { sendType, file, sendName, fileId, targetId } = currentUpload;
        
        let localMsgType = 'file';
        if (sendType.startsWith('image')) localMsgType = 'image';
        else if (sendType.startsWith('video')) localMsgType = 'video';
        else if (sendType.startsWith('audio')) localMsgType = 'voice';

        const finalMsg = { type: localMsgType, content: URL.createObjectURL(file), fileName: sendName, isSelf: true };
        replaceProgressWithContent(fileId, finalMsg);
        
        if(!db.history[targetId]) db.history[targetId] = [];
        db.history[targetId].push({ ...finalMsg, content: '[File Sent]', type: 'text' }); saveDB();
        
        currentUpload = null;
    }

    function sendFileChunked(file, overrideType = null) {
        if(!activeChatId || !socket) return;
        if(currentUpload) { alert("Sending another file..."); return; }
        if(!socket.connected) { alert("No Connection"); return; }

        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const sendName = (file.name && file.name.length > 0) ? file.name : `file_${Date.now()}`;
        const sendType = overrideType || file.type || 'application/octet-stream';
        
        // 初始化任务
        currentUpload = {
            step: 'handshake', // handshake -> streaming -> finishing
            file, fileId, targetId: activeChatId, sendName, sendType, totalSize: file.size,
            offset: 0, lastUpdate: Date.now(), lastBytes: 0, lastActionTime: 0, retryCount: 0
        };

        appendProgressBubble(activeChatId, fileId, sendName, sendType, true);
        
        // 启动状态机
        processNextStep();
    }

    function b64toBlob(b64Data, contentType) {
        try {
            const sliceSize = 512; const byteCharacters = atob(b64Data); const byteArrays = [];
            for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                const slice = byteCharacters.slice(offset, offset + sliceSize);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }
            return new Blob(byteArrays, {type: contentType});
        } catch(e) {
            console.error("Blob Error", e);
            return new Blob([], {type: contentType});
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container'); list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div'); div.className = 'k-list-item';
            div.innerHTML = `<div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div><div><div style="font-weight:bold">${f.alias || f.id}</div><div style="font-size:12px; color:green">SAVED</div></div>`;
            div.onclick = () => openChat(f.id); list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id; const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        const chatView = document.getElementById('view-chat'); chatView.classList.remove('right-sheet'); chatView.classList.add('active');
        document.getElementById('chat-online-dot').className = "status-dot online";
        const container = document.getElementById('messages-container'); container.innerHTML = '';
        const msgs = db.history[id] || []; msgs.forEach(m => appendMsgDOM(m, m.isSelf));
    }

    function sendData(type, content) {
        if(!activeChatId) return;
        if(socket && socket.connected) socket.emit('send_private', { targetId: activeChatId, content, type });
        else { alert("Connecting..."); return; }
        const msgObj = { type, content, isSelf: true, ts: Date.now() };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj); saveDB(); appendMsgDOM(msgObj, true);
    }

    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div'); div.className = `msg-row ${isSelf?'self':'other'}`;
        const uid = Date.now() + Math.random().toString().substr(2,5); 
        let html = '';
        if(msg.type === 'text') { html = `<div class="bubble">${msg.content}</div>`; } 
        else if (msg.type === 'sticker') { html = `<div class="bubble" style="background:transparent; border:none; box-shadow:none;"><img src="${msg.content}" class="sticker-img"></div>`; }
        else if (msg.type === 'voice') {
            html = `<div id="voice-${uid}" class="bubble voice-bubble ${isSelf?'self':'other'}" style="cursor:pointer; display:flex; align-items:center; gap:5px; background:${isSelf?'#59BC10':'#fff'}; color:${isSelf?'#fff':'#000'}" onclick="playVoice('${msg.content}', 'voice-${uid}')"><span style="font-weight:bold;">▶ Voice</span><div class="wave-visual"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div></div>`;
        } 
        else if (msg.type === 'image') {
            html = `<div class="bubble" style="padding:4px;"><div class="thumb-box"><img src="${msg.content}" class="thumb-img"><div class="preview-eye" onclick="previewMedia('${msg.content}', 'image')"><span style="color:#fff; font-size:16px;">👁</span></div></div></div>`;
        } 
        else if (msg.type === 'video') {
            html = `<div class="bubble" style="padding:4px;"><div style="position:relative; width:120px; height:80px; background:#000; border-radius:6px; display:flex; align-items:center; justify-content:center;"><div style="color:#fff; font-size:8px; position:absolute; bottom:2px; left:2px; max-width:100%; overflow:hidden; white-space:nowrap;">${msg.fileName||'Video'}</div><div style="width:30px; height:30px; background:rgba(255,255,255,0.3); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="previewMedia('${msg.content}', 'video')"><span style="color:#fff; font-size:18px;">▶</span></div></div></div>`;
        } 
        else if (msg.type === 'file') {
            html = `<div class="bubble">📂 ${msg.fileName || 'File'}<br><a href="${msg.content}" download="${msg.fileName || 'download'}" style="text-decoration:underline; font-weight:bold;">Download</a></div>`;
        }
        div.innerHTML = html; container.appendChild(div); container.scrollTop = container.scrollHeight;
    }

    function appendProgressBubble(chatId, fileId, fileName, fileType, isSelf) {
        if(activeChatId !== chatId) return;
        const container = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        const safeName = fileName || "File";
        div.innerHTML = `<div class="bubble" style="min-width:160px; font-size:12px;"><div style="font-weight:bold; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:150px;">${isSelf?'⬆':'⬇'} ${safeName}</div><div style="background:#ddd; height:4px; border-radius:2px; overflow:hidden; margin-bottom:4px;"><div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#fff':'#59BC10'}; transition:width 0.1s;"></div></div><div style="display:flex; justify-content:space-between; font-size:10px; opacity:0.8;"><span id="speed-${fileId}">0 KB/s</span><span id="pct-${fileId}">0%</span></div></div>`;
        container.appendChild(div); container.scrollTop = container.scrollHeight;
    }

    function updateProgressUI(fileId, current, total, speed) {
        const bar = document.getElementById(`bar-${fileId}`); const spd = document.getElementById(`speed-${fileId}`); const pct = document.getElementById(`pct-${fileId}`);
        if(bar && spd && pct) {
            const percent = total > 0 ? Math.min(100, Math.floor((current / total) * 100)) : 0;
            bar.style.width = `${percent}%`; pct.innerText = `${percent}%`;
            if (speed > 1024) spd.innerText = `${(speed/1024).toFixed(1)} MB/s`; else spd.innerText = `${Math.floor(speed)} KB/s`;
        }
    }

    function replaceProgressWithContent(fileId, msg) {
        const row = document.getElementById(`progress-row-${fileId}`);
        if(row) { row.remove(); appendMsgDOM(msg, msg.isSelf); }
    }

    // --- 6. 交互 ---
    document.getElementById('chat-send-btn').onclick = () => { const txt = document.getElementById('chat-input').value; if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; } };
    document.getElementById('chat-back-btn').onclick = window.goBack;

    const modeSwitch = document.getElementById('mode-switch-btn'); const voiceBtn = document.getElementById('voice-record-btn'); const textWrapper = document.getElementById('text-input-wrapper');
    let isVoiceMode = true; 
    modeSwitch.onclick = () => {
        isVoiceMode = !isVoiceMode;
        if(isVoiceMode) { textWrapper.classList.add('hidden'); textWrapper.style.display = 'none'; voiceBtn.classList.remove('hidden'); voiceBtn.style.display = 'block'; modeSwitch.innerText = "⌨️"; } 
        else { voiceBtn.classList.add('hidden'); voiceBtn.style.display = 'none'; textWrapper.classList.remove('hidden'); textWrapper.style.display = 'flex'; modeSwitch.innerText = "🎤"; setTimeout(() => document.getElementById('chat-input').focus(), 100); }
    };

    // 录音
    let mediaRecorder, audioChunks;
    const startRec = async (e) => {
        if(e) e.preventDefault();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
            
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            audioChunks = [];
            mediaRecorder.ondataavailable = e => { if(e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, {type: mimeType});
                const voiceFile = new File([blob], "voice_" + Date.now() + ".wav", { type: mimeType });
                sendFileChunked(voiceFile, mimeType);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording'); voiceBtn.innerText="RECORDING...";
        } catch(e) { alert("Mic Error: " + e.message); }
    };
    const stopRec = (e) => { if(e) e.preventDefault(); if(mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; } };
    voiceBtn.addEventListener('touchstart', startRec, {passive: false}); voiceBtn.addEventListener('touchend', stopRec, {passive: false});
    voiceBtn.addEventListener('mousedown', startRec); voiceBtn.addEventListener('mouseup', stopRec);

    // 文件
    const fileInput = document.getElementById('chat-file-input');
    document.getElementById('file-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => { const file = e.target.files[0]; if(file) { sendFileChunked(file); fileInput.value = ''; } };

    window.editMyName = () => { const n = prompt("New Name:", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); document.getElementById('my-nickname').innerText=n; } };
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Rename:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    const fm = document.getElementById('fm-radio');
    document.getElementById('fm-btn').onclick = () => { if(fm.paused) { fm.play(); alert("FM ON"); } else { fm.pause(); alert("FM OFF"); } };

    const sGrid = document.getElementById('sticker-grid');
    for(let i=0; i<12; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-item'; img.style.width='60px';
        img.onclick = () => { if(activeChatId) { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { e.preventDefault(); drag.classList.add('hidden'); if(activeChatId && e.dataTransfer.files[0]) { sendFileChunked(e.dataTransfer.files[0]); } });
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
