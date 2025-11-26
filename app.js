document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 配置与状态 ---
    const MY_ID = localStorage.getItem('sloth_v4_id') || 'U-' + Math.floor(Math.random() * 90000);
    localStorage.setItem('sloth_v4_id', MY_ID);

    let friends = JSON.parse(localStorage.getItem('sloth_v4_friends')) || [];
    let activeChatId = null;
    let peer = null;
    let connections = {};
    
    // 缓存 UI 元素引用
    const ui = {
        mainPage: document.getElementById('view-main'),
        chatPage: document.getElementById('view-chat'),
        msgContainer: document.getElementById('messages-container'),
        dragOverlay: document.getElementById('drag-overlay'),
        toast: document.getElementById('persistent-toast'),
        sound: document.getElementById('msg-sound'),
        stickerPanel: document.getElementById('sticker-panel'),
        chatInput: document.getElementById('chat-input')
    };

    // --- 2. 初始化渲染 ---
    // 保护 QRCode 初始化
    try {
        document.getElementById('my-display-name').innerText = "Me";
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('card-id-text').innerText = MY_ID;
        document.getElementById('my-avatar-small').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${MY_ID}&backgroundColor=e5e5e5`;
        if(window.QRCode) {
            new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 64, height: 64, colorDark: "#000", colorLight: "#fff" });
        }
    } catch(e) { console.error('UI Init Failed', e); }

    // --- 3. 核心功能: 传输 (Chunking) ---
    const CHUNK_SIZE = 16 * 1024;
    const incomingFiles = {};

    function sendFile(conn, file) {
        const transferId = Date.now() + Math.random().toString();
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const msgId = appendFileMessage(MY_ID, { name: file.name, size: file.size, id: transferId }, true);

        conn.send({ type: 'file-start', transferId, name: file.name, size: file.size, fileType: file.type, totalChunks });

        let chunkIndex = 0;
        function sendNext() {
            if (chunkIndex >= totalChunks) {
                updateProgress(transferId, 100, true);
                if (file.type.startsWith('image/')) showPreview(msgId, URL.createObjectURL(file));
                return;
            }
            const start = chunkIndex * CHUNK_SIZE;
            const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
            const reader = new FileReader();
            reader.onload = e => {
                conn.send({ type: 'file-chunk', transferId, index: chunkIndex, data: e.target.result });
                chunkIndex++;
                updateProgress(transferId, Math.floor((chunkIndex/totalChunks)*100));
                setTimeout(sendNext, 5); // 避免卡死 UI
            };
            reader.readAsArrayBuffer(chunk);
        }
        sendNext();
    }

    function handleFile(senderId, data) {
        if (data.type === 'file-start') {
            incomingFiles[data.transferId] = { meta: data, chunks: [], receivedCount: 0 };
            appendFileMessage(senderId, { name: data.name, size: data.size, id: data.transferId }, false);
        } else if (data.type === 'file-chunk') {
            const f = incomingFiles[data.transferId];
            if (!f) return;
            f.chunks[data.index] = data.data;
            f.receivedCount++;
            updateProgress(data.transferId, Math.floor((f.receivedCount/f.meta.totalChunks)*100));
            if (f.receivedCount === f.meta.totalChunks) {
                const blob = new Blob(f.chunks, { type: f.meta.fileType });
                finishDownload(data.transferId, blob, f.meta.name);
                delete incomingFiles[data.transferId];
            }
        }
    }

    // --- 4. 界面交互绑定 (放在最前，防止被 JS 错误打断) ---
    
    // 导航栏 Tab 切换
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
            document.getElementById(btn.dataset.target).classList.add('active-tab');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 聊天相关
    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        ui.chatPage.classList.add('active');
        ui.msgContainer.innerHTML = ''; 
    }
    
    document.getElementById('chat-back-btn').addEventListener('click', () => {
        ui.chatPage.classList.remove('active');
        activeChatId = null;
    });

    // 发送消息
    function sendText() {
        const val = ui.chatInput.value.trim();
        if(val && activeChatId && connections[activeChatId]) {
            connections[activeChatId].send({ type: 'text', content: val });
            appendMsg(val, true);
            ui.chatInput.value = '';
        }
    }
    document.getElementById('chat-send-btn').addEventListener('click', sendText);
    ui.chatInput.addEventListener('keypress', e => { if(e.key === 'Enter') sendText(); });

    // 文件与表情
    document.getElementById('add-file-btn').addEventListener('click', () => document.getElementById('real-file-input').click());
    document.getElementById('real-file-input').addEventListener('change', (e) => {
        if(e.target.files[0] && activeChatId) sendFile(connections[activeChatId], e.target.files[0]);
    });
    
    document.getElementById('sticker-btn').addEventListener('click', () => ui.stickerPanel.classList.toggle('hidden'));
    ui.chatInput.addEventListener('focus', () => ui.stickerPanel.classList.add('hidden'));

    // 生成表情包列表
    const stickerSeeds = ['happy', 'cool', 'love', 'wink', 'angry', 'surprised', 'sleepy', 'cry'];
    const grid = document.getElementById('sticker-grid');
    if(grid) {
        stickerSeeds.forEach(seed => {
            const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}&backgroundColor=transparent`;
            const img = document.createElement('img');
            img.src = url;
            img.className = 'sticker-item';
            img.addEventListener('click', () => {
                if(activeChatId && connections[activeChatId]) {
                    connections[activeChatId].send({ type: 'sticker', url: url });
                    appendSticker(url, true);
                    ui.stickerPanel.classList.add('hidden');
                }
            });
            grid.appendChild(img);
        });
    }

    // 拖拽逻辑 (修复版：使用计数器避免闪烁)
    let dragCounter = 0;
    document.body.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if(activeChatId) {
            ui.dragOverlay.classList.remove('hidden');
            ui.dragOverlay.classList.add('active'); // 允许指针事件
        }
    });
    document.body.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if(dragCounter <= 0) {
            ui.dragOverlay.classList.add('hidden');
            ui.dragOverlay.classList.remove('active');
        }
    });
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        ui.dragOverlay.classList.add('hidden');
        ui.dragOverlay.classList.remove('active');
        
        if(e.dataTransfer.files[0] && activeChatId) {
            sendFile(connections[activeChatId], e.dataTransfer.files[0]);
        }
    });

    // 弹窗逻辑
    const qrModal = document.getElementById('qr-overlay');
    const addModal = document.getElementById('add-overlay');
    
    document.getElementById('scan-btn').addEventListener('click', () => {
        qrModal.classList.remove('hidden');
        try {
            const scanner = new Html5Qrcode("qr-reader");
            scanner.start({facingMode:"environment"}, {fps:10}, (txt)=>{
                scanner.stop(); qrModal.classList.add('hidden');
                addFriend(txt); connectTo(txt); openChat(txt);
            });
            window.currentScanner = scanner;
        } catch(e) { alert('Scanner Error'); }
    });
    window.closeScanner = () => { 
        if(window.currentScanner) window.currentScanner.stop();
        qrModal.classList.add('hidden'); 
    };

    document.getElementById('add-id-btn').addEventListener('click', () => addModal.classList.remove('hidden'));
    window.closeAddModal = () => addModal.classList.add('hidden');
    document.getElementById('confirm-add-btn').addEventListener('click', () => {
        const id = document.getElementById('manual-id-input').value.trim();
        if(id) { addFriend(id); connectTo(id); closeAddModal(); }
    });

    // 通知逻辑
    let pendingNotifyId = null;
    function showNotify(id, txt) {
        if(activeChatId === id) return;
        ui.sound.play().catch(()=>{});
        pendingNotifyId = id;
        document.getElementById('notify-text').innerText = `${id}: ${txt}`;
        ui.toast.classList.remove('hidden');
    }
    document.getElementById('notify-close').onclick = () => ui.toast.classList.add('hidden');
    document.getElementById('notify-view').onclick = () => {
        ui.toast.classList.add('hidden');
        if(pendingNotifyId) openChat(pendingNotifyId);
    };

    // --- 5. DOM 渲染辅助 ---
    function appendMsg(txt, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<div class="bubble">${txt}</div>`;
        ui.msgContainer.appendChild(div);
        ui.msgContainer.scrollTop = ui.msgContainer.scrollHeight;
    }
    function appendSticker(url, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<img src="${url}" class="sticker-img">`;
        ui.msgContainer.appendChild(div);
        ui.msgContainer.scrollTop = ui.msgContainer.scrollHeight;
    }
    function appendFileMessage(senderId, info, isSelf) {
        const div = document.createElement('div');
        const id = 'msg-' + info.id; div.id = id;
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="file-card">
                <div class="file-info"><span style="font-size:20px">📄</span> ${info.name}</div>
                <div class="progress-track"><div class="progress-bar" id="p-${info.id}"></div></div>
                <div class="file-meta"><span>${(info.size/1024).toFixed(1)} KB</span><span id="t-${info.id}">0%</span></div>
                <div id="pv-${info.id}"></div>
            </div>`;
        ui.msgContainer.appendChild(div);
        ui.msgContainer.scrollTop = ui.msgContainer.scrollHeight;
        return id;
    }
    function updateProgress(tid, pct, done) {
        const bar = document.getElementById(`p-${tid}`);
        const txt = document.getElementById(`t-${tid}`);
        if(bar) { bar.style.width = pct+'%'; if(done) bar.style.background='#4cd964'; }
        if(txt) txt.innerText = done ? 'Done' : pct+'%';
    }
    function finishDownload(tid, blob, name) {
        updateProgress(tid, 100, true);
        const box = document.getElementById(`pv-${tid}`);
        const url = URL.createObjectURL(blob);
        if(blob.type.startsWith('image/')) showPreview(`msg-${tid}`, url);
        else if(box) box.innerHTML = `<a href="${url}" download="${name}" style="color:#007AFF;font-size:12px;margin-top:5px;display:block">Save File</a>`;
    }
    function showPreview(eid, url) {
        const el = document.getElementById(eid);
        if(el) { const b = el.querySelector('[id^="pv-"]'); if(b) b.innerHTML = `<img src="${url}" class="preview-img">`; }
    }
    
    // 好友列表
    function addFriend(id) {
        if(!friends.includes(id)) { friends.push(id); localStorage.setItem('sloth_v4_friends', JSON.stringify(friends)); }
        renderFriends();
    }
    function renderFriends() {
        const c = document.getElementById('friends-list-container');
        c.innerHTML = '';
        friends.forEach(id => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `<img src="https://api.dicebear.com/7.x/notionists/svg?seed=${id}&backgroundColor=e5e5e5" class="avatar-circle">
            <div class="item-content"><div class="item-title">${id}</div><div class="item-subtitle">Tap to chat</div></div>`;
            div.addEventListener('click', () => openChat(id));
            c.appendChild(div);
        });
    }

    // --- 6. 网络启动 (放在最后) ---
    function connectTo(id) {
        if(!id || id===MY_ID) return;
        const conn = peer.connect(id);
        setupConn(conn);
    }
    function setupConn(conn) {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            addFriend(conn.peer);
            renderFriends();
            if(activeChatId === conn.peer) document.querySelector('.dot').classList.add('online');
        });
        conn.on('data', d => {
            if(d.type==='text') { if(activeChatId===conn.peer) appendMsg(d.content,false); showNotify(conn.peer, d.content); }
            else if(d.type==='sticker') { if(activeChatId===conn.peer) appendSticker(d.url,false); showNotify(conn.peer, '[Sticker]'); }
            else if(d.type.startsWith('file-')) handleFile(conn.peer, d);
        });
    }

    try {
        if(window.Peer) {
            peer = new Peer(MY_ID);
            peer.on('open', () => { renderFriends(); friends.forEach(connectTo); });
            peer.on('connection', setupConn);
            peer.on('error', e => console.log('Peer Error', e));
        } else {
            console.error('PeerJS failed to load');
            alert('Network Error: PeerJS lib missing');
        }
    } catch(e) { console.error('Peer Init Failed', e); }

    // 全局点击解锁音频
    document.body.addEventListener('click', () => ui.sound.load(), { once: true });
    renderFriends();
});
