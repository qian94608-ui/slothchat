// --- 1. 数据层 (Model) ---
const DB_VERSION = 'v3';
let currentUser = JSON.parse(localStorage.getItem(`sloth_user_${DB_VERSION}`)) || {
    id: 'SL-' + Math.floor(100000 + Math.random() * 900000),
    avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${Date.now()}&backgroundColor=ffe0a5`
};
localStorage.setItem(`sloth_user_${DB_VERSION}`, JSON.stringify(currentUser));

// 好友列表: [{id, nickname, addedAt}]
let friends = JSON.parse(localStorage.getItem(`sloth_friends_${DB_VERSION}`)) || [];

// 聊天记录: { friendId: [ { type, content, isSelf, timestamp } ] }
let chatHistory = JSON.parse(localStorage.getItem(`sloth_history_${DB_VERSION}`)) || {};

function saveHistory() {
    localStorage.setItem(`sloth_history_${DB_VERSION}`, JSON.stringify(chatHistory));
}

function addMessageToHistory(friendId, msg) {
    if (!chatHistory[friendId]) chatHistory[friendId] = [];
    chatHistory[friendId].push(msg);
    saveHistory();
}

function updateFriendName(id, newName) {
    const f = friends.find(x => x.id === id);
    if (f) {
        f.nickname = newName;
        localStorage.setItem(`sloth_friends_${DB_VERSION}`, JSON.stringify(friends));
        renderFriendsList();
        if (activeChatId === id) document.getElementById('chat-partner-name').innerText = newName;
    }
}

// --- 2. 初始化 UI ---
document.getElementById('my-avatar-small').src = currentUser.avatar;
document.getElementById('my-avatar-large').src = currentUser.avatar;
document.getElementById('my-id-display').innerText = `ID: ${currentUser.id}`;
document.getElementById('card-id-text').innerText = currentUser.id;

// 生成二维码
new QRCode(document.getElementById("qrcode"), {
    text: currentUser.id, width: 160, height: 160, colorDark : "#191919", colorLight : "#ffffff"
});

// --- 3. 路由与导航 (History API 修复侧滑返回) ---
let activeChatId = null;

function showToast(msg, duration = 2000) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), duration);
    // 点击 Toast 跳转 (如果是收到消息)
    t.onclick = () => {
        if(lastMsgSender && lastMsgSender !== activeChatId) openChat(lastMsgSender);
    };
}

// 切换主页面 Tab
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active-tab');
        
        // 更改 Header 标题
        document.getElementById('header-title').innerText = btn.dataset.title;
    });
});

// 打开聊天窗口 (Push State)
function openChat(friendId) {
    activeChatId = friendId;
    const friend = friends.find(f => f.id === friendId) || { nickname: friendId };
    
    document.getElementById('chat-partner-name').innerText = friend.nickname || friendId;
    renderChatMessages(friendId);
    
    // 更新在线状态UI
    updateOnlineStatusUI(friendId);

    // 动画入场
    const chatPage = document.getElementById('view-chat');
    chatPage.classList.add('active');

    // **核心修复**: 添加历史记录，拦截浏览器返回按键
    window.history.pushState({ page: 'chat', id: friendId }, "Chat", "#chat");
}

// 关闭聊天窗口
function closeChat() {
    document.getElementById('view-chat').classList.remove('active');
    activeChatId = null;
}

// 监听浏览器后退 (物理返回键 / 侧滑)
window.onpopstate = function(event) {
    // 如果没有 state，说明回到了主页
    if (!event.state) {
        closeChat();
    }
};

document.getElementById('chat-back-btn').addEventListener('click', () => {
    window.history.back(); // 手动触发后退
});

// --- 4. 网络层 (PeerJS) ---
const statusBadge = document.getElementById('chat-status-indicator');
let peer = null;
let connections = {}; // { friendId: conn }
let lastMsgSender = null;

// 音频初始化 (必须用户交互后才能播放)
const audioEl = document.getElementById('msg-sound');
document.body.addEventListener('click', () => {
    if(audioEl.paused) audioEl.load(); // 预加载，解锁 AudioContext
}, { once: true });

function initNetwork() {
    peer = new Peer(currentUser.id);

    peer.on('open', (id) => {
        console.log('Online:', id);
        reconnectAll();
    });

    peer.on('connection', (conn) => {
        setupConnection(conn);
    });
    
    peer.on('error', err => console.log('Peer Error', err));
}

function setupConnection(conn) {
    conn.on('open', () => {
        connections[conn.peer] = conn;
        // 如果是陌生人，自动存为好友
        if (!friends.find(f => f.id === conn.peer)) {
            addFriend(conn.peer);
        }
        renderFriendsList(); // 更新列表状态点
        if(activeChatId === conn.peer) updateOnlineStatusUI(conn.peer);
    });

    conn.on('data', (data) => handleData(conn.peer, data));
    
    conn.on('close', () => {
        delete connections[conn.peer];
        renderFriendsList();
        if(activeChatId === conn.peer) updateOnlineStatusUI(conn.peer);
    });
}

function connectTo(id) {
    if (!id || id === currentUser.id) return;
    if (connections[id] && connections[id].open) return;
    const conn = peer.connect(id);
    setupConnection(conn);
}

function reconnectAll() {
    friends.forEach(f => connectTo(f.id));
}

function updateOnlineStatusUI(id) {
    const isOnline = connections[id] && connections[id].open;
    if (id === activeChatId) {
        statusBadge.className = isOnline ? 'status-indicator online' : 'status-indicator';
    }
}

// --- 5. 消息处理 ---
function handleData(senderId, data) {
    lastMsgSender = senderId;
    
    // 播放声音
    audioEl.play().catch(e => console.log('Audio blocked', e));

    const msgObj = {
        isSelf: false,
        timestamp: Date.now()
    };

    if (data.type === 'text') {
        msgObj.type = 'text';
        msgObj.content = data.content;
    } else if (data.type === 'file') {
        msgObj.type = 'file';
        // 转换 ArrayBuffer 为 Blob URL
        const blob = new Blob([data.file], { type: data.fileType });
        msgObj.content = { name: data.fileName, url: URL.createObjectURL(blob) };
    }

    addMessageToHistory(senderId, msgObj);

    // 如果当前正在和这个人聊天，直接追加 DOM
    if (activeChatId === senderId) {
        appendMsgToDOM(msgObj);
    } else {
        showToast(`收到 ${senderId} 的消息`);
    }
}

function sendMessage(type, payload) {
    if (!activeChatId) return;
    const conn = connections[activeChatId];
    
    // 即使离线也可以发(存本地)，但为了简单，目前要求在线
    // 优化: 可以在UI上显示“离线消息已排队”，这里为了演示仅直接发
    
    const msgObj = { isSelf: true, timestamp: Date.now(), type: type };
    
    if (type === 'text') {
        if(conn && conn.open) conn.send({ type: 'text', content: payload });
        msgObj.content = payload;
    } else if (type === 'file') {
        if(conn && conn.open) conn.send({ 
            type: 'file', file: payload, fileName: payload.name, fileType: payload.type 
        });
        msgObj.content = { name: payload.name, url: '#' };
    }

    addMessageToHistory(activeChatId, msgObj);
    appendMsgToDOM(msgObj);
}

// --- 6. 渲染逻辑 ---
function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    container.innerHTML = '';
    document.getElementById('friend-count').innerText = friends.length;

    friends.forEach(f => {
        const isOnline = connections[f.id] && connections[f.id].open;
        const div = document.createElement('div');
        div.className = 'k-list-item';
        div.innerHTML = `
            <img src="${getAvatar(f.id)}" class="avatar-squircle">
            <div class="item-content">
                <div class="item-title">${f.nickname || f.id}</div>
                <div class="item-subtitle">
                    <span class="status-dot ${isOnline ? 'on' : ''}"></span>
                    ${isOnline ? '在线' : '离线'}
                </div>
            </div>
            <div style="color:#ccc; font-size:20px;">⋮</div>
        `;
        
        // 点击进入聊天
        div.addEventListener('click', (e) => {
            // 如果点击的是菜单按钮 (简单模拟)
            if(e.target.innerText === '⋮') {
                e.stopPropagation();
                openRenameModal(f.id);
            } else {
                openChat(f.id);
            }
        });
        container.appendChild(div);
    });
}

function renderChatMessages(id) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    const msgs = chatHistory[id] || [];
    msgs.forEach(appendMsgToDOM);
    setTimeout(() => container.scrollTop = container.scrollHeight, 100);
}

function appendMsgToDOM(msg) {
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    div.className = `message-row ${msg.isSelf ? 'self' : 'other'}`;
    
    if (msg.type === 'text') {
        div.innerHTML = `<div class="chat-bubble">${msg.content}</div>`;
    } else {
        div.innerHTML = `
            <div class="chat-bubble">
                <a href="${msg.content.url}" download="${msg.content.name}" class="file-msg">
                    <span>📄</span> ${msg.content.name}
                </a>
            </div>`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// 辅助函数
const getAvatar = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=ffe0a5`;
function addFriend(id) {
    if (friends.find(f => f.id === id)) return;
    friends.push({ id: id, nickname: '新朋友 ' + id.substr(-4) });
    localStorage.setItem(`sloth_friends_${DB_VERSION}`, JSON.stringify(friends));
    renderFriendsList();
}

// --- 7. 交互绑定 ---

// 发送文字
const input = document.getElementById('chat-input');
const sendBtn = document.getElementById('chat-send-btn');
function triggerSend() {
    const txt = input.value.trim();
    if(txt) { sendMessage('text', txt); input.value = ''; }
}
sendBtn.addEventListener('click', triggerSend);
input.addEventListener('keypress', e => { if(e.key === 'Enter') triggerSend(); });

// 发送文件 (修复点击问题)
const fileBtn = document.getElementById('add-file-btn');
const fileInput = document.getElementById('real-file-input');
fileBtn.addEventListener('click', () => {
    fileInput.click(); // 显式触发
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) sendMessage('file', e.target.files[0]);
    e.target.value = '';
});

