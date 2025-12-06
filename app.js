document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态注入样式 (修复：缩略图尺寸、语音波纹、表情) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        /* 语音播放动画 */
        @keyframes wave {
            0% { transform: scaleY(1); }
            50% { transform: scaleY(2.5); background: #fff; }
            100% { transform: scaleY(1); }
        }
        @keyframes wave-green {
            0% { transform: scaleY(1); }
            50% { transform: scaleY(2.5); background: #59BC10; }
            100% { transform: scaleY(1); }
        }
        
        .voice-bubble { transition: all 0.2s; }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 12px; margin-left: 10px; }
        .wave-bar { width: 3px; height: 100%; background-color: #555; border-radius: 2px; transform-origin: bottom; }
        
        /* 己方播放动画 */
        .voice-bubble.self.playing .wave-bar { animation: wave 0.6s infinite ease-in-out; background-color: #fff !important; }
        /* 对方播放动画 */
        .voice-bubble.other.playing .wave-bar { animation: wave-green 0.6s infinite ease-in-out; background-color: #59BC10 !important; }
        
        .voice-bubble.playing .wave-bar:nth-child(1) { animation-delay: 0s; }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .voice-bubble.playing .wave-bar:nth-child(4) { animation-delay: 0.3s; }

        /* 图片预览缩略图限制 (修复：缩小50%且不溢出) */
        .thumb-box { position: relative; display: inline-block; max-width: 120px; border-radius: 8px; overflow: hidden; }
        .thumb-img { max-width: 100%; max-height: 120px; object-fit: cover; display: block; }
        .preview-eye { position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.6); width: 30px; height: 30px; border-top-left-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        /* 修复气泡溢出 */
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

    // --- 1. 全局变量与工具 ---
    const DB_KEY = 'pepe_v33_final';
    const CHUNK_SIZE = 16 * 1024; 
    const activeTransfers = {}; 
    
    // 预览逻辑
    window.previewMedia = (url, type) => {
        const modal = document.getElementById('media-preview-modal');
        const container = document.getElementById('preview-container');
        container.innerHTML = '';
        
        let el;
        if(type === 'image') {
            el = document.createElement('img');
            el.src = url;
            el.style.width = '100%';
            el.style.height = 'auto';
            el.style.maxHeight = '100vh';
            el.style.objectFit = 'contain';
        } else if(type === 'video') {
            el = document.createElement('video');
            el.src = url;
            el.controls = true;
            el.autoplay = true;
            el.style.maxWidth = '100%';
            el.style.maxHeight = '100vh';
        }
        
        if(el) {
            container.appendChild(el);
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            window.history.pushState({preview: true}, "");
        }
    };

    window.closePreview = () => {
        const modal = document.getElementById('media-preview-modal');
        if(!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.getElementById('preview-container').innerHTML = '';
            if(window.history.state && window.history.state.preview) {
                window.history.back();
            }
        }
    };
    
    window.addEventListener('popstate', (e) => {
        const modal = document.getElementById('media-preview-modal');
        if(!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.getElementById('preview-container').innerHTML = '';
        }
    });

    // ★ 修复：语音播放器 (带波纹特效)
    window.playVoice = (audioUrl, elementId) => {
        // 停止其他
        document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
        document.querySelectorAll('.voice-bubble').forEach(b => b.classList.remove('playing'));

        const bubble = document.getElementById(elementId);
        const audio = new Audio(audioUrl);
        
        if(bubble) bubble.classList.add('playing');
        
        audio.play().catch(e => alert("Play error: " + e));
        audio.onended = () => {
            if(bubble) bubble.classList.remove('playing');
        };
    };

    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => {
            if(e.id !== 'media-preview-modal') e.classList.add('hidden');
        });
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    window.switchTab = (id) => {
        document.querySelectorAll('.page').forEach(p => {
            if(p.id === id) { p.classList.add('active'); p.classList.remove('right-sheet'); }
            else if(p.id !== 'view-main') p.classList.remove('active');
        });
        if(id === 'tab-identity') {
            document.getElementById('tab-identity').classList.remove('hidden');
            document.getElementById('tab-identity').style.display = 'block';
        }
    };
    
    window.closeIdentity = () => {
        document.getElementById('tab-identity').classList.add('hidden');
        document.getElementById('tab-identity').style.display = 'none';
    };

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
        db = { 
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' },
            friends: [], history: {}
        };
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
            saveDB();
            renderFriends();
        }
        openChat(id);
    }

    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            window.closeAllModals();
            setTimeout(() => handleAddFriend(id), 100);
            document.getElementById('manual-id-input').value = '';
        } else { alert("Must be 4 digits"); }
    };

    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                document.getElementById('success-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);
                scanner.stop().then(() => {
                    window.closeAllModals();
                    if(txt.length === 4) handleAddFriend(txt);
                    else alert("Invalid Code");
                }).catch(err => { window.closeAllModals(); });
            }).catch(e=>{ alert("Camera Error"); window.closeAllModals(); });
        }, 300);
    };

    // --- 4. 聊天与文件传输 ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true });
        
        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            socket.emit('register', MY_ID);
        });

        socket.on('disconnect', () => {
            document.getElementById('conn-status').className = "status-dot red";
        });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            if(!db.friends.find(f => f.id === fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
                renderFriends();
            }

            // --- 文件接收逻辑 (★ 修复：实时速度 & 文件名 & 预览) ---
            if (msg.type === 'file_start') {
                activeTransfers[msg.fileId] = {
                    chunks: [],
                    totalSize: msg.totalSize,
                    receivedSize: 0,
                    startTime: Date.now(),
                    lastBytes: 0, // 上一次计算时的字节数
                    lastTime: Date.now(),
                    fileName: msg.fileName, // ★ 确保存储发送方文件名
                    fileType: msg.fileType
                };
                if(activeChatId === fid) {
                    appendProgressBubble(fid, msg.fileId, msg.fileName, msg.fileType, false);
                }
                return; 
            }

            if (msg.type === 'file_chunk') {
                const transfer = activeTransfers[msg.fileId];
                if(transfer) {
                    transfer.chunks.push(msg.chunk);
                    // Base64长度转大约字节数
                    const chunkSize = Math.floor(msg.chunk.length * 0.75);
                    transfer.receivedSize += chunkSize;
                    
                    // ★ 实时速度计算 (接收端)
                    const now = Date.now();
                    if(now - transfer.lastTime > 200) { // 200ms 更新一次
                        const bytesDiff = transfer.receivedSize - transfer.lastBytes;
                        const timeDiff = (now - transfer.lastTime) / 1000;
                        const speed = (bytesDiff / 1024) / timeDiff; // KB/s
                        
                        transfer.lastBytes = transfer.receivedSize;
                        transfer.lastTime = now;
                        
                        updateProgressUI(msg.fileId, transfer.receivedSize, transfer.totalSize, speed);
                    }
                }
                return;
            }

            if (msg.type === 'file_end') {
                const transfer = activeTransfers[msg.fileId];
                if(transfer) {
                    const blob = b64toBlob(transfer.chunks.join(''), transfer.fileType);
                    const fileUrl = URL.createObjectURL(blob);
                    
                    // ★ 核心修复：根据类型生成正确的消息类型，使接收方也能预览
                    let msgType = 'file';
                    if (transfer.fileType.startsWith('image')) msgType = 'image';
                    else if (transfer.fileType.startsWith('video')) msgType = 'video';

                    const finalMsg = {
                        type: msgType,
                        content: fileUrl, 
                        fileName: transfer.fileName, // ★ 必须使用发送方传来的文件名
                        isSelf: false,
                        ts: Date.now()
                    };

                    // 更新UI
                    replaceProgressWithContent(msg.fileId, finalMsg);
                    
                    // 历史只存文本占位符
                    if(!db.history[fid]) db.history[fid] = [];
                    const saveMsg = { ...finalMsg, content: '[File Saved]', type: 'text' };
                    db.history[fid].push(saveMsg);
                    saveDB();
                    
                    delete activeTransfers[msg.fileId];
                    document.getElementById('success-sound').play().catch(()=>{});
                }
                return;
            }

            // 普通/表情消息
            if(!db.history[fid]) db.history[fid] = [];
            db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
            saveDB();
            renderFriends();

            if(activeChatId === fid) appendMsgDOM(msg, false);
            else document.getElementById('msg-sound').play().catch(()=>{});
        });
    }

    // --- 5. 文件切片发送 ---
    function sendFileChunked(file) {
        if(!activeChatId || !socket) return;
        
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const reader = new FileReader();
        
        socket.emit('send_private', {
            targetId: activeChatId,
            type: 'file_start',
            fileId: fileId,
            fileName: file.name,
            fileType: file.type,
            totalSize: file.size
        });

        appendProgressBubble(activeChatId, fileId, file.name, file.type, true);

        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
            let currentChunk = 0;
            let lastUpdate = Date.now();
            let sentBytes = 0;
            let lastBytes = 0;

            const sendLoop = setInterval(() => {
                if(currentChunk >= totalChunks) {
                    clearInterval(sendLoop);
                    socket.emit('send_private', { targetId: activeChatId, type: 'file_end', fileId: fileId });
                    
                    const finalMsg = {
                        type: file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'file',
                        content: URL.createObjectURL(file),
                        fileName: file.name,
                        isSelf: true
                    };
                    replaceProgressWithContent(fileId, finalMsg);
                    
                    if(!db.history[activeChatId]) db.history[activeChatId] = [];
                    db.history[activeChatId].push({ ...finalMsg, content: '[File Sent]', type: 'text' });
                    saveDB();
                    return;
                }

                const chunk = base64Data.slice(currentChunk * CHUNK_SIZE, (currentChunk + 1) * CHUNK_SIZE);
                socket.emit('send_private', {
                    targetId: activeChatId,
                    type: 'file_chunk',
                    fileId: fileId,
                    chunk: chunk
                });

                sentBytes += chunk.length;
                currentChunk++;

                // 发送端实时速度
                const now = Date.now();
                if(now - lastUpdate > 200) {
                    const speed = ((sentBytes - lastBytes) / 1024) / ((now - lastUpdate)/1000);
                    updateProgressUI(fileId, currentChunk * CHUNK_SIZE, base64Data.length, speed);
                    lastUpdate = now;
                    lastBytes = sentBytes;
                }
            }, 5); 
        };
    }

    function b64toBlob(b64Data, contentType) {
        const sliceSize = 512;
        const byteCharacters = atob(b64Data);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, {type: contentType});
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${f.alias || f.id}</div><div style="font-size:12px; color:green">SAVED</div></div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('right-sheet');
        chatView.classList.add('active');
        document.getElementById('chat-online-dot').className = "status-dot online";
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m, m.isSelf));
    }

    function sendData(type, content) {
        if(!activeChatId) return;
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type });
        }
        const msgObj = { type, content, isSelf: true, ts: Date.now() };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj);
        saveDB();
        appendMsgDOM(msgObj, true);
    }

    // ★ 核心渲染：处理各种消息类型 ★
    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        const uid = Date.now() + Math.random().toString().substr(2,5); 

        let html = '';
        if(msg.type === 'text') {
            html = `<div class="bubble">${msg.content}</div>`;
        } 
        else if (msg.type === 'sticker') {
            // ★ 修复表情不显示 (确保img类名正确)
            html = `<div class="bubble" style="background:transparent; border:none; box-shadow:none;">
                        <img src="${msg.content}" class="sticker-img">
                    </div>`;
        }
        else if (msg.type === 'voice') {
            // ★ 修复语音：增加 playing 类控制波纹
            html = `<div id="voice-${uid}" class="bubble voice-bubble ${isSelf?'self':'other'}" 
                        style="cursor:pointer; display:flex; align-items:center; gap:5px; background:${isSelf?'#59BC10':'#fff'}; color:${isSelf?'#fff':'#000'}" 
                        onclick="playVoice('${msg.content}', 'voice-${uid}')">
                        <span style="font-weight:bold;">▶ Voice</span>
                        <div class="wave-visual">
                            <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
                        </div>
                    </div>`;
        } 
        else if (msg.type === 'image') {
            // ★ 修复：缩略图限制在 120px，且使用 .thumb-box 包裹
            html = `<div class="bubble" style="padding:4px;">
                        <div class="thumb-box">
                            <img src="${msg.content}" class="thumb-img">
                            <div class="preview-eye" onclick="previewMedia('${msg.content}', 'image')">
                                <span style="color:#fff; font-size:16px;">👁</span>
                            </div>
                        </div>
                    </div>`;
        } 
        else if (msg.type === 'video') {
            html = `<div class="bubble" style="padding:4px;">
                        <div style="position:relative; width:120px; height:80px; background:#000; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                            <div style="color:#fff; font-size:8px; position:absolute; bottom:2px; left:2px; max-width:100%; overflow:hidden; white-space:nowrap;">${msg.fileName||'Video'}</div>
                            <div style="width:30px; height:30px; background:rgba(255,255,255,0.3); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;"
                                 onclick="previewMedia('${msg.content}', 'video')">
                                <span style="color:#fff; font-size:18px;">▶</span>
                            </div>
                        </div>
                    </div>`;
        } 
        else if (msg.type === 'file') {
            // ★ 修复：确保 msg.fileName 被正确使用
            html = `<div class="bubble">📂 ${msg.fileName || 'File'}<br><a href="${msg.content}" download="${msg.fileName || 'download'}" style="text-decoration:underline; font-weight:bold;">Download</a></div>`;
        }
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function appendProgressBubble(chatId, fileId, fileName, fileType, isSelf) {
        if(activeChatId !== chatId) return;
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.id = `progress-row-${fileId}`;
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px;">
                <div style="font-weight:bold; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:150px;">${isSelf?'⬆':'⬇'} ${fileName}</div>
                <div style="background:#ddd; height:4px; border-radius:2px; overflow:hidden; margin-bottom:4px;">
                    <div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#fff':'#59BC10'}; transition:width 0.1s;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:10px; opacity:0.8;">
                    <span id="speed-${fileId}">0 KB/s</span>
                    <span id="pct-${fileId}">0%</span>
                </div>
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function updateProgressUI(fileId, current, total, speed) {
        const bar = document.getElementById(`bar-${fileId}`);
        const spd = document.getElementById(`speed-${fileId}`);
        const pct = document.getElementById(`pct-${fileId}`);
        if(bar && spd && pct) {
            const percent = Math.min(100, Math.floor((current / total) * 100));
            bar.style.width = `${percent}%`;
            pct.innerText = `${percent}%`;
            
            // 实时速度格式化
            if (speed > 1024) spd.innerText = `${(speed/1024).toFixed(1)} MB/s`;
            else spd.innerText = `${Math.floor(speed)} KB/s`;
        }
    }

    function replaceProgressWithContent(fileId, msg) {
        const row = document.getElementById(`progress-row-${fileId}`);
        if(row) {
            row.remove();
            appendMsgDOM(msg, msg.isSelf);
        }
    }

    // --- 6. 交互事件 ---
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };
    document.getElementById('chat-back-btn').onclick = window.goBack;

    // 模式切换
    const modeSwitch = document.getElementById('mode-switch-btn');
    const voiceBtn = document.getElementById('voice-record-btn');
    const textWrapper = document.getElementById('text-input-wrapper');
    let isVoiceMode = true; 

    modeSwitch.onclick = () => {
        isVoiceMode = !isVoiceMode;
        if(isVoiceMode) {
            textWrapper.classList.add('hidden');
            textWrapper.style.display = 'none';
            voiceBtn.classList.remove('hidden');
            voiceBtn.style.display = 'block';
            modeSwitch.innerText = "⌨️";
        } else {
            voiceBtn.classList.add('hidden');
            voiceBtn.style.display = 'none';
            textWrapper.classList.remove('hidden');
            textWrapper.style.display = 'flex';
            modeSwitch.innerText = "🎤";
            setTimeout(() => document.getElementById('chat-input').focus(), 100);
        }
    };

    // 录音事件
    let mediaRecorder, audioChunks;
    const startRec = async (e) => {
        if(e) e.preventDefault();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, {type:'audio/webm'});
                const reader = new FileReader(); 
                reader.readAsDataURL(blob);
                reader.onloadend = () => sendData('voice', reader.result);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording'); 
            voiceBtn.innerText="RECORDING...";
        } catch(e) { alert("Mic Error: " + e.message); }
    };
    const stopRec = (e) => {
        if(e) e.preventDefault();
        if(mediaRecorder && mediaRecorder.state !== 'inactive') { 
            mediaRecorder.stop(); 
            voiceBtn.classList.remove('recording'); 
            voiceBtn.innerText="HOLD TO SPEAK"; 
        } 
    };
    voiceBtn.addEventListener('touchstart', startRec, {passive: false});
    voiceBtn.addEventListener('touchend', stopRec, {passive: false});
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);

    // 文件上传
    const fileInput = document.getElementById('chat-file-input');
    document.getElementById('file-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            sendFileChunked(file); 
            fileInput.value = '';
        }
    };

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
    window.addEventListener('drop', e => { 
        e.preventDefault(); 
        drag.classList.add('hidden'); 
        if(activeChatId && e.dataTransfer.files[0]) { 
            sendFileChunked(e.dataTransfer.files[0]); 
        } 
    });

    document.body.onclick = () => document.getElementById('msg-sound').load();
});
