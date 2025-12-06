document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (Mac 风格 + 隐藏底部导航 + 修复) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root {
            --glass-bg: rgba(255, 255, 255, 0.85);
            --shadow-sm: 0 2px 8px rgba(0,0,0,0.05);
            --primary-mac: #007AFF;
            --success-mac: #34C759;
            --danger-mac: #FF3B30;
        }

        body { background: #F2F2F7; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }

        /* ★ 核心修改：隐藏底部导航栏 ★ */
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 20px !important; } 

        /* Mac 风格列表 */
        .k-list-item {
            background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px;
            box-shadow: var(--shadow-sm); border: 1px solid rgba(0,0,0,0.02);
            transition: transform 0.1s;
        }
        .k-list-item:active { transform: scale(0.98); background: #f5f5f5; }

        /* 消息抖动提醒 */
        @keyframes shake-notify {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-2px) rotate(-1deg); }
            40% { transform: translateX(2px) rotate(1deg); }
            60% { transform: translateX(-2px); }
            80% { transform: translateX(2px); }
        }
        .shake-active { animation: shake-notify 1.2s infinite; border-left: 3px solid var(--danger-mac); }

        /* 跑马灯文字 */
        .marquee-container { overflow: hidden; white-space: nowrap; max-width: 140px; }
        .marquee-text {
            display: inline-block; padding-left: 100%;
            animation: marquee 5s linear infinite;
            color: var(--danger-mac); font-size: 11px; font-weight: bold;
        }
        @keyframes marquee { 0% { transform: translate(0, 0); } 100% { transform: translate(-100%, 0); } }

        /* 语音波纹动画 (修复点击无效果) */
        @keyframes wave-dance { 0% { height: 20%; } 50% { height: 100%; } 100% { height: 20%; } }
        .voice-bubble.playing .wave-bar { animation: wave-dance 0.5s infinite ease-in-out; background-color: var(--primary-mac) !important; }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 16px; margin-left: 10px; }
        .wave-bar { width: 3px; height: 30%; background-color: #999; border-radius: 2px; }
        .voice-bubble.playing .wave-bar:nth-child(1) { animation-delay: 0s; }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .voice-bubble.playing .wave-bar:nth-child(4) { animation-delay: 0.3s; }

        /* 气泡与预览 */
        .bubble { border: none !important; box-shadow: var(--shadow-sm); border-radius: 18px !important; padding: 10px 14px; background: #fff; }
        .msg-row.self .bubble { background: var(--primary-mac); color: white; }
        .msg-row.other .bubble { background: #fff; color: black; }
        .thumb-box { border-radius: 10px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .thumb-img { max-width: 140px; max-height: 140px; object-fit: cover; }

        /* 取消按钮 */
        .cancel-btn {
            position: absolute; top: -6px; right: -6px; width: 22px; height: 22px;
            background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; cursor: pointer; backdrop-filter: blur(4px);
        }
    `;
    document.head.appendChild(styleSheet);

    // 预览模态框
    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95); z-index:9999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:10000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:40px; height:40px; border-radius:50%; font-size:20px; cursor:pointer;">✕</button>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    if(!document.getElementById('media-preview-modal')) document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 数据层 ---
    const DB_KEY = 'pepe_v33_mac_final_v2';
    const CHUNK_SIZE = 12 * 1024; 
    let db;
    
    // 初始化 DB
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Init");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 状态管理 ---
    const activeDownloads = {};   
    let isSending = false;
    let cancelFlag = {}; 

    // --- 3. UI 初始化 (修复 ID 不显示问题) ---
    const renderProfile = () => {
        try {
            // 设置 ID 和 昵称
            const idEl = document.getElementById('my-id-display');
            if(idEl) idEl.innerText = MY_ID;
            
            const nickEl = document.getElementById('my-nickname');
            if(nickEl) nickEl.innerText = db.profile.nickname;
            
            const avatarEl = document.getElementById('my-avatar');
            if(avatarEl) avatarEl.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;

            // 生成二维码 (加保险)
            const qrEl = document.getElementById("qrcode");
            if(qrEl && window.QRCode) {
                qrEl.innerHTML = ''; // 先清空，防止重复追加导致错乱
                new QRCode(qrEl, { text: MY_ID, width: 60, height: 60, colorDark: "#000000", colorLight: "#FFFFFF" });
            }
        } catch(e) {
            console.error("Profile Render Error:", e);
        }
    };
    // 立即执行渲染
    renderProfile();

    // --- 4. 聊天与网络 (优先连接) ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        // ★ 强制 Websocket，确保在线状态
        socket = io(SERVER_URL, { 
            reconnection: true, reconnectionAttempts: Infinity, transports: ['websocket'], upgrade: false 
        });
        
        const registerSocket = () => { if(socket.connected) socket.emit('register', MY_ID); };

        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            registerSocket();
            isSending = false;
        });
        socket.on('reconnect', () => { registerSocket(); });
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; isSending = false; });
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (socket.disconnected) socket.connect(); else registerSocket();
            }
        });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let friend = db.friends.find(f => f.id === fid);
            if(!friend) {
                friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false };
                db.friends.push(friend);
            }

            // 在线状态联动
            if (activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            }

            // 消息提醒 (未读/语音/抖动)
            if (activeChatId !== fid) {
                friend.unread = true; 
                saveDB();
                renderFriends();
                
                // 性感女声提醒
                if ('speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance("Message coming");
                    // 尝试寻找女性声音
                    const voices = window.speechSynthesis.getVoices();
                    const fem = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google US English'));
                    if(fem) u.voice = fem;
                    u.rate = 1.1; u.pitch = 1.2;
                    window.speechSynthesis.speak(u);
                } else {
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
                
                if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
            } else {
                document.getElementById('msg-sound').play().catch(()=>{});
            }

            // --- 隧道解包 (文件接收逻辑 - 不动) ---
            if (msg.type === 'tunnel_file_packet') {
                try {
                    const packet = JSON.parse(msg.content);
                    if (packet.subType === 'chunk') {
                        if (activeDownloads[packet.fileId] === 'cancelled') return; // 已取消
                        if (!activeDownloads[packet.fileId]) {
                            activeDownloads[packet.fileId] = {
                                chunks: [], totalSize: packet.totalSize || 0, receivedSize: 0,
                                lastBytes: 0, lastTime: Date.now(), fileName: packet.fileName, fileType: packet.fileType
                            };
                            if(activeChatId === fid) appendProgressBubble(fid, packet.fileId, packet.fileName, packet.fileType, false);
                        }
                        const download = activeDownloads[packet.fileId];
                        download.chunks.push(packet.data);
                        download.receivedSize += Math.floor(packet.data.length * 0.75);
                        
                        const now = Date.now();
                        if(now - download.lastTime > 500) {
                            const speed = ((download.receivedSize - download.lastBytes) / 1024) / ((now - download.lastTime)/1000); 
                            download.lastBytes = download.receivedSize; download.lastTime = now;
                            updateProgressUI(packet.fileId, download.receivedSize, download.totalSize, speed);
                        }
                    } else if (packet.subType === 'end') {
                        if (activeDownloads[packet.fileId] === 'cancelled') return;
                        const download = activeDownloads[packet.fileId];
                        if(download) {
                            const blob = b64toBlob(download.chunks.join(''), download.fileType);
                            const fileUrl = URL.createObjectURL(blob);
                            let finalType = 'file';
                            if (download.fileType.startsWith('image')) finalType = 'image';
                            else if (download.fileType.startsWith('video')) finalType = 'video';
                            else if (download.fileType.startsWith('audio')) finalType = 'voice';
                            const finalMsg = { type: finalType, content: fileUrl, fileName: download.fileName, isSelf: false, ts: Date.now() };
                            replaceProgressWithContent(packet.fileId, finalMsg);
                            if(!db.history[fid]) db.history[fid] = [];
                            db.history[fid].push({ ...finalMsg, content: '[File Saved]', type: 'text' }); saveDB();
                            delete activeDownloads[packet.fileId];
                            document.getElementById('success-sound').play().catch(()=>{});
                        }
                    }
                } catch (e) {}
                return;
            }

            if (msg.type !== 'tunnel_file_packet') {
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
                saveDB(); 
                if(activeChatId === fid) appendMsgDOM(msg, false);
            }
        });
    }

    // --- 5. 文件发送 (隧道模式 + 取消 + 文件夹防护) ---
    function sendFileChunked(file, overrideType = null) {
        if(!activeChatId || !socket) return;
        if(isSending) { alert("Busy..."); return; }
        if(!socket.connected) { alert("No Connection"); return; }

        isSending = true; 
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const sendName = (file.name && file.name.length > 0) ? file.name : `file_${Date.now()}`;
        const sendType = overrideType || file.type || 'application/octet-stream';
        const totalSize = file.size;

        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, sendType, true);

        let offset = 0;
        let lastUpdate = Date.now();
        let lastBytes = 0;

        const readNextChunk = () => {
            if (cancelFlag[fileId]) { isSending = false; return; } // 用户取消
            if(!socket.connected) { isSending = false; alert("Net Error"); return; }

            if (offset >= totalSize) {
                const endPacket = { subType: 'end', fileId: fileId };
                socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: JSON.stringify(endPacket) });
                
                let localMsgType = 'file';
                if (sendType.startsWith('image')) localMsgType = 'image';
                else if (sendType.startsWith('video')) localMsgType = 'video';
                else if (sendType.startsWith('audio')) localMsgType = 'voice';

                const finalMsg = { type: localMsgType, content: URL.createObjectURL(file), fileName: sendName, isSelf: true };
                replaceProgressWithContent(fileId, finalMsg);
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push({ ...finalMsg, content: '[File Sent]', type: 'text' }); saveDB();
                isSending = false; return;
            }

            const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const base64Chunk = e.target.result.split(',')[1];
                const dataPacket = {
                    subType: 'chunk', fileId: fileId, data: base64Chunk,
                    fileName: sendName, fileType: sendType, totalSize: totalSize
                };
                socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: JSON.stringify(dataPacket) });
                offset += chunkBlob.size;
                
                const now = Date.now();
                if(now - lastUpdate > 200) {
                    const speed = ((offset - lastBytes) / 1024) / ((now - lastUpdate)/1000);
                    updateProgressUI(fileId, offset, totalSize, speed);
                    lastUpdate = now; lastBytes = offset;
                }
                setTimeout(readNextChunk, 30);
            };
            reader.onerror = () => { isSending = false; alert("Read Error"); };
            reader.readAsDataURL(chunkBlob);
        };
        readNextChunk();
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
        } catch(e) { return new Blob([], {type: contentType}); }
    }

    // --- 6. 辅助 UI 逻辑 ---
    window.previewMedia = (url, type) => {
        const modal = document.getElementById('media-preview-modal');
        const container = document.getElementById('preview-container');
        container.innerHTML = '';
        let el;
        if(type === 'image') { el = document.createElement('img'); el.src = url; el.style.maxWidth = '100%'; el.style.maxHeight = '100vh'; }
        else if(type === 'video') { el = document.createElement('video'); el.src = url; el.controls = true; el.autoplay = true; el.style.maxWidth = '100%'; el.style.maxHeight = '100vh'; }
        if(el) { container.appendChild(el); modal.classList.remove('hidden'); modal.style.display = 'flex'; window.history.pushState({preview: true}, ""); }
    };
    window.closePreview = () => {
        const modal = document.getElementById('media-preview-modal');
        if(!modal.classList.contains('hidden')) {
            modal.classList.add('hidden'); modal.style.display = 'none';
            document.getElementById('preview-container').innerHTML = '';
            if(window.history.state && window.history.state.preview) window.history.back();
        }
    };
    window.addEventListener('popstate', () => { window.closePreview(); });

    // 取消传输
    window.cancelTransfer = (fileId, isSender) => {
        if(isSender) cancelFlag[fileId] = true;
        else activeDownloads[fileId] = 'cancelled';
        const row = document.getElementById(`progress-row-${fileId}`);
        if(row) row.innerHTML = `<div class="bubble" style="color:red; font-size:12px;">🚫 Cancelled</div>`;
    };

    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => { if(e.id !== 'media-preview-modal') e.classList.add('hidden'); });
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    window.switchTab = (id) => {
        if(id === 'tab-identity') return; // 已禁用
        document.querySelectorAll('.page').forEach(p => {
            if(p.id === id) { p.classList.add('active'); p.classList.remove('right-sheet'); }
            else if(p.id !== 'view-main') p.classList.remove('active');
        });
    };
    window.goBack = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
        renderFriends();
    };

    // --- 渲染好友列表 (带消息提醒) ---
    function renderFriends() {
        const list = document.getElementById('friends-list-container'); list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div'); 
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            
            let nameHtml = `<div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>`;
            if (f.unread) {
                nameHtml = `
                <div style="display:flex; align-items:center; gap:5px; overflow:hidden;">
                    <div style="font-weight:bold; font-size:16px; white-space:nowrap;">${f.alias || f.id}</div>
                    <div class="marquee-container"><div class="marquee-text">📢 Message Coming... 📢 Message Coming...</div></div>
                </div>`;
            }

            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" class="avatar-img"></div>
                <div style="flex:1; margin-left:10px;">
                    ${nameHtml}
                    <div style="font-size:12px; color:#888;">${f.unread ? '<span style="color:red">● New Message</span>' : 'Click to chat'}</div>
                </div>
            `;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); }; 
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id; const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        document.getElementById('chat-online-dot').className = "status-dot red"; // 默认红，收到消息变绿
        const chatView = document.getElementById('view-chat'); chatView.classList.remove('right-sheet'); chatView.classList.add('active');
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
            html = `<div id="voice-${uid}" class="bubble voice-bubble ${isSelf?'self':'other'}" style="cursor:pointer; display:flex; align-items:center; gap:5px;" onclick="playVoice('${msg.content}', 'voice-${uid}')"><span style="font-weight:bold;">▶ Voice</span><div class="wave-visual"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div></div>`;
        } 
        else if (msg.type === 'image') {
            html = `<div class="bubble" style="padding:4px;"><div class="thumb-box"><img src="${msg.content}" class="thumb-img"><div class="cancel-btn" style="top:5px; right:5px; background:rgba(0,0,0,0.6);" onclick="previewMedia('${msg.content}', 'image')">👁</div></div></div>`;
        } 
        else if (msg.type === 'video') {
            html = `<div class="bubble" style="padding:4px;"><div class="thumb-box" style="width:140px; height:90px; background:#000; display:flex; align-items:center; justify-content:center;"><div class="cancel-btn" style="position:static; width:30px; height:30px;" onclick="previewMedia('${msg.content}', 'video')">▶</div></div></div>`;
        } 
        else if (msg.type === 'file') {
            html = `<div class="bubble">📂 ${msg.fileName || 'File'}<br><a href="${msg.content}" download="${msg.fileName || 'download'}" style="text-decoration:underline;">Download</a></div>`;
        }
        div.innerHTML = html; container.appendChild(div); container.scrollTop = container.scrollHeight;
    }

    function appendProgressBubble(chatId, fileId, fileName, fileType, isSelf) {
        if(activeChatId !== chatId) return;
        const container = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        const safeName = fileName || "File";
        // 右上角关闭按钮
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px; position:relative;">
                <div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div>
                <div style="font-weight:bold; margin-bottom:4px; max-width:140px; overflow:hidden;">${isSelf?'⬆':'⬇'} ${safeName}</div>
                <div style="background:#eee; height:6px; border-radius:3px; overflow:hidden; margin-bottom:4px;">
                    <div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#007AFF':'#34C759'}; transition:width 0.1s;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; opacity:0.6;">
                    <span id="speed-${fileId}">0 KB/s</span><span id="pct-${fileId}">0%</span>
                </div>
            </div>`;
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

    // --- 交互 ---
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

    // 修改昵称
    window.editMyName = () => { const n = prompt("New Nickname:", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); renderProfile(); } };
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Set Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };

    // 文件上传
    const fileInput = document.getElementById('chat-file-input');
    document.getElementById('file-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => { const file = e.target.files[0]; if(file) { sendFileChunked(file); fileInput.value = ''; } };

    const fm = document.getElementById('fm-radio');
    document.getElementById('fm-btn').onclick = () => { if(fm.paused) { fm.play(); alert("FM Playing"); } else { fm.pause(); alert("FM Paused"); } };

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
    window.addEventListener('drop', e => { 
        e.preventDefault(); 
        drag.classList.add('hidden'); 
        if(activeChatId && e.dataTransfer.files[0]) { 
            const file = e.dataTransfer.files[0];
            // 修复文件夹检测：如果 size 是 0 或 4096 且没有 type，往往是文件夹
            if (!file.type && (file.size % 4096 === 0 || file.size === 0)) {
                alert("Folder transfer not supported.");
                return;
            }
            sendFileChunked(file); 
        } 
    });
    
    // 初始化点击音效
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