// 模态框逻辑
const qrModal = document.getElementById('qr-overlay');
const addModal = document.getElementById('add-overlay');
const renameModal = document.getElementById('rename-overlay');

document.getElementById('scan-btn').addEventListener('click', () => {
    qrModal.classList.remove('hidden');
    startScan();
});
function closeScanner() { qrModal.classList.add('hidden'); stopScan(); }

document.getElementById('add-id-btn').addEventListener('click', () => addModal.classList.remove('hidden'));
function closeAddModal() { addModal.classList.add('hidden'); }
document.getElementById('confirm-add-btn').addEventListener('click', () => {
    const id = document.getElementById('manual-id-input').value.trim();
    if(id) { addFriend(id); connectTo(id); closeAddModal(); showToast('已添加'); }
});

// 重命名逻辑
let renamingId = null;
function openRenameModal(id) {
    renamingId = id;
    const f = friends.find(x => x.id === id);
    document.getElementById('rename-input').value = f ? f.nickname : '';
    renameModal.classList.remove('hidden');
}
function closeRenameModal() { renameModal.classList.add('hidden'); }
document.getElementById('confirm-rename-btn').addEventListener('click', () => {
    const name = document.getElementById('rename-input').value.trim();
    if(name && renamingId) updateFriendName(renamingId, name);
    closeRenameModal();
});

// 扫码器逻辑
let html5QrCode;
function startScan() {
    html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
        closeScanner();
        addFriend(txt);
        connectTo(txt);
        showToast('扫码成功');
    }).catch(err => alert('相机启动失败'));
}
function stopScan() { if(html5QrCode) html5QrCode.stop().then(()=>html5QrCode.clear()); }

// 启动
initNetwork();
renderFriendsList();

// PWA WakeLock
document.addEventListener('click', async () => {
    try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch(e){}
}, { once: true });

// SW
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
