document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (Mac 风格 + 动画修复) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root {
            --glass-bg: rgba(255, 255, 255, 0.75);
            --glass-border: 1px solid rgba(255, 255, 255, 0.5);
            --shadow-sm: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            --primary-mac: #007AFF;
            --success-mac: #34C759;
            --danger-mac: #FF3B30;
        }

        body { background: #F2F2F7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

        /* Mac 风格通用类 */
        .mac-glass {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: var(--glass-border);
        }
        
        /* 列表项优化 */
        .k-list-item {
            background: #fff;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 8px;
            box-shadow: var(--shadow-sm);
            transition: all 0.2s;
            border: 1px solid rgba(0,0,0,0.02);
        }
        .k-list-item:active { transform: scale(0.98); background: #f5f5f5; }

        /* 抖动动画 */
        @keyframes shake-hard {
            0% { transform: translate(1px, 1px) rotate(0deg); }
            10% { transform: translate(-1px, -2px) rotate(-1deg); }
            20% { transform: translate(-3px, 0px) rotate(1deg); }
            30% { transform: translate(3px, 2px) rotate(0deg); }
            40% { transform: translate(1px, -1px) rotate(1deg); }
            50% { transform: translate(-1px, 2px) rotate(-1deg); }
            60% { transform: translate(-3px, 1px) rotate(0deg); }
            70% { transform: translate(3px, 1px) rotate(-1deg); }
            80% { transform: translate(-1px, -1px) rotate(1deg); }
            90% { transform: translate(1px, 2px) rotate(0deg); }
            100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .shake-notify { animation: shake-hard 0.8s infinite; border: 1px solid var(--danger-mac); }

        /* 跑马灯效果 */
        .marquee-wrapper {
            overflow: hidden; white-space: nowrap; max-width: 120px; font-size: 10px; color: var(--danger-mac); font-weight: bold;
        }
        .marquee-text { display: inline-block; animation: scroll-left 4s linear infinite; padding-left: 100%; }
        @keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

        /* 语音波纹 */
        @keyframes wave-play { 0% { height: 20%; } 50% { height: 100%; } 100% { height: 20%; } }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 16px; margin-left: 10px; }
        .wave-bar { width: 3px; height: 20%; background-color: #888; border-radius: 2px; }
        /* 播放时触发动画 */
        .voice-bubble.playing .wave-bar { animation: wave-play 0.5s infinite ease-in-out; background-color: var(--primary-mac) !important; }
        .voice-bubble.playing .wave-bar:nth-child(1) { animation-delay: 0s; }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .voice-bubble.playing .wave-bar:nth-child(4) { animation-delay: 0.3s; }

        /* 图片预览 & 气泡优化 */
        .thumb-box { position: relative; display: inline-block; border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm); }
        .thumb-img { max-width: 140px; max-height: 140px; object-fit: cover; display: block; }
        .bubble { border:none !important; box-shadow: var(--shadow-sm); border-radius: 18px !important; padding: 10px 14px; }
        .msg-row.self .bubble { background: var(--primary-mac); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; }

        /* 进度条取消按钮 */
        .cancel-btn {
            position: absolute; top: -8px; right: -8px; width: 20px; height: 20px;
            background: var(--danger-mac); color: white; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 10;
        }
    `;
    document.head.appendChild(styleSheet);

    // 预览模态框
    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.9); z-index:9999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:10000; background:rgba(255,255,255,0.1); color:#fff; border:none; width:44px; height:44px; border-radius:50%; font-size:24px; cursor:pointer;">✕</button>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 全局变量 ---
    const DB_KEY = 'pepe_v33_mac_final';
    const CHUNK_SIZE = 12 * 1024; // 12KB (隧道模式安全大小)
    
    // 状态管理
    const activeDownloads = {};   
    let isSending = false;
    let cancelFlag = {}; // 发送端取消标志
    
    // 预览逻辑
    window.previewMedia = (url, type) => {
        const modal = document.getElementById('media-preview-modal');
        const container = document.getElementById('preview-container');
        container.innerHTML = '';
        let el;
        if(type === 'image') {
            el = document.createElement('img'); el.src = url;
            el.style.maxWidth = '100%'; el.style.maxHeight = '100vh'; el.style.objectFit = 'contain';
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

    // 语音播放 (动画修复)
    window.playVoice = (audioUrl, elementId) => {
        document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
        document.querySelectorAll('.voice-bubble').forEach(b => b.classList.remove('playing'));
        const bubble = document.getElementById(elementId);
        const audio = new Audio(audioUrl);
        
        if(bubble) bubble.classList.add('playing'); // 触发CSS波纹
        
        audio.play().catch(e => {
            console.error("Play Error:", e);
            alert("Audio format error.");
            if(bubble) bubble.classList.remove('playing');
        });
        audio.onended = () => { if(bubble) bubble.classList.remove('playing'); };
    };

    // 取消传输
    window.cancelTransfer = (fileId, isSender) => {
        if(isSender) {
            cancelFlag[fileId] = true; // 设置标志位，中断发送循环
        } else {
            // 接收端取消：删除任务，移除UI
            delete activeDownloads[fileId];
        }
        const row = document.getElementById(`progress-row-${fileId}`);
        if(row) row.innerHTML = `<div class="bubble" style="color:red; font-size:12px;">🚫 Transfer Cancelled</div>`;
    };

    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => { if(e.id !== 'media-preview-modal') e.classList.add('hidden'); });
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    // --- 2. 页面管理 (移除 ID卡 逻辑) ---
    window.switchTab = (id) => {
        if (id === 'tab-identity') return; // 禁用已移除的页面
        document.querySelectorAll('.page').forEach(p => {
            if(p.id === id) { p.classList.add('active'); p.classList.remove('right-sheet'); }
            else if(p.id !== 'view-main') p.classList.remove('active');
        });
    };
    window.goBack = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
        renderFriends(); // 回到主页时刷新状态
    };

    // --- 3. 数据层 ---
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

    // UI Init (Mac 风格适配)
    const renderProfile = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`; // 换个头像风格
        if(window.QRCode) {
            new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#000000", colorLight: "#FFFFFF" });
        }
    }
    renderProfile();

    // --- 4. 核心功能 ---
    function handleAddFriend(id) {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false }); // 增加 unread 字段
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

    // --- 5. 聊天与网络 (隧道模式 + 状态优化) ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
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

            // ★ 在线状态逻辑：收到消息证明对方在线
            if (activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            }

            // ★ 消息通知逻辑 (滚动文字 + 语音 + 抖动)
            if (activeChatId !== fid) {
                friend.unread = true; // 标记未读
                saveDB();
                renderFriends();
                
                // 播放性感语音 (尝试 TTS)
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance("Message coming");
                    utterance.lang = 'en-US';
                    utterance.pitch = 1.2;
                    window.speechSynthesis.speak(utterance);
                } else {
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
                if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
            } else {
                document.getElementById('msg-sound').play().catch(()=>{});
            }

            // --- 隧道解包逻辑 (保持不变) ---
            if (msg.type === 'tunnel_file_packet') {
                try {
                    const packet = JSON.parse(msg.content);
                    
                    if (packet.subType === 'chunk') {
                        // 检查是否已取消
                        if (activeDownloads[packet.fileId] === 'cancelled') return;

                        if (!activeDownloads[packet.fileId]) {
                            activeDownloads[packet.fileId] = {
                                chunks: [], totalSize: packet.totalSize || 0, receivedSize: 0,
                                lastBytes: 0, lastTime: Date.now(),
                                fileName: packet.fileName, fileType: packet.fileType
                            };
                            if(activeChatId === fid) appendProgressBubble(fid, packet.fileId, packet.fileName, packet.fileType, false);
                        }

                        const download = activeDownloads[packet.fileId];
                        download.chunks.push(packet.data);
                        download.receivedSize += Math.floor(packet.data.length * 0.75);
                        
                        const now = Date.now();
                        if(now - download.lastTime > 500) {
                            const bytesDiff = download.receivedSize - download.lastBytes;
                            const timeDiff = (now - download.lastTime) / 1000;
                            const speed = (bytesDiff / 1024) / timeDiff; 
                            download.lastBytes = download.receivedSize; download.lastTime = now;
                            updateProgressUI(packet.fileId, download.receivedSize, download.totalSize, speed);
                        }
                    } 
                    else if (packet.subType === 'end') {
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
                } catch (e) { console.error("Tunnel Parse Error", e); }
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

    // --- 6. 发送逻辑 (隧道发送 + 取消功能) ---
    function sendFileChunked(file, overrideType = null) {
        if(!activeChatId || !socket) return;
        if(isSending) { alert("Sending... Please wait."); return; }
        if(!socket.connected) { alert("No Connection"); return; }

        isSending = true; 
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const sendName = (file.name && file.name.length > 0) ? file.name : `file_${Date.now()}`;
        const sendType = overrideType || file.type || 'application/octet-stream';
        const totalSize = file.size;

        cancelFlag[fileId] = false; // 初始化取消标志
        appendProgressBubble(activeChatId, fileId, sendName, sendType, true);

        let offset = 0;
        let lastUpdate = Date.now();
        let lastBytes = 0;

        const readNextChunk = () => {
            // 检查取消标志
            if (cancelFlag[fileId]) {
                isSending = false;
                return; // 停止发送循环
            }
            if(!socket.connected) { isSending = false; alert("Network lost."); return; }

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

    // --- 渲染逻辑 (含消息提醒) ---
    function renderFriends() {
        const list = document.getElementById('friends-list-container'); list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div'); 
            // 抖动效果类
            div.className = `k-list-item ${f.unread ? 'shake-notify' : ''}`;
            
            // 跑马灯逻辑
            let nameDisplay = `<div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>`;
            if (f.unread) {
                nameDisplay = `
                <div style="display:flex; align-items:center; gap:5px;">
                    <div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>
                    <div class="marquee-wrapper"><div class="marquee-text">📢 Message Coming... 📢 Message Coming...</div></div>
                </div>`;
            }

            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" class="avatar-img"></div>
                <div style="flex:1;">
                    ${nameDisplay}
                    <div style="font-size:12px; color:#888;">${f.unread ? '<span style="color:red">● New Message</span>' : 'Click to chat'}</div>
                </div>
            `;
            div.onclick = () => {
                // 点击后清除未读
                f.unread = false;
                saveDB();
                renderFriends();
                openChat(f.id);
            }; 
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id; const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        // 默认红色，收到消息才变绿
        document.getElementById('chat-online-dot').className = "status-dot red";

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
            html = `<div id="voice-${uid}" class="bubble voice-bubble ${isSelf?'self':'other'}" style="cursor:pointer; display:flex; align-items:center; gap:5px; padding:10px 15px;" onclick="playVoice('${msg.content}', 'voice-${uid}')"><span style="font-weight:bold;">▶ Voice</span><div class="wave-visual"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div></div>`;
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
        // 增加取消按钮
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px; position:relative;">
                <div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div>
                <div style="font-weight:bold; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${isSelf?'⬆':'⬇'} ${safeName}</div>
                <div style="background:#eee; height:6px; border-radius:3px; overflow:hidden; margin-bottom:4px;">
                    <div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#007AFF':'#34C759'}; transition:width 0.1s;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:10px; opacity:0.6;">
                    <span id="speed-${fileId}">0 KB/s</span><span id="pct-${fileId}">0%</span>
                </div>
            </div>
        `;
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

    // --- 7. 交互 & 事件 (PC拖拽修复) ---
    document.getElementById('chat-send-btn').onclick = () => { const txt = document.getElementById('chat-input').value; if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; } };
    document.getElementById('chat-back-btn').onclick = window.goBack;

    const modeSwitch = document.getElementById('mode-switch-btn'); const voiceBtn = document.getElementById('voice-record-btn'); const textWrapper = document.getElementById('text-input-wrapper');
    let isVoiceMode = true; 
    modeSwitch.onclick = () => {
        isVoiceMode = !isVoiceMode;
        if(isVoiceMode) { textWrapper.classList.add('hidden'); textWrapper.style.display = 'none'; voiceBtn.classList.remove('hidden'); voiceBtn.style.display = 'block'; modeSwitch.innerText = "⌨️"; } 
        else { voiceBtn.classList.add('hidden'); voiceBtn.style.display = 'none'; textWrapper.classList.remove('hidden'); textWrapper.style.display = 'flex'; modeSwitch.innerText = "🎤"; setTimeout(()
