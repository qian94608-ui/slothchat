document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态注入预览模态框 (解决无法修改HTML的问题) ---
    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:#000; z-index:9999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:10000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:40px; height:40px; border-radius:50%; font-size:20px;">✕</button>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 全局变量与工具 ---
    const DB_KEY = 'pepe_v33_final';
    
    // 文件传输相关变量
    const CHUNK_SIZE = 16 * 1024; // 16KB 切片
    const activeTransfers = {}; // 存储正在传输/接收的文件块
    
    // 预览相关逻辑
    window.previewMedia = (url, type) => {
        const modal = document.getElementById('media-preview-modal');
        const container = document.getElementById('preview-container');
        container.innerHTML = '';
        
        let el;
        if(type === 'image') {
            el = document.createElement('img');
            el.src = url;
            el.style.maxWidth = '100%';
            el.style.maxHeight = '100%';
            el.style.objectFit = 'contain';
        } else if(type === 'video') {
            el = document.createElement('video');
            el.src = url;
            el.controls = true;
            el.autoplay = true;
            el.style.maxWidth = '100%';
            el.style.maxHeight = '100%';
        }
        
        if(el) {
            container.appendChild(el);
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            // 利用 History API 防止安卓/iOS 手势直接退出 APP
            window.history.pushState({preview: true}, "");
        }
    };

    window.closePreview = () => {
        const modal = document.getElementById('media-preview-modal');
        if(!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.getElementById('preview-container').innerHTML = '';
            // 如果历史栈顶是预览状态，则回退
            if(window.history.state && window.history.state.preview) {
                window.history.back();
            }
        }
    };
    
    // 监听浏览器的返回事件 (物理返回键/侧滑)
    window.addEventListener('popstate', (e) => {
        const modal = document.getElementById('media-preview-modal');
        if(!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.getElementById('preview-container').innerHTML = '';
        }
    });

    // 基础窗口控制
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

    // --- 3. 核心功能实现 ---

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

    // --- 4. 聊天、文件传输与网络 (重构版) ---
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

            // --- 传输层逻辑 ---
            if (msg.type === 'file_start') {
                // 初始化接收任务
                activeTransfers[msg.fileId] = {
                    chunks: [],
                    totalSize: msg.totalSize,
                    receivedSize: 0,
                    startTime: Date.now(),
                    lastBytes: 0,
                    lastTime: Date.now(),
                    fileName: msg.fileName,
                    fileType: msg.fileType,
                    meta: msg // 保存元数据
                };
                // 立即在界面显示“接收中”气泡
                if(activeChatId === fid) {
                    appendProgressBubble(fid, msg.fileId, msg.fileName, msg.fileType, false);
                }
                return; // 不存入历史，直到接收完成
            }

            if (msg.type === 'file_chunk') {
                const transfer = activeTransfers[msg.fileId];
                if(transfer) {
                    transfer.chunks.push(msg.chunk);
                    transfer.receivedSize += msg.chunk.byteLength || (msg.chunk.length * 0.75); // Base64估算或Buffer
                    
                    // 计算速度
                    const now = Date.now();
                    if(now - transfer.lastTime > 500) { // 每0.5秒更新一次UI
                        const speed = ((transfer.receivedSize - transfer.lastBytes) / 1024) / ((now - transfer.lastTime)/1000);
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
                    // 接收完成，组装文件
                    const blob = b64toBlob(transfer.chunks.join(''), transfer.fileType);
                    const fileUrl = URL.createObjectURL(blob);
                    
                    // 构造最终消息对象
                    const finalMsg = {
                        type: isImage(transfer.fileType) ? 'image' : isVideo(transfer.fileType) ? 'video' : 'file',
                        content: fileUrl, // 注意：Blob URL 刷新后会失效，持久化需要IndexedDB，此处按要求仅内存展示
                        fileName: transfer.fileName,
                        isSelf: false,
                        ts: Date.now()
                    };

                    // 更新UI把进度条变成实际内容
                    replaceProgressWithContent(msg.fileId, finalMsg);
                    
                    // 存历史 (存占位符)
                    if(!db.history[fid]) db.history[fid] = [];
                    db.history[fid].push({ ...finalMsg, content: '[File Saved]', type: 'text' });
                    saveDB();
                    
                    delete activeTransfers[msg.fileId];
                    document.getElementById('success-sound').play().catch(()=>{});
                }
                return;
            }

            // 普通文本消息
            if(!db.history[fid]) db.history[fid] = [];
            db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
            saveDB();
            renderFriends();

            if(activeChatId === fid) appendMsgDOM(msg, false);
            else document.getElementById('msg-sound').play().catch(()=>{});
        });
    }

    // --- 5. 文件切片发送逻辑 ---
    function sendFileChunked(file) {
        if(!activeChatId || !socket) return;
        
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const reader = new FileReader();
        
        // 1. 发送开始信号
        socket.emit('send_private', {
            targetId: activeChatId,
            type: 'file_start',
            fileId: fileId,
            fileName: file.name,
            fileType: file.type,
            totalSize: file.size
        });

        // UI: 显示发送进度条
        appendProgressBubble(activeChatId, fileId, file.name, file.type, true);

        // 2. 读取并切片发送
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1]; // 去掉 data:xxx;base64, 前缀
            const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
            let currentChunk = 0;
            let lastUpdate = Date.now();
            let sentBytes = 0;

            const sendLoop = setInterval(() => {
                if(currentChunk >= totalChunks) {
                    clearInterval(sendLoop);
                    // 发送结束信号
                    socket.emit('send_private', { targetId: activeChatId, type: 'file_end', fileId: fileId });
                    
                    // 构造本地显示用的消息
                    const finalMsg = {
                        type: isImage(file.type) ? 'image' : isVideo(file.type) ? 'video' : 'file',
                        content: URL.createObjectURL(file),
                        fileName: file.name,
                        isSelf: true
                    };
                    replaceProgressWithContent(fileId, finalMsg);
                    
                    // 存历史
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

                // 计算发送速度
                const now = Date.now();
                if(now - lastUpdate > 500) {
                    const speed = (CHUNK_SIZE / 1024) / ((now - lastUpdate)/1000); // KB/s
                    updateProgressUI(fileId, currentChunk * CHUNK_SIZE, base64Data.length, speed);
                    lastUpdate = now;
                }
            }, 10); // 每10ms发送一片，避免阻塞主线程
        };
    }

    // 辅助函数
    function isImage(type) { return type && type.startsWith('image'); }
    function isVideo(type) { return type && type.startsWith('video'); }
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

    // --- 6. 聊天 UI 渲染 ---
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

    // 普通文本发送
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

    // 渲染消息气泡
    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        
        let html = '';
        if(msg.type === 'text') {
            html = `<div class="bubble">${msg.content}</div>`;
        } else if (msg.type === 'voice') {
            // 修复语音播放，添加点击播放逻辑
            html = `<div class="bubble voice-bubble" style="cursor:pointer; display:flex; align-items:center; gap:5px; background:${isSelf?'#59BC10':'#fff'}; color:${isSelf?'#fff':'#000'}" onclick="this.querySelector('audio').play()">
                        <span>▶ 🎤 Voice Msg</span>
                        <audio src="${msg.content}"></audio>
                    </div>`;
        } else if (msg.type === 'image') {
            // 图片：缩略图 + 预览眼
            html = `<div class="bubble" style="padding:5px;">
                        <div style="position:relative;">
                            <img src="${msg.content}" style="max-width:150px; border-radius:8px;">
                            <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.6); border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer;"
                                 onclick="previewMedia('${msg.content}', 'image')">
                                <span style="color:#fff; font-size:16px;">👁</span>
                            </div>
                        </div>
                    </div>`;
        } else if (msg.type === 'video') {
            // 视频：缩略图 + 播放按钮
            html = `<div class="bubble" style="padding:5px;">
                        <div style="position:relative; width:150px; height:100px; background:#000; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <video src="${msg.content}" style="max-width:100%; max-height:100%; display:none;"></video>
                            <div style="color:#fff; font-size:10px; position:absolute; bottom:2px; left:2px;">${msg.fileName||'Video'}</div>
                            <div style="width:40px; height:40px; background:rgba(255,255,255,0.3); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;"
                                 onclick="previewMedia('${msg.content}', 'video')">
                                <span style="color:#fff; font-size:24px;">▶</span>
                            </div>
                        </div>
                    </div>`;
        } else if (msg.type === 'file') {
            html = `<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}">Download</a></div>`;
        }
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // 进度条气泡生成
    function appendProgressBubble(chatId, fileId, fileName, fileType, isSelf) {
        if(activeChatId !== chatId) return;
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.id = `progress-row-${fileId}`;
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble" style="min-width:180px;">
                <div style="font-weight:bold; font-size:12px; margin-bottom:5px;">${isSelf?'⬆ Uploading':'⬇ Receiving'} ${fileName}</div>
                <div style="background:#ddd; height:6px; border-radius:3px; overflow:hidden; margin-bottom:5px;">
                    <div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#fff':'#59BC10'}; transition:width 0.2s;"></div>
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

    // 更新进度条 UI
    function updateProgressUI(fileId, current, total, speed) {
        const bar = document.getElementById(`bar-${fileId}`);
        const spd = document.getElementById(`speed-${fileId}`);
        const pct = document.getElementById(`pct-${fileId}`);
        if(bar && spd && pct) {
            const percent = Math.floor((current / total) * 100);
            bar.style.width = `${percent}%`;
            pct.innerText = `${percent}%`;
            spd.innerText = speed > 1024 ? `${(speed/1024).toFixed(1)} MB/s` : `${Math.floor(speed)} KB/s`;
        }
    }

    // 传输完成后替换为真实内容
    function replaceProgressWithContent(fileId, msg) {
        const row = document.getElementById(`progress-row-${fileId}`);
        if(row) {
            // 简单处理：移除进度条，重新append真实消息
            row.remove();
            appendMsgDOM(msg, msg.isSelf);
        }
    }

    // --- 7. 交互事件 (修复输入/语音/文件) ---
    
    // A. 文本发送
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };
    document.getElementById('chat-back-btn').onclick = window.goBack;

    // B. 输入模式切换 (完全修复)
    const modeSwitch = document.getElementById('mode-switch-btn');
    const voiceBtn = document.getElementById('voice-record-btn');
    const textWrapper = document.getElementById('text-input-wrapper');
    let isVoiceMode = true; // 初始状态

    modeSwitch.onclick = () => {
        isVoiceMode = !isVoiceMode;
        if(isVoiceMode) {
            // 切换为语音模式
            textWrapper.classList.add('hidden');
            textWrapper.style.display = 'none';
            voiceBtn.classList.remove('hidden');
            voiceBtn.style.display = 'block';
            modeSwitch.innerText = "⌨️";
        } else {
            // 切换为键盘模式
            voiceBtn.classList.add('hidden');
            voiceBtn.style.display = 'none';
            textWrapper.classList.remove('hidden');
            textWrapper.style.display = 'flex';
            modeSwitch.innerText = "🎤";
            setTimeout(() => document.getElementById('chat-input').focus(), 100);
        }
    };

    // C. 语音录制 (修复：使用 Touch 事件)
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
                // 停止流
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
    
    // 绑定触摸事件 (移动端核心)
    voiceBtn.addEventListener('touchstart', startRec, {passive: false});
    voiceBtn.addEventListener('touchend', stopRec, {passive: false});
    // 兼容PC调试
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);

    // D. 文件上传 (修复：事件绑定)
    const fileInput = document.getElementById('chat-file-input');
    // 点击按钮触发 input
    document.getElementById('file-btn').onclick = () => fileInput.click();
    // 监听 input 变化触发发送
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            sendFileChunked(file); // 使用切片发送
            fileInput.value = ''; // 清空以允许重复上传同名文件
        }
    };

    // Nickname & FM
    window.editMyName = () => { const n = prompt("New Name:", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); document.getElementById('my-nickname').innerText=n; } };
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Rename:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    const fm = document.getElementById('fm-radio');
    document.getElementById('fm-btn').onclick = () => { if(fm.paused) { fm.play(); alert("FM ON"); } else { fm.pause(); alert("FM OFF"); } };

    // Stickers
    const sGrid = document.getElementById('sticker-grid');
    for(let i=0; i<12; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-item'; img.style.width='60px';
        img.onclick = () => { if(activeChatId) { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // Drag
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); 
        drag.classList.add('hidden'); 
        if(activeChatId && e.dataTransfer.files[0]) { 
            sendFileChunked(e.dataTransfer.files[0]); // 拖拽也走切片
        } 
    });

    document.body.onclick = () => document.getElementById('msg-sound').load();
});
