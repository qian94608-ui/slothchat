document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. 数据与状态管理 (Data Model)
    // ==========================================
    const DB_KEY = 'wojak_v8_db';
    let db = JSON.parse(localStorage.getItem(DB_KEY)) || {
        profile: { id: 'Anon-' + crypto.randomUUID().split('-')[0].toUpperCase(), avatarSeed: Math.random() },
        friends: [], // [{ id, alias, addedAt }]
        history: {}  // { friendId: [ {type, content, isSelf, ts} ] }
    };
    
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    saveDB(); // Ensure init

    const MY_ID = db.profile.id;
    let activeChatId = null;
    let connections = {};
    let peer = null;
    let mediaRecorder = null;
    let audioChunks = [];

    // UI Init
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    try { new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 80, height: 80 }); } catch(e){}


    // ==========================================
    // 2. 好友列表与左滑删除 (Swipe Logic)
    // ==========================================
    function renderFriends() {
        const container = document.getElementById('friends-list-container');
        container.innerHTML = '';

        db.friends.forEach(f => {
            const isOnline = connections[f.id] && connections[f.id].open;
            const displayName = f.alias || f.id;

            // 创建包裹层
            const wrapper = document.createElement('div');
            wrapper.className = 'list-item-wrapper';

            // 创建内容层
            const content = document.createElement('div');
            content.className = 'k-list-item';
            content.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div style="pointer-events:none;">
                    <div style="font-weight:bold">${displayName}</div>
                    <div style="font-size:12px; color:${isOnline?'green':'red'}">${isOnline ? '>> ONLINE' : '>> OFFLINE'}</div>
                </div>
            `;

            // 创建删除按钮层
            const delBtn = document.createElement('div');
            delBtn.className = 'delete-action';
            delBtn.innerText = 'DELETE';
            delBtn.onclick = (e) => {
                e.stopPropagation(); // 防止触发进入聊天
                if(confirm(`Delete ${displayName}?`)) {
                    db.friends = db.friends.filter(x => x.id !== f.id);
                    saveDB();
                    renderFriends();
                }
            };

            wrapper.appendChild(delBtn);
            wrapper.appendChild(content);
            container.appendChild(wrapper);

            // --- 绑定手势事件 ---
            let startX, currentX;
            
            content.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                content.style.transition = 'none'; // 拖动时移除过渡
            });

            content.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].clientX;
                let diff = currentX - startX;
                // 只能向左滑 (diff < 0)，最大滑 -80px
                if(diff < 0 && diff > -100) {
                    content.style.transform = `translateX(${diff}px)`;
                }
            });

            content.addEventListener('touchend', (e) => {
                content.style.transition = 'transform 0.2s ease-out';
                let diff = currentX - startX;
                if(diff < -50) {
                    // 展开删除
                    content.style.transform = `translateX(-80px)`;
                } else {
                    // 回弹
                    content.style.transform = `translateX(0px)`;
                }
            });

            // 点击进入聊天 (如果没有展开删除)
            content.addEventListener('click', () => {
                if(content.style.transform === 'translateX(-80px)') {
                    content.style.transform = 'translateX(0px)'; // 收起
                } else {
                    openChat(f.id);
                }
            });
        });
    }

    function addFriend(id) {
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, alias: '', addedAt: Date.now() });
            saveDB();
            renderFriends();
            connectTo(id); // 立即尝试连接
        }
    }


    // ==========================================
    // 3. 聊天与语音/文本切换 (Chat & Voice)
    // ==========================================
    const switchBtn = document.getElementById('mode-switch-btn');
    const textMode = document.getElementById('input-mode-text');
    const voiceMode = document.getElementById('input-mode-voice');
    let isVoice = true; // 默认语音

    // 切换逻辑
    switchBtn.onclick = () => {
        isVoice = !isVoice;
        if(isVoice) {
            textMode.classList.add('hidden');
            voiceMode.classList.remove('hidden');
            switchBtn.innerText = '⌨️'; // 显示键盘图标代表切回文本
        } else {
            voiceMode.classList.add('hidden');
            textMode.classList.remove('hidden');
            switchBtn.innerText = '🎤'; // 显示麦克风图标代表切回语音
        }
    };

    // 发送文本
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    
    function sendText() {
        const txt = chatInput.value.trim();
        if(txt && activeChatId) {
            if(connections[activeChatId]) connections[activeChatId].send({type:'text', content:txt});
            saveMessage(activeChatId, txt, 'text', true);
            appendMsgDOM(txt, true, 'text');
            chatInput.value = '';
        }
    }
    sendBtn.onclick = sendText;

    // --- 语音录制逻辑 ---
    const voiceBtn = document.getElementById('voice-record-btn');
    
    // 按下开始录音
    const startRecording = async () => {
        if (!navigator.mediaDevices) return alert("HTTPS Required for Mic");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                // 发送给对方 (Blob直接发)
                if(activeChatId && connections[activeChatId]) {
                    connections[activeChatId].send({
                        type: 'voice',
                        file: audioBlob,
                        fileType: 'audio/webm'
                    });
                }
                // 本地显示 (转成URL)
                const audioUrl = URL.createObjectURL(audioBlob);
                appendMsgDOM(audioUrl, true, 'voice');
                // 注意：由于localStorage容量限制，这里暂不存Base64音频，仅存标记
                saveMessage(activeChatId, '[Voice Message]', 'text', true); 
            };

            mediaRecorder.start();
            voiceBtn.classList.add('recording');
            voiceBtn.innerText = "🎤 RECORDING...";
        } catch(e) { console.error(e); alert("Mic Error"); }
    };

    // 松开停止录音
    const stopRecording = () => {
        if(mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            voiceBtn.classList.remove('recording');
            voiceBtn.innerText = "HOLD TO SPEAK";
        }
    };

    // 触摸事件绑定
    voiceBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
    voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });
    // 鼠标兼容
    voiceBtn.addEventListener('mousedown', startRecording);
    voiceBtn.addEventListener('mouseup', stopRecording);


    // ==========================================
    // 4. 消息处理与备注 (Logic)
    // ==========================================
    function saveMessage(fid, content, type, isSelf) {
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type, content, isSelf, ts: Date.now() });
        saveDB();
    }

    function appendMsgDOM(content, isSelf, type) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        
        if(type === 'text') {
            div.innerHTML = `<div class="bubble">${content}</div>`;
        } else if (type === 'voice') {
            // 生成音频播放器
            div.innerHTML = `
                <div class="audio-msg" onclick="this.children[1].play()">
                    <span>▶️</span>
                    <audio src="${content}"></audio>
                    <span>Voice Clip</span>
                </div>
            `;
        }
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // 打开聊天
    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        const name = f && f.alias ? f.alias : id;
        
        document.getElementById('chat-partner-name').innerText = name;
        document.getElementById('view-chat').classList.add('active');
        
        // 渲染历史
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg.content, msg.isSelf, msg.type));
        
        updateStatusDot(id);
        window.history.pushState({view:'chat'}, '', '#chat');
    }

    // 备注功能
    document.getElementById('rename-btn').onclick = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x => x.id === activeChatId);
        if(!f) return;
        
        const newAlias = prompt("Set Alias (Remark):", f.alias || "");
        if(newAlias !== null) {
            f.alias = newAlias;
            saveDB();
            document.getElementById('chat-partner-name').innerText = newAlias;
            renderFriends(); // 刷新列表显示
        }
    };


    // ==========================================
    // 5. 网络层 (PeerJS & Connections)
    // ==========================================
    try {
        peer = new Peer(MY_ID);
        peer.on('open', () => {
            document.getElementById('net-status').innerText = "ONLINE";
            document.getElementById('net-status').style.background = "#00FF00";
            db.friends.forEach(f => connectTo(f.id));
        });
        peer.on('connection', setupConn);
    } catch(e){}

    function connectTo(id) {
        if(id === MY_ID) return;
        const conn = peer.connect(id);
        setupConn(conn);
    }

    function setupConn(conn) {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            if(!db.friends.find(f => f.id === conn.peer)) {
                // 如果是陌生人连接，自动添加
                addFriend(conn.peer);
            }
            renderFriends();
            if(activeChatId === conn.peer) updateStatusDot(conn.peer);
        });
        
        conn.on('data', d => {
            if(d.type === 'text') {
                saveMessage(conn.peer, d.content, 'text', false);
                if(activeChatId === conn.peer) {
                    appendMsgDOM(d.content, false, 'text');
                } else {
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
            } else if (d.type === 'voice') {
                // 接收音频 Blob
                const blob = new Blob([d.file], {type: d.fileType});
                const url = URL.createObjectURL(blob);
                if(activeChatId === conn.peer) {
                    appendMsgDOM(url, false, 'voice');
                } else {
                    document.getElementById('msg-sound').play().catch(()=>{});
                    saveMessage(conn.peer, '[Voice Message]', 'text', false);
                }
            }
        });
        
        conn.on('close', () => {
            renderFriends();
            if(activeChatId === conn.peer) updateStatusDot(conn.peer);
        });
    }

    function updateStatusDot(id) {
        const isOnline = connections[id] && connections[id].open;
        document.getElementById('chat-status-dot').className = isOnline ? 'status-square online' : 'status-square';
    }


    // ==========================================
    // 6. 通用 UI 逻辑 (Modal, Nav)
    // ==========================================
    const showModal = (id) => { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).style.display='flex'; };
    const hideModal = (id) => { document.getElementById(id).classList.add('hidden'); document.getElementById(id).style.display='none'; };
    window.hideAllModals = () => {
        hideModal('qr-overlay'); hideModal('add-overlay');
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };

    // 扫码
    document.getElementById('scan-btn').onclick = () => {
        showModal('qr-overlay');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, (txt)=>{
                hideAllModals();
                addFriend(txt);
                openChat(txt);
            });
        }, 300);
    };

    // 手动添加
    document.getElementById('add-id-btn').onclick = () => showModal('add-overlay');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value.trim();
        if(id) { addFriend(id); hideAllModals(); openChat(id); }
    };

    // 页面返回
    window.addEventListener('popstate', () => {
        document.getElementById('view-chat').classList.remove('active');
        activeChatId = null;
    });
    document.getElementById('chat-back-btn').onclick = () => window.history.back();

    // Tab 切换
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active-tab');
        };
    });

    // 启动
    renderFriends();
    // 解锁音频
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
